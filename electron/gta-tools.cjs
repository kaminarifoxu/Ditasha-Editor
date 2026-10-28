'use strict';
const fs = require('node:fs/promises');
const { createReadStream } = require('node:fs');
const path = require('node:path');
const { createHash, randomUUID } = require('node:crypto');
const { spawn } = require('node:child_process');
const SPECS = {
  moddrop: {
    name: 'ModDropV',
    version: '2.0.1',
    archive: 'zip',
    bytes: 69391409,
    sha256: '4be6a429e77d7d6699a5bdbbd072bb616eb649e7d9763636f725d814e334b538',
    folder: '',
    gui: 'ModDropV.exe',
    cli: 'mdvctl.exe',
    files: {
      'ModDropV.exe': '199747c6b5c1bac1e6db1a69091c9f121f17038b577a3f6de650cbd664ec88eb',
      'ModDropV.dll': '8c55ed573bf5480978c661341db9fb18e3e79faf202cdda4dbf059ee174e50e0',
      'mdvctl.exe': 'bccce35c828398b553bfe9fe9f4b60bf314197c73a6faeef40810ac9699dc1e9',
      'mdvctl.dll': '5c5ec0ad5a5b214e6c10bfdc2fa5604f787ea3824242f5d1116c4e0c4db6625c',
    },
  },
  weapons: {
    name: 'AddonWeaponsBuilder',
    version: '2.0.0',
    archive: 'zip',
    bytes: 66732285,
    sha256: '06cc1683c60cfed372707f121714106a1ffd7de8d3f4c82ec5c24d61e84f7b68',
    folder: 'AddonWeaponsBuilder',
    gui: 'AddonWeaponsBuilder.exe',
    cli: 'awbctl.exe',
    url: 'https://github.com/sruckstar/AddonWeaponsBuilder/releases/download/2.0.0/AddonWeaponsBuilder-2.0.0-win-x64.zip',
    files: {
      'AddonWeaponsBuilder.exe': '84b25ad15fb3478d42431d741127690f5fc5cba97b449a0b91ee6071aecc8d5c',
      'AddonWeaponsBuilder.dll': 'a09a6ed82789ab25bf8101868649900dca7a585b37a122bfa0fd645c29fdd05a',
      'awbctl.exe': '90b4aa3393449472c6b657b874fcc5cd266f82ac1e79ec832d3327d3b9ad5b50',
      'awbctl.dll': '1378e70bd571c5b26cca21bc6d9df8d6de3443eb1971ca9edaeb1df32859da1f',
    },
  },
  trium: {
    name: 'TRIUM Skeleton Studio Free',
    version: '1.0',
    archive: 'rar',
    bytes: 62559018,
    sha256: '4ca8e395ad0a36f03e2f0aac88558c7ece0e559af9d5423037415967f3a70b5c',
    folder: '',
    gui: 'TRIUM Skeleton Studio Free.exe',
    files: {
      'TRIUM Skeleton Studio Free.exe':
        'c3a7c84bf96425106c125dfdb7209e27665cc4f001bdfb8b998b0c03f49a9daf',
    },
  },
};
async function digest(file) {
  const h = createHash('sha256');
  for await (const b of createReadStream(file)) h.update(b);
  return h.digest('hex');
}
function specFor(id, specs = SPECS) {
  if (!Object.hasOwn(specs, id)) throw Error('Tool tidak dikenal.');
  return specs[id];
}
function text(value, label, max = 100) {
  const s = String(value || '').trim();
  if (
    s.length > max ||
    /[\x00-\x1f]/.test(s) ||
    s.startsWith('-') ||
    /[<>:"/\\|?*]/.test(s) ||
    s === '.' ||
    s === '..'
  )
    throw Error(label + ' tidak valid.');
  return s;
}
function identifier(value, label) {
  const s = text(value, label, 64);
  if (s && !/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(s))
    throw Error(label + ' hanya huruf, angka, underscore dan tanda hubung.');
  return s;
}
function command(id, action, values, source, output, toolRoot) {
  const v = values || {},
    edition = v.edition || 'legacy';
  if (!['legacy', 'enhanced'].includes(edition)) throw Error('Pilih Legacy atau Enhanced.');
  const name = text(v.name, 'Nama'),
    model = identifier(v.model, 'Nama model'),
    base = identifier(v.base, 'Base model');
  if (id === 'weapons') {
    if (!['scan', 'plan', 'build'].includes(action)) throw Error('Aksi weapons tidak didukung.');
    const args = [action, path.join(toolRoot, 'data', 'templates'), source];
    if (action === 'build') args.push(output, '--edition', edition);
    if (action !== 'scan') {
      if (name) args.push('--name', name);
      const price = Number(v.price ?? 5000);
      if (!Number.isSafeInteger(price) || price < 0 || price > 2147483647)
        throw Error('Harga tidak valid.');
      args.push('--price', String(price));
      if (action === 'build' && model) args.push('--model-name', model);
    }
    return args;
  }
  if (id === 'moddrop') {
    if (!['vehicle', 'ped', 'prop', 'clothing'].includes(action))
      throw Error('Jenis DLC tidak didukung.');
    const args = ['build-' + action, source, output, '--edition', edition];
    if (action === 'vehicle') {
      if (!base) throw Error('Isi base kendaraan, misalnya adder.');
      args.push('--base', base);
    }
    if (action === 'ped' && base) args.push('--base', base);
    if (['vehicle', 'ped'].includes(action) && model) args.push('--model-name', model);
    if (['vehicle', 'prop', 'clothing'].includes(action) && name) args.push('--name', name);
    if (action === 'clothing' && v.female) args.push('--female');
    return args;
  }
  throw Error('TRIUM dibuka melalui aplikasi desktop aslinya.');
}
function execute(file, args, { cwd, signal, log = () => {}, timeout = 15 * 60 * 1000 } = {}) {
  return new Promise((resolve, reject) => {
    let settled = false,
      output = '';
    const child = spawn(file, args, { cwd, shell: false, windowsHide: true, signal });
    const timer = setTimeout(() => child.kill(), timeout);
    const finish = (error, code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      error
        ? reject(error)
        : code === 0
          ? resolve(output)
          : reject(Error('Tool berhenti dengan kode ' + code + '. Lihat log.'));
    };
    for (const stream of [child.stdout, child.stderr])
      stream.on('data', (b) => {
        const s = b.toString('utf8');
        output = (output + s).slice(-2 * 1024 * 1024);
        log(s);
      });
    child.on('error', (e) => finish(e));
    child.on('close', (code) => finish(null, code));
  });
}
async function downloadPackage(spec, file, signal, log, fetcher = fetch) {
  const res = await fetcher(spec.url, {
    signal: AbortSignal.any([signal, AbortSignal.timeout(15 * 60 * 1000)]),
  });
  if (!res.ok || !res.body) throw Error('Unduhan gagal: HTTP ' + res.status);
  const handle = await fs.open(file, 'wx');
  let size = 0;
  let last = 0;
  try {
    for await (const chunk of res.body) {
      size += chunk.length;
      if (size > spec.bytes) throw Error('Ukuran unduhan tidak cocok.');
      await handle.writeFile(chunk);
      if (size - last > 4 * 1024 * 1024) {
        log('Unduh ' + Math.floor((size / spec.bytes) * 100) + '%\n');
        last = size;
      }
    }
  } finally {
    await handle.close();
  }
}
function createGtaTools({
  root,
  platform = process.platform,
  specs = SPECS,
  run = execute,
  notify = () => {},
  fetcher = fetch,
}) {
  let active = null,
    log = '',
    message = 'Siap.',
    result = null;
  const folder = (id) => path.join(root, id, 'current');
  function emit() {
    notify({ busy: !!active, message, log, result });
  }
  function append(s) {
    log = (log + String(s)).slice(-256 * 1024);
    emit();
  }
  async function verify(id, dir) {
    const spec = specFor(id, specs),
      base = path.join(dir, spec.folder);
    for (const [name, hash] of Object.entries(spec.files))
      if ((await digest(path.join(base, name))) !== hash)
        throw Error('Checksum ' + name + ' tidak cocok. Pasang ulang paket asli.');
    return base;
  }
  async function state() {
    const tools = [];
    for (const [id, spec] of Object.entries(specs)) {
      let ready = false;
      try {
        const record = JSON.parse(await fs.readFile(path.join(folder(id), 'ready.json'), 'utf8'));
        ready = record.version === spec.version && record.sha256 === spec.sha256;
      } catch {}
      tools.push({
        id,
        name: spec.name,
        version: spec.version,
        installed: ready,
        cli: !!spec.cli,
        download: !!spec.url,
      });
    }
    return { supported: platform === 'win32', tools, busy: !!active, message, log, result };
  }
  async function job(label, fn) {
    if (platform !== 'win32') throw Error('Tools desktop ini memerlukan Windows x64.');
    if (active) throw Error('Tunggu proses aktif selesai atau tekan Hentikan.');
    const controller = new AbortController();
    active = controller;
    log = '';
    message = label;
    result = null;
    emit();
    try {
      const value = await fn(controller.signal);
      message = 'Selesai.';
      return value;
    } catch (e) {
      message = controller.signal.aborted ? 'Dihentikan.' : e.message;
      append(message + '\n');
      throw e;
    } finally {
      active = null;
      emit();
    }
  }
  async function promote(id, unpacked) {
    const spec = specFor(id, specs);
    await fs.writeFile(
      path.join(unpacked, 'ready.json'),
      JSON.stringify({ id, version: spec.version, sha256: spec.sha256 }),
    );
    const current = folder(id),
      backup = current + '.backup';
    await fs.rm(backup, { recursive: true, force: true });
    let had = false;
    try {
      await fs.rename(current, backup);
      had = true;
    } catch (e) {
      if (e.code !== 'ENOENT') throw e;
    }
    try {
      await fs.rename(unpacked, current);
    } catch (e) {
      if (had) await fs.rename(backup, current);
      throw e;
    }
    await fs.rm(backup, { recursive: true, force: true });
  }
  async function install(id, file, { download = false } = {}) {
    const spec = specFor(id, specs);
    return job('Memasang ' + spec.name + '…', async (signal) => {
      await fs.mkdir(path.join(root, id), { recursive: true });
      const temp = await fs.mkdtemp(path.join(root, id, 'stage-'));
      const archive = path.join(temp, 'package.' + spec.archive),
        unpacked = path.join(temp, 'unpacked');
      try {
        if (download) {
          if (!spec.url) throw Error('Pilih paket asli tool ini.');
          await downloadPackage(spec, archive, signal, append, fetcher);
        } else {
          if (!file) throw Error('Paket tidak dipilih.');
          if ((await fs.stat(file)).size !== spec.bytes)
            throw Error('Ukuran paket tidak cocok untuk versi ' + spec.version + '.');
          await fs.copyFile(file, archive);
        }
        if ((await fs.stat(archive)).size !== spec.bytes || (await digest(archive)) !== spec.sha256)
          throw Error('Paket tidak cocok dengan versi terverifikasi ' + spec.version + '.');
        await fs.mkdir(unpacked);
        await run('tar.exe', ['-xf', archive, '-C', unpacked], {
          signal,
          log: append,
          timeout: 120000,
        });
        const base = await verify(id, unpacked);
        if (spec.cli)
          await run(path.join(base, spec.cli), ['--help'], {
            cwd: base,
            signal,
            log: append,
            timeout: 30000,
          });
        await promote(id, unpacked);
        return state();
      } finally {
        await fs.rm(temp, { recursive: true, force: true });
      }
    });
  }
  async function executable(id) {
    const spec = specFor(id, specs);
    const base = await verify(id, folder(id));
    return { spec, base };
  }
  return {
    state,
    install,
    async installExe(file) {
      const id = 'trium',
        spec = specFor(id, specs);
      return job('Memasang ' + spec.name + '…', async () => {
        await fs.mkdir(path.join(root, id), { recursive: true });
        const temp = await fs.mkdtemp(path.join(root, id, 'stage-'));
        try {
          await fs.copyFile(file, path.join(temp, spec.gui));
          await verify(id, temp);
          await promote(id, temp);
          return state();
        } finally {
          await fs.rm(temp, { recursive: true, force: true });
        }
      });
    },
    cancel() {
      active?.abort();
      return { cancelled: !!active };
    },
    async gui(id) {
      const { spec, base } = await executable(id);
      return { file: path.join(base, spec.gui), cwd: base };
    },
    async run(id, action, values, source, outputParent) {
      return job('Menjalankan ' + specFor(id, specs).name + '…', async (signal) => {
        const { spec, base } = await executable(id);
        if (!spec.cli) throw Error('Tool ini tidak menyediakan CLI.');
        const stat = await fs.stat(source);
        if (!stat.isDirectory()) throw Error('Pilih folder sumber.');
        const build = id === 'moddrop' || action === 'build';
        let output = null;
        // Validate every option before creating an output directory.
        command(id, action, values, source, 'OUTPUT', base);
        if (build) {
          if (!outputParent || !(await fs.stat(outputParent)).isDirectory())
            throw Error('Pilih folder hasil.');
          const realSource = await fs.realpath(source),
            realOut = await fs.realpath(outputParent);
          const relative = path.relative(realSource, realOut);
          if (
            relative === '' ||
            (!relative.startsWith('..' + path.sep) &&
              relative !== '..' &&
              !path.isAbsolute(relative))
          )
            throw Error('Folder hasil harus berada di luar folder sumber.');
          output = path.join(
            outputParent,
            'DITASHA-' + id + '-' + action + '-' + randomUUID().slice(0, 8),
          );
          await fs.mkdir(output);
        }
        const args = command(id, action, values, source, output, base);
        append(spec.name + ' ' + spec.version + ' · ' + action + '\n');
        try {
          await run(path.join(base, spec.cli), args, { cwd: base, signal, log: append });
          result = { id, action, output, success: true };
          if (output)
            await fs.writeFile(
              path.join(output, 'ditasha-tool-report.json'),
              JSON.stringify({ ...result, version: spec.version }, null, 2),
            );
          return result;
        } catch (e) {
          result = { id, action, output, success: false };
          if (output)
            await fs
              .writeFile(
                path.join(output, 'ditasha-tool-report.json'),
                JSON.stringify({ ...result, error: e.message }, null, 2),
              )
              .catch(() => {});
          throw e;
        }
      });
    },
  };
}
function registerGtaTools({ app, ipcMain, dialog, win, trusted, shell }) {
  const tools = createGtaTools({
    root: path.join(app.getPath('userData'), 'gta-tools'),
    notify: (s) => {
      if (!win.isDestroyed()) win.webContents.send('ditasha:gta-tools-progress', s);
    },
  });
  const chosen = new Set();
  const handle = (name, fn) =>
    ipcMain.handle('ditasha:gta-tools-' + name, async (e, ...args) => {
      trusted(e);
      return fn(...args);
    });
  app.once?.('before-quit', () => tools.cancel());
  handle('state', () => tools.state());
  handle('install', async (id, download = false) => {
    const spec = specFor(id);
    if (download) return tools.install(id, null, { download: true });
    const pick = await dialog.showOpenDialog(win, {
      title: 'Pilih paket ' + spec.name + ' ' + spec.version,
      properties: ['openFile'],
      filters: [{ name: spec.name, extensions: [spec.archive] }],
    });
    if (pick.canceled || !pick.filePaths[0]) return { cancelled: true };
    return tools.install(id, pick.filePaths[0]);
  });
  handle('choose', async (kind) => {
    if (!['source', 'output'].includes(kind)) throw Error('Jenis folder tidak valid.');
    const pick = await dialog.showOpenDialog(win, {
      title: kind === 'source' ? 'Folder sumber mod' : 'Folder hasil DLC',
      properties: ['openDirectory', ...(kind === 'output' ? ['createDirectory'] : [])],
    });
    if (pick.canceled || !pick.filePaths[0]) return null;
    const p = await fs.realpath(pick.filePaths[0]);
    chosen.add(p);
    return p;
  });
  handle('run', async ({ id, action, values, source, output } = {}) => {
    if (!chosen.has(source) || (output && !chosen.has(output)))
      throw Error('Pilih folder melalui tombol DITASHA.');
    const r = await tools.run(id, action, values, source, output);
    return r;
  });
  handle('exe', async () => {
    const pick = await dialog.showOpenDialog(win, {
      title: 'Pilih TRIUM Skeleton Studio Free.exe',
      properties: ['openFile'],
      filters: [{ name: 'TRIUM Free 1.0', extensions: ['exe'] }],
    });
    if (pick.canceled || !pick.filePaths[0]) return { cancelled: true };
    return tools.installExe(pick.filePaths[0]);
  });
  handle('cancel', () => tools.cancel());
  handle('gui', async (id) => {
    const target = await tools.gui(id);
    const error = await shell.openPath(target.file);
    if (error) throw Error(error);
    return { opened: true };
  });
  handle('output', async () => {
    const output = (await tools.state()).result?.output;
    if (!output) throw Error('Belum ada hasil build.');
    const error = await shell.openPath(output);
    if (error) throw Error(error);
    return { opened: true };
  });
  return tools;
}
module.exports = {
  SPECS,
  digest,
  command,
  execute,
  downloadPackage,
  createGtaTools,
  registerGtaTools,
};
