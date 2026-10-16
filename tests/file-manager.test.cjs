'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { EventEmitter } = require('node:events');
const { classifyAssets } = require('../electron/asset-sort.cjs');
const { createFileManager, registerFileManager } = require('../electron/file-manager.cjs');
async function fixture(t, entries, onState) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ditasha-files-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const source = path.join(root, 'source'),
    output = path.join(root, 'output');
  await fs.mkdir(source);
  await fs.mkdir(output);
  for (const [relative, data] of Object.entries(entries)) {
    await fs.mkdir(path.dirname(path.join(source, relative)), { recursive: true });
    await fs.writeFile(path.join(source, relative), data);
  }
  const choices = [source],
    revealed = [];
  const api = createFileManager({
    dialog: {
      showOpenDialog: async () => {
        const next = choices.shift();
        return { canceled: !next, filePaths: next ? [next] : [] };
      },
    },
    shell: {
      openPath: async (p) => {
        revealed.push(p);
        return '';
      },
      showItemInFolder: (p) => revealed.push(p),
    },
    onState,
  });
  await api.choose();
  return { api, source, output, choices, revealed };
}
test('Sorting identifies clothing variants and vehicle pairs, while ambiguous models remain reviewable', () => {
  const paths = [
    'a/logo.PNG',
    'b/logo.PNG',
    'stream/mp_f_freemode_01^jbib_003_u.ydd',
    'stream/mp_f_freemode_01^jbib_diff_003_b_uni.ytd',
    'stream/mp_m_freemode_01^hair_004_u.ydd',
    'car/buffalo.yft',
    'car/buffalo_hi.yft',
    'car/buffalo.ytd',
    'car/unrelated.ytd',
    'ped.ydd',
    'vehicles.meta',
  ];
  const result = classifyAssets(paths.map((relative) => ({ relative })));
  assert.deepEqual(
    result.map((f) => f.category),
    [
      'images',
      'images',
      'clothing',
      'clothing',
      'hair',
      'vehicles',
      'vehicles',
      'vehicles',
      'textures',
      'models',
      'other',
    ],
  );
  assert.equal(result[2].group, result[3].group);
  assert.equal(result[5].group, result[6].group);
  assert.equal(result[5].group, result[7].group);
  assert.notEqual(result[0].destination, result[1].destination);
  assert(result[9].note);
  assert.equal(path.posix.basename(result[3].destination), path.posix.basename(paths[3]));
});
test('Real folder sorting previews all filtered files, preserves duplicate names and sources byte-for-byte', async (t) => {
  const entries = {
    'one/logo.png': Buffer.from([0, 1, 2, 255]),
    'two/logo.png': Buffer.from([10, 20]),
    'car/car.yft': 'model',
    'car/car.ytd': 'texture',
    'vehicles.meta': '<original/>',
  };
  const { api, source, output, choices, revealed } = await fixture(t, entries);
  const list = api.list({ recursive: true });
  assert.equal(list.total, 5);
  assert.equal(api.list({ recursive: true, category: 'images' }).total, 2);
  assert.equal(api.list({ search: 'two/logo' }).total, 1);
  assert.throws(() => api.list({ folder: '../' }), /Folder tidak valid/);
  const model = list.files.find((f) => f.name === 'car.yft');
  assert.equal((await api.read(model.id)).companion.name, 'car.ytd');
  assert.equal((await api.read(model.id)).data.length, 5);
  await assert.rejects(api.read('../vehicles.meta'), /Format/);
  assert.throws(() => api.plan({ recursive: true, ids: ['forged'] }), /Pilihan/);
  const plan = api.plan({ recursive: true });
  assert.equal(plan.count, 5);
  // Native output picker can be cancelled without losing the reviewed plan.
  choices.push(null);
  assert.equal(await api.sort(plan.id), null);
  choices.push(output);
  const result = await api.sort(plan.id);
  assert.equal(result.copied, 5);
  assert.equal(result.failed, 0);
  const report = JSON.parse(
    await fs.readFile(path.join(result.output, 'ditasha-sort-report.json')),
  );
  for (const file of report.files) {
    assert.deepEqual(
      await fs.readFile(path.join(result.output, file.destination)),
      Buffer.from(entries[file.source]),
    );
    assert.deepEqual(
      await fs.readFile(path.join(source, file.source)),
      Buffer.from(entries[file.source]),
    );
  }
  await api.reveal('output');
  assert.equal(revealed[0], result.output);
  await assert.rejects(api.sort(plan.id), /kedaluwarsa/);
  choices.push(output);
  const second = await api.sort(api.plan({ recursive: true, category: 'images' }).id);
  assert.notEqual(second.output, result.output);
  assert.equal(second.copied, 2);
});
test('File Manager paginates directories and files and rejects output inside the source tree', async (t) => {
  const entries = Object.fromEntries(
    Array.from({ length: 110 }, (_, i) => [`dir${i}/note.txt`, 'x']),
  );
  const { api, source, choices } = await fixture(t, entries);
  const first = api.list({});
  assert.equal(first.folders.length, 100);
  assert.equal(first.totalItems, 110);
  assert.equal(api.list({ offset: 100 }).folders.length, 10);
  assert.equal(api.list({ recursive: true }).files.length, 100);
  assert.equal(api.list({ recursive: true, offset: 100 }).files.length, 10);
  const plan = api.plan({ recursive: true });
  choices.push(source);
  await assert.rejects(api.sort(plan.id), /ngoài|di luar/);
  assert.equal(api.state().busy, false);
});
test('Changed source files fail safely with a report and cancellation keeps completed copies', async (t) => {
  let manager,
    cancelling = false;
  const f = await fixture(t, { 'a.png': 'alpha', 'b.png': 'beta', 'c.png': 'gamma' }, (state) => {
    if (cancelling && state.processed === 1) manager.cancel();
  });
  manager = f.api;
  const plan = manager.plan({ recursive: true });
  await fs.writeFile(path.join(f.source, 'b.png'), 'changed since scan');
  f.choices.push(f.output);
  const result = await manager.sort(plan.id);
  assert.equal(result.copied, 2);
  assert.equal(result.failed, 1);
  assert.equal(await fs.readFile(path.join(f.source, 'b.png'), 'utf8'), 'changed since scan');
  await manager.choose(true);
  const next = manager.plan({ recursive: true });
  f.choices.push(f.output);
  cancelling = true;
  const cancelled = await manager.sort(next.id);
  assert.equal(cancelled.cancelled, true);
  assert.equal(cancelled.copied, 1);
  assert.equal(manager.state().busy, false);
});
test('Symlinks are excluded and newly replaced links cannot escape the selected root', async (t) => {
  if (process.platform === 'win32')
    return t.skip('Creating symlinks needs Windows developer privileges.');
  const { api, source, output, choices } = await fixture(t, { 'safe.png': 'original' });
  const outside = path.join(output, 'outside.png');
  await fs.writeFile(outside, 'outside');
  await fs.symlink(outside, path.join(source, 'link.png'));
  await api.choose(true);
  assert.equal(api.list({ recursive: true }).total, 1);
  assert.equal(api.state().root.skipped, 1);
  const entry = api.list({ recursive: true }).files[0];
  const plan = api.plan({ recursive: true });
  await fs.unlink(path.join(source, 'safe.png'));
  await fs.symlink(outside, path.join(source, 'safe.png'));
  await assert.rejects(api.read(entry.id), /tautan/);
  choices.push(output);
  const result = await api.sort(plan.id);
  assert.equal(result.copied, 0);
  assert.equal(result.failed, 1);
  assert.equal(await fs.readFile(outside, 'utf8'), 'outside');
});
test('Every File Manager IPC route validates its caller', async () => {
  const win = new EventEmitter(),
    handlers = new Map();
  registerFileManager({
    win,
    ipcMain: { handle: (name, fn) => handlers.set(name, fn) },
    trusted: () => {
      throw Error('Untrusted');
    },
    dialog: {},
    shell: {},
  });
  assert.equal(handlers.size, 8);
  for (const handler of handlers.values())
    assert.throws(() => handler('wrong caller'), /Untrusted/);
});
