'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { createRegistry, DEFAULT_FLAGS } = require('../electron/creators/registry.cjs');
const { createJobManager } = require('../electron/creators/job-manager.cjs');
const { safeRelative, validateArtifacts, commitExport } = require('../electron/creators/export-validation.cjs');
const { registerCreators } = require('../electron/creators/creator-ipc.cjs');

test('Phase 3 creators are disabled by default and require registered ready handlers', () => {
  const registry = createRegistry();
  assert.ok(Object.values(DEFAULT_FLAGS).every(flag => flag === false));
  assert.equal(registry.describe().length, 5);
  assert.ok(registry.describe().every(entry => !entry.available));
  assert.throws(() => registry.get('prop'), /not available/);
  assert.throws(() => createRegistry({ flags: { arbitrary: true } }), /Unknown/);
  assert.throws(() => createRegistry({ flags: { prop: 'yes' } }), /boolean/);
  const enabled = createRegistry({ flags: { prop: true }, capabilities: { prop: { ready: true } } });
  assert.equal(enabled.available('prop'), false);
  enabled.register('prop', () => 'ok');
  assert.equal(enabled.available('prop'), true);
  assert.equal(enabled.get('prop')(), 'ok');
  assert.throws(() => enabled.register('prop', () => null), /already registered/);
});

test('Creator IPC is read-only and rejects an untrusted renderer', async () => {
  const handlers = new Map();
  registerCreators({
    ipcMain: { handle: (name, handler) => handlers.set(name, handler) },
    trusted: event => { if (!event?.trusted) throw Error('Untrusted renderer'); },
    app: { on() {} },
  });
  assert.deepEqual([...handlers.keys()].sort(), ['ditasha:creators-state','ditasha:prop-pick','ditasha:prop-revoke','ditasha:prop-start','ditasha:prop-job','ditasha:prop-cancel','ditasha:prop-deps'].sort());
  await assert.rejects(handlers.get('ditasha:prop-pick')({ trusted: true }, 'input'), /Asset picker unavailable/);
  await assert.rejects(handlers.get('ditasha:prop-pick')({ trusted: false }, 'input'), /Untrusted/);
  assert.equal((await handlers.get('ditasha:creators-state')({ trusted: true })).length, 5);
  assert.throws(() => handlers.get('ditasha:creators-state')({ trusted: false }), /Untrusted/);
});

test('Creator queue serializes work, rejects overflow, and cancels queued jobs', async () => {
  const manager = createJobManager({ concurrency: 1, maxQueued: 1 });
  const order = [];
  let unblock;
  const gate = new Promise(resolve => { unblock = resolve; });
  const a = manager.submit('prop', async () => { order.push('a'); await gate; });
  const b = manager.submit('weapon', async () => { order.push('b'); });
  assert.throws(() => manager.submit('tattoo', () => null), /full/);
  assert.equal(manager.cancel(b.id), true);
  assert.equal((await b.completion).state, 'cancelled');
  unblock();
  assert.equal((await a.completion).state, 'succeeded');
  assert.deepEqual(order, ['a']);
  assert.equal(manager.cancel(a.id), false);
  manager.close();
  assert.throws(() => manager.submit('prop', () => null), /closed/);
});

test('Failed creator jobs expose bounded diagnostics without crashing the queue', async () => {
  const manager = createJobManager();
  const a = manager.submit('prop', () => { throw Error('test failure'); });
  assert.equal((await a.completion).state, 'failed');
  assert.match(manager.snapshot(a.id).error, /test failure/);
  const b = manager.submit('prop', async () => 'ok');
  assert.equal((await b.completion).state, 'succeeded');
  manager.close();
});

test('Artifact validator rejects traversal, duplicates, symlinks and checksum mismatches', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ditasha-phase3-validation-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.writeFile(path.join(root, 'model.ydr'), 'test-model');
  for (const value of ['../secret', '/secret', 'dir/../secret', 'dir//file', 'dir\\file', '']) {
    assert.throws(() => safeRelative(value), /Invalid|Unsafe/);
  }
  const good = await validateArtifacts(root, [{ relativePath: 'model.ydr' }]);
  assert.equal(good[0].bytes, 10);
  assert.match(good[0].sha256, /^[a-f0-9]{64}$/);
  await assert.rejects(validateArtifacts(root, [{ relativePath: 'model.ydr' }, { relativePath: 'MODEL.YDR' }]), /Duplicate/);
  await assert.rejects(validateArtifacts(root, [{ relativePath: 'model.ydr', sha256: '0'.repeat(64) }]), /checksum/);
  await assert.rejects(validateArtifacts(root, [{ relativePath: 'missing.ydr' }]));
  await fs.symlink(path.join(root, 'model.ydr'), path.join(root, 'alias.ydr'));
  await assert.rejects(validateArtifacts(root, [{ relativePath: 'alias.ydr' }]), /type or size|symlink escape/);
});

test('Export commits validated staging without replacing previous output', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ditasha-phase3-commit-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const staging = path.join(root, 'staged');
  const destination = path.join(root, 'exported');
  await fs.mkdir(staging);
  await fs.writeFile(path.join(staging, 'prop.ydr'), 'valid');
  const result = await commitExport({ stagingRoot: staging, destinationRoot: destination, artifacts: [{ relativePath: 'prop.ydr' }] });
  assert.equal(result.artifacts.length, 1);
  assert.equal(await fs.readFile(path.join(destination, 'prop.ydr'), 'utf8'), 'valid');
  const secondStage = path.join(root, 'staged2');
  await fs.mkdir(secondStage);
  await fs.writeFile(path.join(secondStage, 'prop.ydr'), 'other');
  await assert.rejects(commitExport({ stagingRoot: secondStage, destinationRoot: destination, artifacts: [{ relativePath: 'prop.ydr' }] }), /already exists/);
  assert.equal(await fs.readFile(path.join(destination, 'prop.ydr'), 'utf8'), 'valid');
});


test('Windows artifact rules reject reserved, trailing and unsafe nested path names', () => {
  for (const name of ['CON', 'con.txt', 'AUX.dds', 'LPT1', 'COM9.bin', 'folder. /file', 'hello.','name ', 'foo//bar', 'dir/../file']) {
    assert.throws(() => safeRelative(name), /Unsafe|Invalid/);
  }
  assert.equal(safeRelative('stream/prop_hi.ytd'), 'stream/prop_hi.ytd');
});

test('Artifact validation rejects symlink ancestors and exclusive export reservations', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ditasha-phase3-race-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const stage = path.join(root, 'stage');
  await fs.mkdir(stage);
  await fs.mkdir(path.join(stage, 'actual'));
  await fs.writeFile(path.join(stage, 'actual', 'asset.ydr'), 'test');
  await fs.symlink(path.join(stage, 'actual'), path.join(stage, 'alias'), 'junction');
  await assert.rejects(validateArtifacts(stage, [{ relativePath: 'alias/asset.ydr' }]), /symlink escape/);
  const destination = path.join(root, 'final');
  await fs.writeFile(path.join(root, '.final.ditasha-lock'), 'lock');
  await assert.rejects(commitExport({ stagingRoot: stage, destinationRoot: destination, artifacts: [{ relativePath: 'actual/asset.ydr' }] }), /reserved/);
  await fs.rm(path.join(root, '.final.ditasha-lock'));
  const out = await commitExport({ stagingRoot: stage, destinationRoot: destination, artifacts: [{ relativePath: 'actual/asset.ydr' }] });
  assert.equal(out.artifacts.length, 1);
  await assert.rejects(fs.access(stage));
});

test('Creator job history is bounded and timeout aborts cooperative work', async () => {
  const manager = createJobManager({ maxHistory: 2, timeoutMs: 25 });
  const ids = [];
  for (let n = 0; n < 4; n++) {
    const j = manager.submit('prop', async () => n);
    await j.completion; ids.push(j.id);
  }
  assert.equal(manager.snapshot(ids[0]), null);
  assert.equal(manager.snapshot(ids[3]).state, 'succeeded');
  const slow = manager.submit('prop', ({ signal }) => new Promise(resolve => {
    signal.addEventListener('abort', () => resolve(), { once: true });
  }));
  assert.equal((await slow.completion).state, 'failed');
  assert.match(manager.snapshot(slow.id).error, /timed out/);
  manager.close();
});

test('Native job runner uses argv, abort signals, and cleanup refuses unrelated directories', async t => {
  const { runNativeProcess, cleanupStaging } = require('../electron/creators/native-process.cjs');
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ditasha-native-jobs-'));
  t.after(() => fs.rm(dir, { force: true, recursive: true }));
  const ok = await runNativeProcess({ executable: process.execPath, args: ['-e', 'console.log("done")'], timeoutMs: 5000 });
  assert.match(ok.log, /done/);
  const controller = new AbortController();
  const pending = runNativeProcess({ executable: process.execPath, args: ['-e', 'setInterval(() => {}, 1000)'], signal: controller.signal, timeoutMs: 5000 });
  setTimeout(() => controller.abort(), 60);
  await assert.rejects(pending, /cancelled/);
  const staging = path.join(dir, 'ditasha-stage-fixture');
  await fs.mkdir(staging);
  await fs.writeFile(path.join(staging, 'test'), 'ok');
  await assert.rejects(cleanupStaging(dir, dir), /Unsafe/);
  await cleanupStaging(staging, dir);
  await assert.rejects(fs.access(staging));
});
