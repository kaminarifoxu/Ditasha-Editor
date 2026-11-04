'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const { registerNativeBuild } = require('../electron/native-build.cjs');

test('ped source stays readable during Muto, on failure, and swaps after success', async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'ditasha-source-lifecycle-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const handlers = new Map();
  const model = path.join(directory, 'humanoid.glb');
  const blender = path.join(directory, 'blender.exe');
  await fs.writeFile(model, 'fixture glb');
  await fs.writeFile(blender, 'fixture exe');
  let chosen = blender;
  let pending = null;
  registerNativeBuild({
    app: { getPath: () => directory, on: () => {} },
    ipcMain: { handle: (name, handler) => handlers.set(name, handler) },
    trusted: (event) => assert.equal(event, 'trusted'),
    dialog: { showOpenDialog: async () => ({ canceled: false, filePaths: [chosen] }) },
    spawnProcess: (_executable, args) => {
      const proc = new EventEmitter();
      proc.stdout = new EventEmitter();
      proc.stderr = new EventEmitter();
      pending = { proc, jobPath: args.at(-1) };
      return proc;
    },
  });
  const call = (name, ...args) => handlers.get('ditasha:native-' + name)('trusted', ...args);
  await call('pick', 'engine');
  chosen = model;
  const pedInput = await call('pick', 'ped');
  const inputs = { ped: pedInput.id };
  const sourceScene = { version: 1, basis: 'gta-z-up', meshes: [{ name: 'source-head', positions: [0,0,0,1,0,0,0,1,0], uvs: [0,0,1,0,0,1] }], textures: [] };
  async function closeCurrent(ok, mode, source) {
    const { proc, jobPath } = pending;
    const job = JSON.parse(await fs.readFile(jobPath, 'utf8'));
    assert.equal(job.mode, mode);
    await fs.writeFile(path.join(job.output, 'preview.json'),
      JSON.stringify(source || { ...sourceScene, meshes: [{ ...sourceScene.meshes[0], name: 'rig-result' }] }));
    await fs.writeFile(path.join(job.output, 'report.json'),
      JSON.stringify({ ok, mode, preview: { meshes: 1 }, error: ok ? undefined : 'fixture fitting failed' }));
    proc.emit('close', ok ? 0 : 2);
    for (let i = 0; i < 50 && (await call('state')).running; i++)
      await new Promise((resolve) => setTimeout(resolve, 10));
  }
  await call('start', { mode: 'ped_preview', inputs });
  await closeCurrent(true, 'ped_preview', sourceScene);
  const initial = await call('state');
  assert.ok(initial.previewId);
  assert.equal((await call('preview', initial.previewId)).meshes[0].name, 'source-head');
  await call('start', { mode: 'ped', name: 'test_ped', inputs });
  const active = await call('state');
  assert.equal(active.running, true);
  assert.equal(active.previewId, initial.previewId);
  assert.equal(active.sourcePreviewActive, true);
  assert.equal((await call('preview', initial.previewId)).meshes[0].name, 'source-head');
  await closeCurrent(false, 'ped');
  const failed = await call('state');
  assert.equal(failed.status, 'error');
  assert.equal(failed.previewId, initial.previewId);
  assert.equal((await call('preview', failed.previewId)).meshes[0].name, 'source-head');
  assert.equal(failed.stagedId, undefined);
  await call('start', { mode: 'ped', name: 'test_ped', inputs });
  assert.equal((await call('state')).previewId, initial.previewId);
  // The second native fixture has an exported preview but not the mandatory
  // native ped artifacts, so it must never become an export-ready staged rig.
  await closeCurrent(true, 'ped');
  const completed = await call('state');
  assert.equal(completed.status, 'success');
  assert.notEqual(completed.previewId, initial.previewId);
  assert.equal((await call('preview', completed.previewId)).meshes[0].name, 'rig-result');
  assert.equal(completed.stagedId, undefined);
});
