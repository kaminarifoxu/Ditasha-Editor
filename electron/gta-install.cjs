'use strict';
const fs = require('node:fs/promises');
const { constants } = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const native = /\.(ymap|ytyp|ydr|ydd|ytd)$/i;
const inside = (root, target) => {
  const rel = path.relative(root, target);
  return !path.isAbsolute(rel) && rel !== '..' && !rel.startsWith('..' + path.sep);
};
function createGtaInstall({ app, dialog, win, shell }) {
  const config = path.join(app.getPath('userData'), 'gta-install.json');
  let root = null,
    edition = '',
    entries = new Map(),
    scanned = false,
    loading;
  async function validate(folder) {
    const base = await fs.realpath(folder);
    let variant = '';
    for (const [exe, name] of [
      ['GTA5.exe', 'Legacy'],
      ['GTA5_Enhanced.exe', 'Enhanced'],
    ]) {
      try {
        if ((await fs.stat(path.join(base, exe))).isFile()) variant = name;
      } catch {}
      if (variant) break;
    }
    let archive = false;
    for (const p of ['common.rpf', path.join('update', 'update.rpf')]) {
      try {
        archive ||= (await fs.stat(path.join(base, p))).isFile();
      } catch {}
    }
    if (!variant || !archive)
      throw Error(
        'Pilih folder utama GTA V yang berisi GTA5.exe/GTA5_Enhanced.exe dan common.rpf atau update/update.rpf.',
      );
    return { root: base, edition: variant };
  }
  async function init() {
    if (!loading)
      loading = (async () => {
        try {
          const saved = JSON.parse(await fs.readFile(config, 'utf8'));
          const v = await validate(saved.root);
          root = v.root;
          edition = v.edition;
        } catch {}
      })();
    await loading;
  }
  async function state() {
    await init();
    return {
      root,
      edition,
      scanned,
      archives: [...entries.values()].filter((e) => e.kind === 'rpf').length,
      maps: [...entries.values()].filter((e) => e.kind === 'ymap').length,
      message: root
        ? 'Folder terhubung · baca saja. Map dalam RPF terenkripsi belum dapat dimuat.'
        : 'Belum memilih instalasi GTA V.',
    };
  }
  async function choose() {
    await init();
    const result = await dialog.showOpenDialog(win, {
      title: 'Pilih folder instalasi GTA V',
      properties: ['openDirectory'],
      defaultPath: root || undefined,
    });
    if (result.canceled || !result.filePaths?.[0]) return state();
    const v = await validate(result.filePaths[0]);
    await fs.mkdir(path.dirname(config), { recursive: true });
    const temp = config + '.' + randomUUID() + '.tmp';
    try {
      await fs.writeFile(temp, JSON.stringify(v), { flag: 'wx' });
      await fs.rename(temp, config);
    } finally {
      await fs.rm(temp, { force: true }).catch(() => {});
    }
    root = v.root;
    edition = v.edition;
    entries.clear();
    scanned = false;
    return state();
  }
  async function scan() {
    await init();
    if (!root) throw Error('Pilih instalasi GTA V di Pengaturan terlebih dahulu.');
    await validate(root);
    const base = root,
      next = new Map();
    let count = 0;
    async function walk(dir, depth) {
      if (depth > 16) throw Error('Folder GTA terlalu dalam.');
      for (const item of await fs.readdir(dir, { withFileTypes: true })) {
        if (++count > 150000) throw Error('Pemindaian melewati 150.000 entri.');
        if (item.isSymbolicLink()) continue;
        const full = path.join(dir, item.name);
        if (item.isDirectory()) {
          if (!['.git', 'node_modules'].includes(item.name)) await walk(full, depth + 1);
          continue;
        }
        if (!item.isFile() || !(/\.rpf$/i.test(item.name) || native.test(item.name))) continue;
        const stat = await fs.stat(full),
          relative = path.relative(base, full).split(path.sep).join('/');
        next.set(randomUUID(), {
          path: relative,
          size: stat.size,
          modified: stat.mtimeMs,
          ino: stat.ino,
          kind: path.extname(item.name).slice(1).toLowerCase(),
        });
        if (next.size > 30000)
          throw Error('Terlalu banyak aset GTA; gunakan folder resource terpisah.');
      }
    }
    await walk(base, 0);
    if (root !== base) throw Error('Instalasi berubah. Pindai ulang.');
    entries = next;
    scanned = true;
    return {
      ...(await state()),
      files: [...entries].map(([id, e]) => ({ id, path: e.path, size: e.size, kind: e.kind })),
    };
  }
  async function read(id, start, length) {
    const e = entries.get(id);
    if (
      !root ||
      !e ||
      !Number.isSafeInteger(start) ||
      !Number.isSafeInteger(length) ||
      start < 0 ||
      length < 0 ||
      length > 1024 ** 2 ||
      start + length > e.size
    )
      throw Error('Rentang baca aset GTA tidak valid.');
    const full = path.join(root, ...e.path.split('/'));
    if (!inside(root, await fs.realpath(full)) || (await fs.lstat(full)).isSymbolicLink())
      throw Error('Aset berada di luar instalasi.');
    const handle = await fs.open(full, constants.O_RDONLY | (constants.O_NOFOLLOW || 0));
    try {
      const stat = await handle.stat();
      if (
        !stat.isFile() ||
        stat.size !== e.size ||
        stat.mtimeMs !== e.modified ||
        stat.ino !== e.ino
      )
        throw Error('Aset berubah. Pindai ulang instalasi.');
      const bytes = Buffer.alloc(length);
      const r = await handle.read(bytes, 0, length, start);
      if (r.bytesRead !== length) throw Error('Aset GTA terpotong.');
      return new Uint8Array(bytes);
    } finally {
      await handle.close();
    }
  }
  async function reveal() {
    await init();
    if (!root) throw Error('Pilih folder GTA terlebih dahulu.');
    await validate(root);
    const error = await shell.openPath(root);
    if (error) throw Error(error);
  }
  return { state, choose, scan, read, reveal };
}
function registerGtaInstall(options) {
  const manager = createGtaInstall(options);
  for (const method of ['state', 'choose', 'scan', 'read', 'reveal'])
    options.ipcMain.handle('ditasha:gta-install-' + method, (event, ...args) => {
      options.trusted(event);
      return manager[method](...args);
    });
  return manager;
}
module.exports = { createGtaInstall, registerGtaInstall };
