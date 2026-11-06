'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const PY = process.platform === 'win32' ? 'python' : 'python3';
test('Blender isolated Python resolves the staged DDS sibling without sys.path', async t => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'ditasha-prop-loader-'));
  t.after(() => fs.rm(tmp, { recursive: true, force: true }));
  const origin = path.join(__dirname, '../electron/creators');
  await fs.copyFile(path.join(origin, 'prop-native.py'), path.join(tmp, 'prop-native.py'));
  await fs.copyFile(path.join(origin, 'prop_dds.py'), path.join(tmp, 'prop_dds.py'));
  // -I intentionally removes the working directory and PYTHONPATH from imports.
  // Importing prop-native here does not start Blender because __name__ != __main__.
  const py = [
    'import importlib.util, os, pathlib, sys',
    'worker = pathlib.Path(sys.argv[1]) / "prop-native.py"',
    'spec = importlib.util.spec_from_file_location("ditasha_native_test", worker)',
    'mod = importlib.util.module_from_spec(spec)',
    'spec.loader.exec_module(mod)',
    'helper = mod._load_dds_helper()',
    'assert callable(helper)',
    'print("STAGED_HELPER_RESOLVED")',
  ].join('\n');
  const result = execFileSync(PY, ['-I', '-c', py, tmp], {
    cwd: os.tmpdir(), encoding: 'utf8', timeout: 10000,
  });
  assert.match(result, /STAGED_HELPER_RESOLVED/);
  await fs.rm(path.join(tmp, 'prop_dds.py'));
  assert.throws(() => execFileSync(PY, ['-I', '-c', py, tmp], {
    cwd: os.tmpdir(), encoding: 'utf8', timeout: 10000,
    stdio: 'pipe',
  }));
});
