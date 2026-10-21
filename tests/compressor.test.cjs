'use strict';
const test = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('node:fs/promises'),
  os = require('node:os'),
  path = require('node:path');
const {
  createCompressor,
  safeRelative,
  LIMIT_BYTES,
  LIMIT_FILES,
} = require('../electron/asset-compressor.cjs');
async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ditasha-compressor-test-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const source = path.join(root, 'asset.ytd');
  await fs.writeFile(source, Buffer.concat([Buffer.from('RSC7'), Buffer.alloc(100)]));
  return { root, source, service: createCompressor({ chooseFolder: async () => root }) };
}
test('Native compressor preserves resource paths, source bytes, originals and explicit failed/pending report entries', async (t) => {
  const { root, source, service } = await fixture(t);
  const original = await fs.readFile(source);
  const job = await service.begin([
    { path: 'vehicle/stream/car.ytd', source },
    { path: 'vehicle/fxmanifest.lua', source },
  ]);
  const out = Buffer.from('RSC7compressed');
  await service.write({ id: job.id, index: 0, bytes: out, reason: 'test' });
  const summary = await service.finish({ id: job.id, cancelled: true });
  assert.equal(summary.status, 'cancelled');
  assert.deepEqual(await fs.readFile(source), original);
  assert.deepEqual(await fs.readFile(path.join(job.folder, 'vehicle/stream/car.ytd')), out);
  const report = JSON.parse(
    await fs.readFile(path.join(job.folder, '.ditasha-compressor/report.json')),
  );
  assert.equal(report.files[1].status, 'pending');
  assert.ok(!JSON.stringify(report).includes(source));
});
test('Native copying is lossless and never replaces a pre-existing destination', async (t) => {
  const { source, service } = await fixture(t);
  const job = await service.begin([
    { path: 'stream/a.ytd', source },
    { path: 'occupied.ytd', source },
  ]);
  await service.write({ id: job.id, index: 0 });
  assert.deepEqual(
    await fs.readFile(path.join(job.folder, 'stream/a.ytd')),
    await fs.readFile(source),
  );
  const occupied = path.join(job.folder, 'occupied.ytd');
  await fs.writeFile(occupied, 'keep');
  await assert.rejects(service.write({ id: job.id, index: 1, bytes: Buffer.from('invalid') }));
  assert.equal(await fs.readFile(occupied, 'utf8'), 'keep');
  const report = await service.finish({ id: job.id });
  assert.equal(report.status, 'completed-with-errors');
});
test('Traversal, Windows aliases, case collisions, concurrent jobs and changed sources are rejected', async (t) => {
  for (const p of [
    '../x',
    '/x',
    'a/../b',
    'a\\b',
    'a/NUL.ytd',
    'a:stream',
    'a/part.',
    '.ditasha-compressor/report.json',
  ])
    assert.throws(() => safeRelative(p));
  const { source, service } = await fixture(t);
  await assert.rejects(
    service.begin([
      { path: 'A.ytd', source },
      { path: 'a.ytd', source },
    ]),
  );
  const job = await service.begin([{ path: 'asset.ytd', source }]);
  await assert.rejects(service.begin([{ path: 'other.ytd', source }]));
  await fs.writeFile(source, 'changed');
  await assert.rejects(service.write({ id: job.id, index: 0 }));
  const report = await service.finish({ id: job.id });
  assert.equal(report.failed, 1);
  assert.equal(LIMIT_BYTES, 25 * 1024 ** 3);
  assert.equal(LIMIT_FILES, 50000);
});
test('Output directory symlinks cannot escape the chosen output', async (t) => {
  if (process.platform === 'win32') return t.skip('Creating symlinks requires developer mode');
  const { root, source, service } = await fixture(t),
    outside = path.join(root, 'outside');
  await fs.mkdir(outside);
  const job = await service.begin([{ path: 'stream/car.ytd', source }]);
  await fs.symlink(outside, path.join(job.folder, 'stream'));
  await assert.rejects(service.write({ id: job.id, index: 0 }));
  assert.deepEqual(await fs.readdir(outside), []);
  await service.finish({ id: job.id });
});
