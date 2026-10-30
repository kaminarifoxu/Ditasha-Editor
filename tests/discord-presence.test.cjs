'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const net = require('node:net');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const {
  createDiscordPresence,
  registerDiscordPresence,
  validatePreferences,
  ipcPaths,
  frame,
} = require('../electron/discord-presence.cjs');
const config = { enabled: true, shareWorkspace: true, applicationId: '123456789012345678' };
const wait = async (fn) => {
  const end = Date.now() + 2500;
  while (!fn()) {
    if (Date.now() > end) throw Error('Discord fixture timeout');
    await new Promise((r) => setTimeout(r, 5));
  }
};
const socketPath = () =>
  process.platform === 'win32'
    ? `\\\\?\\pipe\\ditasha-test-${process.pid}-${Math.random().toString(16).slice(2)}`
    : path.join(
        os.tmpdir(),
        `ditasha-rpc-${process.pid}-${Math.random().toString(16).slice(2)}.sock`,
      );
async function mockDiscord(t, onPacket) {
  const sockets = new Set(),
    location = socketPath();
  const server = net.createServer((socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
    socket.on('error', () => {});
    let buffer = Buffer.alloc(0);
    socket.on('data', (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);
      while (buffer.length >= 8) {
        const op = buffer.readUInt32LE(),
          length = buffer.readUInt32LE(4);
        if (buffer.length < length + 8) return;
        const body = buffer.subarray(8, length + 8);
        buffer = buffer.subarray(length + 8);
        onPacket(socket, op, JSON.parse(body.toString()));
      }
    });
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(location, resolve);
  }).catch((error) => {
    if (['EPERM', 'EACCES'].includes(error.code)) {
      t.skip('Local socket unavailable in this environment');
    } else throw error;
  });
  if (!server.listening) return null;
  t.after(async () => {
    for (const socket of sockets) socket.destroy();
    await new Promise((resolve) => server.close(resolve));
  });
  return { location, sockets };
}
test('Discord preferences require a public application ID and a known workspace', () => {
  assert.equal(validatePreferences(config).applicationId, config.applicationId);
  assert.equal(ipcPaths('win32', {})[0], '\\\\?\\pipe\\discord-ipc-0');
  assert.equal(
    ipcPaths('linux', { XDG_RUNTIME_DIR: '/run/user/1000' })[9],
    '/run/user/1000/discord-ipc-9',
  );
  for (const value of [
    { ...config, applicationId: 'token.secret' },
    { ...config, applicationId: '../path' },
    { ...config, enabled: 'yes' },
    { ...config, applicationId: '1'.repeat(50) },
  ])
    assert.throws(() => validatePreferences(value));
  const client = createDiscordPresence();
  assert.throws(() => client.setWorkspace('private-file.ytd'));
  client.close();
});
test('Real local Discord IPC handles split frames, ping, throttled activity, reconnect and clearing', async (t) => {
  const packets = [];
  const mock = await mockDiscord(t, (socket, op, data) => {
    packets.push({ op, data });
    if (op === 0) {
      assert.deepEqual(data, { v: 1, client_id: config.applicationId });
      const ready = frame(1, { cmd: 'DISPATCH', evt: 'READY', data: {} });
      socket.write(ready.subarray(0, 5));
      setTimeout(() => {
        if (!socket.destroyed) socket.write(ready.subarray(5));
      }, 1);
    }
    if (op === 1 && data.cmd === 'SET_ACTIVITY' && data.args.activity)
      socket.write(
        Buffer.concat([
          frame(1, { cmd: 'SET_ACTIVITY', nonce: data.nonce, data: {} }),
          frame(3, { ping: 42 }),
        ]),
      );
  });
  if (!mock) return;
  const client = createDiscordPresence({
    paths: [socketPath(), mock.location],
    retryMs: 20,
    updateMs: 25,
  });
  t.after(() => client.close());
  client.configure(config);
  await wait(() => client.getState().status === 'connected' && packets.some((p) => p.op === 4));
  const first = packets.find((p) => p.data.args?.activity).data.args.activity;
  assert.equal(first.details, 'Texture & Model');
  assert.ok(first.timestamps.start > 0);
  assert.equal(first.state, 'Ditasha-Workshop');
  for (let i = 0; i < 10; i++) client.setWorkspace(i === 9 ? 'vehicles' : 'archives');
  await wait(() => packets.some((p) => p.data.args?.activity?.details === 'Vehicle workshop'));
  assert.ok(
    packets.filter((p) => p.data.args?.activity).length <= 3,
    'Workspace updates must be coalesced',
  );
  assert.deepEqual(packets.find((p) => p.op === 4).data, { ping: 42 });
  for (const socket of mock.sockets) socket.destroy();
  await wait(
    () => packets.filter((p) => p.op === 0).length >= 2 && client.getState().status === 'connected',
  );
  const last = packets.filter((p) => p.data.args?.activity).at(-1).data.args.activity;
  assert.equal(last.timestamps.start, first.timestamps.start);
  client.configure({ ...config, enabled: false });
  await wait(() => packets.some((p) => p.data.args?.activity === null));
  assert.equal(client.getState().status, 'disabled');
  client.configure({ ...config, shareWorkspace: false });
  await wait(() =>
    packets.some((p) => p.data.args?.activity?.details === 'Creating with DITASHA Editor'),
  );
  client.close();
});
test('Discord IPC refuses oversized frames without crashing the editor', async (t) => {
  const mock = await mockDiscord(t, (socket, op) => {
    if (op === 0) {
      const header = Buffer.alloc(8);
      header.writeUInt32LE(1);
      header.writeUInt32LE(2 * 1024 * 1024, 4);
      socket.write(header);
    }
  });
  if (!mock) return;
  const client = createDiscordPresence({ paths: [mock.location], retryMs: 1000 });
  t.after(() => client.close());
  client.configure(config);
  await wait(() => client.getState().status === 'waiting');
});
test('Discord preferences persist and settings IPC checks trusted callers', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ditasha-discord-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const handlers = new Map();
  const register = () =>
    registerDiscordPresence({
      app: { getPath: () => root, on: () => {} },
      ipcMain: { handle: (id, fn) => handlers.set(id, fn) },
      shell: { openExternal: async () => {} },
      trusted: (event) => {
        if (!event?.trusted) throw Error('untrusted');
      },
    });
  const client = await register();
  t.after(() => client.close());
  assert.throws(() => handlers.get('ditasha:discord-state')({}), /untrusted/);
  await handlers.get('ditasha:discord-configure')({ trusted: true }, { ...config, enabled: false });
  const second = await register();
  t.after(() => second.close());
  assert.equal(second.getState().applicationId, config.applicationId);
  assert.equal(second.getState().status, 'disabled');
  assert.throws(
    () => handlers.get('ditasha:discord-workspace')({ trusted: true }, '/private/file.yft'),
    /Workspace/,
  );
});

test('Discord activity protocol is validated with an in-memory Discord peer', async (t) => {
  const { EventEmitter } = require('node:events');
  const packets = [],
    sockets = [];
  const connect = () => {
    const socket = new EventEmitter();
    socket.writable = true;
    sockets.push(socket);
    socket.destroy = () => {
      if (!socket.writable) return;
      socket.writable = false;
      queueMicrotask(() => socket.emit('close'));
    };
    socket.write = (bytes) => {
      const op = bytes.readUInt32LE(),
        body = JSON.parse(bytes.subarray(8).toString());
      packets.push({ op, body });
      if (op === 0)
        queueMicrotask(() => {
          const ready = frame(1, { cmd: 'DISPATCH', evt: 'READY' });
          socket.emit('data', ready.subarray(0, 3));
          socket.emit('data', ready.subarray(3));
        });
      if (op === 1 && body.args.activity)
        queueMicrotask(() =>
          socket.emit(
            'data',
            Buffer.concat([
              frame(1, { cmd: 'SET_ACTIVITY', nonce: body.nonce }),
              frame(3, { ping: 7 }),
            ]),
          ),
        );
      return true;
    };
    socket.end = (bytes, callback) => {
      socket.write(bytes);
      callback?.();
    };
    queueMicrotask(() => socket.emit('connect'));
    return socket;
  };
  const client = createDiscordPresence({
    connect,
    paths: ['local-only'],
    updateMs: 10,
    retryMs: 10,
  });
  t.after(() => client.close());
  client.configure(config);
  await wait(() => client.getState().status === 'connected' && packets.some((p) => p.op === 4));
  assert.equal(packets[0].body.client_id, config.applicationId);
  client.setWorkspace('vehicles');
  await wait(() => packets.some((p) => p.body.args?.activity?.details === 'Vehicle workshop'));
  client.setProject('C:\\Users\\Private\\GANOMABI-ped');
  await wait(() => packets.some((p) => p.body.args?.activity?.state === 'Proyek: GANOMABI-ped'));
  assert(!JSON.stringify(packets.at(-1)).includes('Private'), 'Folder paths must not be shared');
  client.configure({ ...config, shareProject: false });
  await wait(
    () =>
      packets.filter((p) => p.body.args?.activity).at(-1)?.body.args.activity.state ===
      'Ditasha-Workshop',
  );
  sockets.at(-1).destroy();
  await wait(() => sockets.length >= 3 && client.getState().status === 'connected');
  client.configure({ ...config, enabled: false });
  assert.equal(packets.at(-1).body.args.activity, null);
  assert.equal(client.getState().status, 'disabled');
});
