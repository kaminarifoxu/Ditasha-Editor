'use strict';
const net = require('node:net');
const path = require('node:path');
const fs = require('node:fs/promises');
const { randomUUID } = require('node:crypto');
const WORKSPACES = {
  editor: 'Texture & Model',
  converter: 'Converter',
  pack: 'Clothing pack',
  textureviewer: 'Texture viewer',
  modelviewer: 'Model viewer',
  archives: 'GTA V Explorer',
  vehicles: 'Vehicle workshop',
};
function validatePreferences(value) {
  if (
    !value ||
    typeof value.enabled !== 'boolean' ||
    typeof value.shareWorkspace !== 'boolean' ||
    typeof value.applicationId !== 'string' ||
    (value.applicationId !== '' && !/^\d{17,20}$/.test(value.applicationId))
  )
    throw Error('Application ID harus 17–20 angka; salin dari Discord Developer Portal.');
  return {
    enabled: value.enabled,
    shareWorkspace: value.shareWorkspace,
    applicationId: value.applicationId,
  };
}
function ipcPaths(platform = process.platform, env = process.env) {
  return Array.from({ length: 10 }, (_, i) =>
    platform === 'win32'
      ? `\\\\?\\pipe\\discord-ipc-${i}`
      : path.posix.join(env.XDG_RUNTIME_DIR || env.TMPDIR || env.TMP || '/tmp', `discord-ipc-${i}`),
  );
}
function frame(op, value) {
  const body = Buffer.isBuffer(value) ? value : Buffer.from(JSON.stringify(value));
  const out = Buffer.alloc(8 + body.length);
  out.writeUInt32LE(op);
  out.writeUInt32LE(body.length, 4);
  body.copy(out, 8);
  return out;
}
function createDiscordPresence({
  connect = (p) => net.createConnection(p),
  paths = ipcPaths(),
  onState = () => {},
  retryMs = 20000,
  updateMs = 15000,
} = {}) {
  let config = { enabled: true, shareWorkspace: true, applicationId: '' },
    workspace = 'editor',
    socket = null,
    ready = false,
    buffer = Buffer.alloc(0),
    retry = null,
    flush = null,
    timeout = null,
    generation = 0,
    stopped = false,
    index = 0,
    pending = null,
    lastSent = 0;
  const started = Math.floor(Date.now() / 1000);
  let state = {
    status: 'setup',
    message: 'Isi Discord Application ID untuk mengaktifkan Activity.',
  };
  const status = (code, message) => {
    state = { status: code, message };
    onState(getState());
  };
  const getState = () => ({ ...config, ...state });
  function disconnect(clearActivity = false) {
    clearTimeout(retry);
    clearTimeout(flush);
    clearTimeout(timeout);
    retry = flush = timeout = null;
    generation++;
    const wasReady = ready;
    ready = false;
    pending = null;
    buffer = Buffer.alloc(0);
    const old = socket;
    socket = null;
    if (old) {
      if (clearActivity && wasReady && old.writable)
        old.end(
          frame(1, {
            cmd: 'SET_ACTIVITY',
            args: { pid: process.pid, activity: null },
            nonce: randomUUID(),
          }),
          () => old.destroy(),
        );
      else old.destroy();
    }
  }
  function activity() {
    return {
      details: config.shareWorkspace ? WORKSPACES[workspace] : 'Creating with DITASHA Editor',
      state: 'Ditasha-Workshop',
      timestamps: { start: started },
      instance: false,
    };
  }
  function publish() {
    if (!ready || !socket?.writable || stopped) return;
    if (pending || Date.now() - lastSent < updateMs) {
      if (!flush)
        flush = setTimeout(
          () => {
            flush = null;
            publish();
          },
          Math.max(100, updateMs - (Date.now() - lastSent)),
        );
      flush?.unref?.();
      return;
    }
    pending = randomUUID();
    lastSent = Date.now();
    const active = socket;
    clearTimeout(timeout);
    timeout = setTimeout(() => active.destroy(), 5000);
    timeout.unref?.();
    socket.write(
      frame(1, {
        cmd: 'SET_ACTIVITY',
        args: { pid: process.pid, activity: activity() },
        nonce: pending,
      }),
    );
  }
  function start() {
    if (stopped || !config.enabled || !config.applicationId) return;
    const current = ++generation;
    index = 0;
    status('connecting', 'Menghubungkan ke Discord desktop…');
    function attempt() {
      if (current !== generation || stopped) return;
      if (index >= paths.length) {
        status('waiting', 'Buka Discord desktop; koneksi akan dicoba kembali otomatis.');
        retry = setTimeout(start, retryMs);
        retry.unref?.();
        return;
      }
      let active;
      try {
        active = connect(paths[index++]);
      } catch {
        attempt();
        return;
      }
      socket = active;
      ready = false;
      buffer = Buffer.alloc(0);
      let settled = false;
      const failed = () => {
        if (settled || current !== generation) return;
        settled = true;
        clearTimeout(timeout);
        active.destroy();
        if (socket === active) socket = null;
        if (ready) {
          ready = false;
          pending = null;
          status('waiting', 'Discord terputus; mencoba kembali otomatis.');
          retry = setTimeout(start, retryMs);
          retry.unref?.();
        } else attempt();
      };
      timeout = setTimeout(failed, 5000);
      timeout.unref?.();
      active.once('connect', () => {
        if (current === generation)
          active.write(frame(0, { v: 1, client_id: config.applicationId }));
      });
      active.on('error', failed);
      active.on('close', failed);
      active.on('data', (chunk) => {
        if (current !== generation || settled) return;
        try {
          buffer = Buffer.concat([buffer, chunk]);
          if (buffer.length > 1024 * 1024 + 8) throw Error('Frame too large');
          while (buffer.length >= 8) {
            const op = buffer.readUInt32LE(0),
              length = buffer.readUInt32LE(4);
            if (length > 1024 * 1024) throw Error('Frame too large');
            if (buffer.length < length + 8) break;
            const body = buffer.subarray(8, 8 + length);
            buffer = buffer.subarray(8 + length);
            if (op === 3) {
              active.write(frame(4, body));
              continue;
            }
            if (op === 2) {
              failed();
              break;
            }
            if (op !== 1) continue;
            const message = JSON.parse(body.toString('utf8'));
            if (message.evt === 'ERROR') {
              settled = true;
              disconnect();
              status(
                'error',
                'Discord menolak Activity. Periksa Application ID dan pengaturan Activity Privacy.',
              );
              return;
            }
            if (message.cmd === 'DISPATCH' && message.evt === 'READY') {
              clearTimeout(timeout);
              ready = true;
              lastSent = 0;
              publish();
            } else if (message.cmd === 'SET_ACTIVITY' && message.nonce === pending) {
              pending = null;
              clearTimeout(timeout);
              status(
                'connected',
                'Activity terkirim ke Discord. Tampilan profil mengikuti Activity Privacy Discord.',
              );
            }
          }
        } catch {
          failed();
        }
      });
    }
    attempt();
  }
  function configure(value) {
    config = validatePreferences(value);
    disconnect(true);
    if (!config.enabled) status('disabled', 'Discord Activity dimatikan.');
    else if (!config.applicationId)
      status('setup', 'Isi Discord Application ID untuk mengaktifkan Activity.');
    else start();
    return getState();
  }
  function setWorkspace(value) {
    if (!Object.hasOwn(WORKSPACES, value)) throw Error('Workspace tidak valid.');
    workspace = value;
    publish();
  }
  function close() {
    stopped = true;
    disconnect(true);
  }
  return { configure, setWorkspace, getState, close };
}
async function registerDiscordPresence({ app, ipcMain, shell, trusted }) {
  const file = path.join(app.getPath('userData'), 'discord-presence.json');
  const bundledId = require('../package.json').discordApplicationId || '';
  const applicationId = /^\d{17,20}$/.test(bundledId) ? bundledId : '';
  let preferences = { enabled: true, shareWorkspace: true, applicationId };
  try {
    if ((await fs.stat(file)).size <= 4096)
      preferences = validatePreferences(JSON.parse(await fs.readFile(file, 'utf8')));
  } catch {}
  if (!preferences.applicationId) preferences.applicationId = applicationId;
  const client = createDiscordPresence();
  client.configure(preferences);
  app.on('before-quit', () => client.close());
  ipcMain.handle('ditasha:discord-state', (event) => {
    trusted(event);
    return client.getState();
  });
  ipcMain.handle('ditasha:discord-configure', async (event, value) => {
    trusted(event);
    const next = validatePreferences(value);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file + '.tmp', JSON.stringify(next));
    await fs.rename(file + '.tmp', file);
    return client.configure(next);
  });
  ipcMain.handle('ditasha:discord-workspace', (event, value) => {
    trusted(event);
    client.setWorkspace(value);
    return true;
  });
  ipcMain.handle('ditasha:discord-docs', async (event) => {
    trusted(event);
    await shell.openExternal('https://discord.com/developers/applications');
    return true;
  });
  return client;
}
module.exports = {
  createDiscordPresence,
  registerDiscordPresence,
  validatePreferences,
  ipcPaths,
  frame,
};
