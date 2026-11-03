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
  assert.deepEqual([...handlers.keys()], ['ditasha:creators-state']);
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
  await assert.rejects(validateArtifacts(root, [{ relativePath: 'alias.ydr' }]), /type or size/);
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
