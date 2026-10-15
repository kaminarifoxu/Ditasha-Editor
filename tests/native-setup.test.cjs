const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { download, managedEnv, safeArchiveEntry } = require('../electron/native-setup.cjs');
test('Native setup rejects corrupted downloads, removes partials and reuses verified files offline', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ditasha-setup-test-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const data = Buffer.from('verified engine data');
  const spec = {
    file: 'engine.zip',
    name: 'Test',
    size: data.length,
    sha256: createHash('sha256').update(data).digest('hex'),
    url: 'https://example.invalid/engine.zip',
  };
  const signal = new AbortController().signal;
  const respond = (body) => async () => ({ ok: true, body: [body] });
  await assert.rejects(
    download(spec, root, signal, () => {}, respond(Buffer.alloc(data.length))),
    /Checksum/,
  );
  await assert.rejects(fs.stat(path.join(root, 'engine.zip.part')), /ENOENT/);
  const file = await download(spec, root, signal, () => {}, respond(data));
  assert.deepEqual(await fs.readFile(file), data);
  assert.equal(
    await download(
      spec,
      root,
      signal,
      () => {},
      () => {
        throw Error('Network must not be used');
      },
    ),
    file,
  );
  const controller = new AbortController();
  controller.abort();
  await fs.rm(file);
  await assert.rejects(
    download(spec, root, controller.signal, () => {}, respond(data)),
    /abort/i,
  );
});
test('Managed Blender profiles isolate user settings and reject archive traversal', () => {
  const env = managedEnv('/managed', {
    PATH: 'tools',
    CI: 'true',
    PYTHONPATH: 'foreign',
    PYTHONHOME: 'foreign',
  });
  assert.equal(env.PATH, 'tools');
  assert.equal(env.CI, undefined);
  assert.equal(env.PYTHONPATH, undefined);
  assert.equal(env.PYTHONHOME, undefined);
  assert.equal(env.BLENDER_USER_CONFIG, path.join('/managed', 'config'));
  for (const entry of ['/escape', '../escape', 'blender/../escape', 'C:/escape', 'blender\\escape'])
    assert.equal(safeArchiveEntry(entry), false);
  assert.equal(safeArchiveEntry('blender/blender.exe'), true);
});
