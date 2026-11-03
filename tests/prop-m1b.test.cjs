'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { createAssetTokens } = require('../electron/creators/asset-tokens.cjs');
const { extractProbe } = require('../electron/creators/prop-provider.cjs');

test('M1b asset tokens authorize only scoped selected files/directories', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ditasha-m1b-token-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const file = path.join(root, 'prop.glb');
  await fs.writeFile(file, Buffer.from('sample'));
  const store = createAssetTokens({ maxGrants: 2 });
  const input = await store.issue({ kind: 'input', selectedPath: file });
  const output = await store.issue({ kind: 'output', selectedPath: root });
  assert.match(input.token, /^[a-f0-9-]{36}$/i);
  assert.equal((await store.resolve(input.token, 'input')).path, await fs.realpath(file));
  assert.equal((await store.resolve(output.token, 'output')).kind, 'output');
  await assert.rejects(store.resolve(input.token, 'output'), /unauthorized/);
  await assert.rejects(store.issue({ kind: 'input', selectedPath: file }), /Too many/);
  assert.equal(store.revoke(input.token), true);
  await assert.rejects(store.resolve(input.token, 'input'), /unauthorized/);
  store.clear();
  assert.equal(store.size(), 0);
});
test('M1b asset grants enforce byte, extension, expiry and identity checks', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ditasha-m1b-invalid-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const bad = path.join(root, 'bad.exe');
  await fs.writeFile(bad, 'test');
  const file = path.join(root, 'mesh.obj');
  await fs.writeFile(file, '12345');
  const store = createAssetTokens({ maxInputBytes: 6 });
  await assert.rejects(store.issue({ kind: 'input', selectedPath: bad }), /Unsupported/);
  const grant = await store.issue({ kind: 'input', selectedPath: file });
  await fs.rm(file);
  await fs.writeFile(file, '67890');
  await assert.rejects(store.resolve(grant.token, 'input'), /changed or disappeared/);
  let now = 100;
  const timed = createAssetTokens({ now: () => now, ttlMs: 1000 });
  const saved = await timed.issue({ kind: 'output', selectedPath: root });
  now = 1101;
  await assert.rejects(timed.resolve(saved.token, 'output'), /Expired/);
});
test('M1b native probe rejects fabricated capabilities and malformed output', () => {
  const payload = { schema: 1, blenderVersion: [5,2,2], sollumzLoaded: true, importers: ['glb','obj','fbx'] };
  assert.deepEqual(extractProbe('header\nDITASHA_PROP_PROBE='+JSON.stringify(payload)+'\n'), payload);
  for (const log of ['', 'DITASHA_PROP_PROBE={"ready":true}', 'DITASHA_PROP_PROBE={not json}',
    'DITASHA_PROP_PROBE='+JSON.stringify(payload)+'\nDITASHA_PROP_PROBE='+JSON.stringify(payload)]) {
    assert.throws(() => extractProbe(log));
  }
});
