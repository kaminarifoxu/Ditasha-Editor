'use strict';
const { test } = require('node:test'),
  assert = require('node:assert/strict');
const { validateJob, blenderArgs } = require('../electron/native-build.cjs');
const { execFileSync } = require('node:child_process');
test('Native build accepts bounded job settings and refuses arbitrary task/transform data', () => {
  assert.equal(validateJob({ mode: 'strobo_preview' }).mode, 'strobo_preview');
  assert.equal(validateJob({ mode: 'ped', name: 'ditasha_ped' }).name, 'ditasha_ped');
  assert.equal(validateJob({ mode: 'strobo', donorSirenId: 986, sirenId: 100 }).donorSirenId, 986);
  for (const value of [
    { mode: 'shell' },
    { mode: 'ped', name: '../../escape' },
    { mode: 'ped', name: 'abc;calc' },
    { mode: 'strobo', offset: [NaN, 0, 0] },
    { mode: 'strobo', offset: [0, 0, 21] },
    { mode: 'strobo', sirenId: 255 },
    { mode: 'strobo', scale: 0 },
    { mode: 'debadge', selected: ['a'.repeat(257)] },
  ])
    assert.throws(() => validateJob(value));
});
test('Blender receives separate argv with automatic script execution disabled', () => {
  const a = blenderArgs("C:\\Someone's models\\native_bridge.py", 'C:\\Data\\job.json');
  assert.ok(a.includes('--disable-autoexec'));
  assert.equal(a.at(-2), '--');
  assert.equal(a.at(-1), 'C:\\Data\\job.json');
  assert.equal(a[a.indexOf('--python') + 1], "C:\\Someone's models\\native_bridge.py");
});
test('Native metadata selects one model, links siren ID and rejects XML entities', () => {
  const result = execFileSync(
    process.platform === 'win32' ? 'python' : 'python3',
    ['tests/native-meta-checks.py'],
    { encoding: 'utf8' },
  );
  assert.match(result, /PASS_NATIVE_METADATA/);
});

test('Native preview IPC rejects arbitrary file reads and untrusted callers', async () => {
  const { registerNativeBuild } = require('../electron/native-build.cjs');
  const handlers = new Map();
  let calls = 0;
  registerNativeBuild({
    app: { getPath: () => require('node:os').tmpdir(), on: () => {} },
    ipcMain: { handle: (name, fn) => handlers.set(name, fn) },
    trusted: (event) => {
      calls++;
      if (!event.trusted) throw Error('untrusted');
    },
  });
  const read = handlers.get('ditasha:native-preview');
  await assert.rejects(read({ trusted: true }, 'C:/secret.txt'), /kedaluwarsa/);
  await assert.rejects(read({ trusted: false }, 'anything'), /untrusted/);
  assert.equal(calls, 2);
});

test('Ped builds stage a preview before exporting; canceled/invalid saves preserve the staged result', async (t) => {
  const fs = require('node:fs/promises');
  const path = require('node:path');
  const os = require('node:os');
  const { EventEmitter } = require('node:events');
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ditasha-ped-stage-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const engine = path.join(root, 'blender.exe');
  const source = path.join(root, 'person.glb');
  await fs.writeFile(engine, 'fixture');
  await fs.writeFile(source, 'fixture');
  const handlers = new Map();
  let pick = engine,
    cancelSave = true,
    chosenFolders = 0,
    specPath;
  require('../electron/native-build.cjs').registerNativeBuild({
    app: { getPath: () => root, on: () => {} },
    ipcMain: { handle: (name, fn) => handlers.set(name, fn) },
    trusted: (event) => {
      if (event !== 'trusted') throw Error('untrusted');
    },
    dialog: {
      showOpenDialog: async (_win, options) => {
        if (options.properties.includes('openDirectory')) {
          chosenFolders++;
          return cancelSave ? { canceled: true } : { canceled: false, filePaths: [root] };
        }
        return { canceled: false, filePaths: [pick] };
      },
    },
    spawnProcess: (_executable, args) => {
      specPath = args.at(-1);
      const process = new EventEmitter();
      process.stdout = new EventEmitter();
      process.stderr = new EventEmitter();
      setImmediate(async () => {
        const job = JSON.parse(await fs.readFile(specPath, 'utf8'));
        await fs.writeFile(
          path.join(job.output, 'report.json'),
          JSON.stringify({ ok: true, mode: 'ped', preview: { meshes: 1 } }),
        );
        await fs.writeFile(
          path.join(job.output, 'preview.json'),
          JSON.stringify({ version: 1, meshes: [], textures: [] }),
        );
        await fs.writeFile(path.join(job.output, 'fxmanifest.lua'), 'fixture resource');
        process.emit('close', 0);
      });
      return process;
    },
  });
  const call = (name, value) => handlers.get('ditasha:native-' + name)('trusted', value);
  await call('pick', 'engine');
  pick = source;
  const input = await call('pick', 'ped');
  await call('start', { mode: 'ped', name: 'test_ped', inputs: { ped: input.id } });
  let state;
  for (let i = 0; i < 200; i++) {
    state = await call('state');
    if (!state.running) break;
    await new Promise((r) => setTimeout(r, 5));
  }
  t.after(() => fs.rm(path.dirname(specPath), { recursive: true, force: true }));
  assert.equal(state.status, 'success');
  assert(state.previewId && state.stagedId);
  assert.equal(state.output, null);
  assert.equal(chosenFolders, 0, 'Do not ask for an export directory before preview');
  await assert.rejects(call('save', 'forged-id'), /preview/);
  await assert.rejects(
    handlers.get('ditasha:native-save')('untrusted', state.stagedId),
    /untrusted/,
  );
  assert.equal(await call('save', state.stagedId), false);
  assert.equal((await call('state')).stagedId, state.stagedId);
  cancelSave = false;
  assert.equal(await call('save', state.stagedId), true);
  const saved = await call('state');
  assert.equal(saved.stagedId, undefined);
  assert.equal(
    await fs.readFile(path.join(saved.output, 'fxmanifest.lua'), 'utf8'),
    'fixture resource',
  );
  assert.equal((await call('preview', saved.previewId)).version, 1);
});
