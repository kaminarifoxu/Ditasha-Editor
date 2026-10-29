'use strict';
const test = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('node:fs/promises'),
  os = require('node:os'),
  path = require('node:path');
const { createGtaInstall, registerGtaInstall } = require('../electron/gta-install.cjs');
test('GTA installation validates, persists, scans lazily and refuses changed/unselected paths', async (t) => {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), 'ditasha-gta-'));
  t.after(() => fs.rm(base, { recursive: true, force: true }));
  const game = path.join(base, 'game'),
    data = path.join(base, 'data');
  await fs.mkdir(game);
  await fs.writeFile(path.join(game, 'GTA5.exe'), 'fake-not-run');
  await fs.writeFile(path.join(game, 'common.rpf'), 'header');
  await fs.mkdir(path.join(game, 'stream'));
  await fs.writeFile(path.join(game, 'stream', 'room.ymap'), 'map');
  await fs.writeFile(path.join(game, 'secret.txt'), 'not exposed');
  let choice = game;
  const deps = {
    app: { getPath: () => data },
    dialog: { showOpenDialog: async () => ({ filePaths: [choice] }) },
    shell: { openPath: async () => '' },
  };
  const manager = createGtaInstall(deps);
  assert.equal((await manager.state()).root, null);
  assert.equal((await manager.choose()).edition, 'Legacy');
  const restarted = createGtaInstall(deps);
  assert.equal((await restarted.state()).root, game);
  const catalog = await restarted.scan();
  assert.equal(catalog.maps, 1);
  assert.equal(catalog.archives, 1);
  assert(!catalog.files.some((e) => e.path === 'secret.txt'));
  const entry = catalog.files.find((e) => e.kind === 'ymap');
  assert.equal(Buffer.from(await restarted.read(entry.id, 0, 3)).toString(), 'map');
  await assert.rejects(restarted.read('../secret.txt', 0, 1), /invalid|valid/);
  await assert.rejects(restarted.read(entry.id, 0, 2 ** 21), /valid/);
  await fs.writeFile(path.join(game, 'stream', 'room.ymap'), 'changed');
  await assert.rejects(restarted.read(entry.id, 0, 3), /berubah/);
  choice = base;
  await assert.rejects(restarted.choose(), /folder utama/);
  assert.equal((await restarted.state()).root, game);
  assert.equal(await fs.readFile(path.join(game, 'GTA5.exe'), 'utf8'), 'fake-not-run');
});
test('GTA installation read rejects symlinks and every IPC checks renderer trust', async (t) => {
  const handlers = new Map();
  registerGtaInstall({
    app: { getPath: () => os.tmpdir() },
    ipcMain: { handle: (n, f) => handlers.set(n, f) },
    trusted: () => {
      throw Error('untrusted');
    },
  });
  assert.equal(handlers.size, 5);
  for (const fn of handlers.values()) assert.throws(() => fn({}), /untrusted/);
  const base = await fs.mkdtemp(path.join(os.tmpdir(), 'ditasha-gta-link-'));
  t.after(() => fs.rm(base, { recursive: true, force: true }));
  const game = path.join(base, 'game');
  await fs.mkdir(game);
  await fs.writeFile(path.join(game, 'GTA5.exe'), 'fake');
  await fs.writeFile(path.join(game, 'common.rpf'), 'rpf');
  await fs.writeFile(path.join(game, 'room.ymap'), 'map');
  await fs.writeFile(path.join(base, 'outside.ymap'), 'external');
  const m = createGtaInstall({
    app: { getPath: () => path.join(base, 'data') },
    dialog: { showOpenDialog: async () => ({ filePaths: [game] }) },
  });
  await m.choose();
  const e = (await m.scan()).files.find((e) => e.kind === 'ymap');
  await fs.unlink(path.join(game, 'room.ymap'));
  try {
    await fs.symlink(path.join(base, 'outside.ymap'), path.join(game, 'room.ymap'));
  } catch (error) {
    if (error.code === 'EPERM') {
      t.skip('Symlink privilege unavailable');
      return;
    }
    throw error;
  }
  await assert.rejects(m.read(e.id, 0, 3), /luar/);
});
