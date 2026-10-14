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
