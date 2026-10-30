'use strict';
const { test } = require('node:test'),
  assert = require('node:assert/strict');
const { validateJob, blenderArgs } = require('../electron/native-build.cjs');
const { execFileSync } = require('node:child_process');
test('Unexpected Blender exits retain the actual error and last rig stage', () => {
  const { engineFailure } = require('../electron/native-build.cjs');
  const message = engineFailure(
    'INFO: import complete\nTraceback (most recent call last):\nValueError: missing humanoid joints\n',
    'Blender keluar dengan kode 1',
    'markers',
  );
  assert.match(message, /kode 1/);
  assert.match(message, /markers/);
  assert.match(message, /missing humanoid joints/);
  assert.match(
    engineFailure('INFO: glTF import finished', 'Blender keluar dengan kode 1'),
    /Simpan log diagnosis/,
  );
});
test('Native build accepts bounded job settings and refuses arbitrary task/transform data', () => {
  assert.equal(validateJob({ mode: 'strobo_preview' }).mode, 'strobo_preview');
  assert.equal(validateJob({ mode: 'parts_preview' }).mode, 'parts_preview');
  assert.equal(validateJob({ mode: 'garment', maxDistance: 0.1 }).maxDistance, 0.1);
  assert.equal(
    validateJob({
      mode: 'parts',
      selected: ['spoiler'],
      rotation: [0, 0, 90],
      targetBone: 'chassis',
    }).rotation[2],
    90,
  );
  assert.equal(validateJob({ mode: 'ped', name: 'ditasha_ped' }).name, 'ditasha_ped');
  assert.equal(validateJob({ mode: 'ped_preview' }).mode, 'ped_preview');
  assert.deepEqual(
    validateJob({
      mode: 'ped',
      name: 'female_ped',
      pedOptions: { reference: 'mp_f', height: 1.62, face: false },
    }).pedOptions,
    {
      reference: 'mp_f',
      height: 1.62,
      fingers: true,
      face: false,
      handTemplate: true,
      faceTemplate: true,
      headParts: true,
    },
  );
  assert.equal(validateJob({ mode: 'strobo', donorSirenId: 986, sirenId: 100 }).donorSirenId, 986);
  for (const value of [
    { mode: 'shell' },
    { mode: 'parts' },
    { mode: 'parts', selected: ['x', 'x'] },
    { mode: 'parts_preview', rotation: [0, NaN, 0] },
    { mode: 'parts_preview', rotation: [0, 0, 361] },
    { mode: 'parts_preview', targetBone: '../../bad' },
    { mode: 'garment', maxDistance: 0 },
    { mode: 'garment', maxDistance: Infinity },
    { mode: 'ped', name: '../../escape' },
    { mode: 'ped', name: 'abc;calc' },
    { mode: 'ped', name: 'valid_ped', pedOptions: { reference: 'custom.blend' } },
    { mode: 'ped', name: 'valid_ped', pedOptions: { height: NaN } },
    { mode: 'ped', name: 'valid_ped', pedOptions: { height: 0.1 } },
    { mode: 'ped', name: 'valid_ped', pedOptions: { height: 4 } },
    { mode: 'ped', name: 'valid_ped', pedOptions: { fingers: 'false' } },
    { mode: 'ped', name: 'valid_ped', pedOptions: [] },
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
test('Clothing generator, native slot and GTA clip settings stay bounded', () => {
  const job = validateJob({
    mode: 'garment',
    clothing: {
      source: 'generate',
      body: 'Body',
      native: true,
      slot: 'mp_f_freemode_01^jbib_001_u',
    },
    useClip: true,
    clipIndex: 2,
  });
  assert.equal(job.clothing.source, 'generate');
  assert.equal(job.useClip, true);
  for (const payload of [
    { clothing: { source: 'generate', body: 'x'.repeat(129) } },
    { clothing: { lower: 0.8, upper: 0.3 } },
    { clothing: { gap: Infinity } },
    { clothing: { color: [NaN, 0, 0] } },
    { clothing: { native: true, slot: '../bad' } },
    { clothing: { native: 'yes' } },
    { useClip: 'yes' },
    { clipIndex: -1 },
    { clipIndex: 1.5 },
  ])
    assert.throws(() => validateJob({ mode: 'garment', ...payload }));
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
    specPath,
    failBuild = false,
    crashBuild = false;
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
      showSaveDialog: async () => ({
        canceled: false,
        filePath: path.join(root, 'review-copy.blend'),
      }),
    },
    spawnProcess: (_executable, args) => {
      specPath = args.at(-1);
      const process = new EventEmitter();
      process.stdout = new EventEmitter();
      process.stderr = new EventEmitter();
      setImmediate(async () => {
        const job = JSON.parse(await fs.readFile(specPath, 'utf8'));
        if (crashBuild) {
          await fs.writeFile(path.join(job.output, 'ditasha-result.blend'), 'recovered rig');
          await fs.writeFile(
            path.join(job.output, 'progress.json'),
            JSON.stringify({ stage: 'export' }),
          );
          process.emit('close', 1);
          return;
        }

        await fs.writeFile(
          path.join(job.output, 'report.json'),
          JSON.stringify({
            ok: !failBuild,
            error: failBuild ? 'fixture rig validation failed' : undefined,
            mode: job.mode,
            preview:
              job.mode === 'ped'
                ? { meshes: 1, poses: [{ id: 'rest' }, { id: 'arms' }] }
                : { meshes: 1 },
          }),
        );
        await fs.writeFile(
          path.join(job.output, 'preview.json'),
          JSON.stringify({ version: 1, meshes: [], textures: [] }),
        );
        await fs.writeFile(path.join(job.output, 'fxmanifest.lua'), 'fixture resource');
        await fs.writeFile(
          path.join(job.output, 'preview-arms.json'),
          JSON.stringify({ version: 1, pose: 'arms' }),
        );
        if (job.mode === 'ped')
          await fs.writeFile(path.join(job.output, 'ditasha-result.blend'), 'review project');
        process.emit('close', 0);
      });
      return process;
    },
  });
  const call = (name, value) => handlers.get('ditasha:native-' + name)('trusted', value);
  await call('pick', 'engine');
  pick = source;
  const input = await call('pick', 'ped');
  await call('start', { mode: 'ped_preview', inputs: { ped: input.id } });
  let sourceState;
  for (let i = 0; i < 200; i++) {
    sourceState = await call('state');
    if (!sourceState.running) break;
    await new Promise((r) => setTimeout(r, 5));
  }
  const sourceRoot = path.dirname(specPath);
  assert.equal(sourceState.status, 'success');
  assert(sourceState.previewId && !sourceState.stagedId && !sourceState.reviewId);
  assert.equal(sourceState.output, null);
  assert.equal(chosenFolders, 0);
  await assert.rejects(call('save', sourceState.previewId), /preview/);
  await assert.rejects(
    handlers.get('ditasha:native-preview')('trusted', sourceState.previewId, 'arms'),
    /Pose/,
  );
  await call('pick', 'ped');
  await assert.rejects(call('preview', sourceState.previewId), /kedaluwarsa/);
  assert.equal((await call('state')).report, null, 'New source must invalidate the old report');
  await call('start', { mode: 'ped', name: 'test_ped', inputs: { ped: input.id } });
  await assert.rejects(
    fs.stat(sourceRoot),
    /ENOENT/,
    'Source preview staging should be cleaned on the next job',
  );
  let state;
  for (let i = 0; i < 200; i++) {
    state = await call('state');
    if (!state.running) break;
    await new Promise((r) => setTimeout(r, 5));
  }
  t.after(() => fs.rm(path.dirname(specPath), { recursive: true, force: true }));
  assert.equal(state.status, 'success');
  assert(state.previewId && state.stagedId);
  assert(state.reviewId);
  await assert.rejects(call('pick', 'ped'), /Simpan atau buang/);
  const readPose = (pose) =>
    handlers.get('ditasha:native-preview')('trusted', state.previewId, pose);
  assert.equal((await readPose('arms')).pose, 'arms');
  for (const bad of ['../../secret', '__proto__', 'legs'])
    await assert.rejects(readPose(bad), /Pose/);
  await assert.rejects(call('save-review', 'forged-id'), /koreksi/);
  assert.equal(await call('save-review', state.reviewId), true);
  assert.equal(await fs.readFile(path.join(root, 'review-copy.blend'), 'utf8'), 'review project');
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
  assert.equal(
    (await handlers.get('ditasha:native-preview')('trusted', saved.previewId, 'arms')).pose,
    'arms',
  );
  assert.equal(
    await call('save-review', saved.reviewId),
    true,
    'Correction project should remain readable after saving moves the staged folder',
  );
  failBuild = true;
  await call('start', { mode: 'ped', name: 'failed_ped', inputs: { ped: input.id } });
  let failed;
  for (let i = 0; i < 200; i++) {
    failed = await call('state');
    if (!failed.running) break;
    await new Promise((r) => setTimeout(r, 5));
  }
  assert.equal(failed.status, 'error');
  assert(
    failed.reviewId && !failed.stagedId && !failed.previewId,
    'Failed builds offer correction only, not a successful game export',
  );
  await assert.rejects(
    handlers.get('ditasha:native-preview')('trusted', saved.previewId),
    /kedaluwarsa/,
  );
  assert.equal(await call('save-review', failed.reviewId), true);
  crashBuild = true;
  await call('start', { mode: 'ped', name: 'crashed_ped', inputs: { ped: input.id } });
  let crashed;
  for (let i = 0; i < 200; i++) {
    crashed = await call('state');
    if (!crashed.running) break;
    await new Promise((r) => setTimeout(r, 5));
  }
  assert.equal(crashed.status, 'error');
  assert.match(crashed.message, /export/);
  assert(crashed.reviewId && !crashed.stagedId && !crashed.previewId);
  assert.equal(crashed.report.recovery, true);
  assert.equal(await call('save-review', crashed.reviewId), true);
  assert.equal(await fs.readFile(path.join(root, 'review-copy.blend'), 'utf8'), 'recovered rig');
});

test('Rig review audits weights, UV/material/LOD coverage and maps supported Muto options', () => {
  const result = execFileSync(
    process.platform === 'win32' ? 'python' : 'python3',
    ['tests/ped-review-checks.py'],
    { encoding: 'utf8' },
  );
  assert.match(result, /PASS_PED_REVIEW/);
});

test('Garment transfer keeps four normalized influences and refuses weightless references', () => {
  const result = execFileSync(
    process.platform === 'win32' ? 'python' : 'python3',
    ['tests/garment-weights-checks.py'],
    { encoding: 'utf8' },
  );
  assert.match(result, /PASS_GARMENT_WEIGHT_BUDGET/);
});
