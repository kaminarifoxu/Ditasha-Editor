'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');

function runPython(script) {
  const executable = process.platform === 'win32' ? 'python' : 'python3';
  return execFileSync(executable, ['-c', script, path.resolve(__dirname, '../electron/creators')], {
    timeout: 15000, encoding: 'utf8',
  }).trim();
}
test('Prop DDS encoder creates correctly named A8R8G8B8 with valid BGRA pixels', () => {
  const py = [
    'import importlib.util, pathlib, struct, sys',
    'source = pathlib.Path(sys.argv[1]) / "prop_dds.py"',
    'spec = importlib.util.spec_from_file_location("prop_dds", source)',
    'mod = importlib.util.module_from_spec(spec); spec.loader.exec_module(mod)',
    'buffer = mod.encode_dds_rgba(2, 1, bytes([10,20,30,255, 40,50,60,128]))',
    'assert buffer[:4] == b"DDS "',
    'assert struct.unpack_from("<I", buffer, 4)[0] == 124',
    'assert struct.unpack_from("<I", buffer, 16)[0] == 2',
    'assert struct.unpack_from("<I", buffer, 12)[0] == 1',
    'assert struct.unpack_from("<I", buffer, 88)[0] == 32',
    'assert struct.unpack_from("<I", buffer, 92)[0] == 0x00ff0000',
    'assert buffer[128:] == bytes([30,20,10,255, 60,50,40,128])',
    'print("DDS_OK")',
  ].join('\n');
  assert.equal(runPython(py), 'DDS_OK');
});
test('Prop DDS encoder rejects empty dimensions and inconsistent pixel arrays', () => {
  const py = [
    'import importlib.util, pathlib, sys',
    'source = pathlib.Path(sys.argv[1]) / "prop_dds.py"',
    'spec = importlib.util.spec_from_file_location("prop_dds", source)',
    'mod = importlib.util.module_from_spec(spec); spec.loader.exec_module(mod)',
    'for w, h, data in [(0, 2, bytes(8)), (4097, 4097, bytes(4)), (2, 2, bytes(4))]:',
    '    try: mod.encode_dds_rgba(w, h, data)',
    '    except ValueError: continue',
    '    raise AssertionError("Invalid DDS input accepted")',
    'print("DDS_REJECT_OK")',
  ].join('\n');
  assert.equal(runPython(py), 'DDS_REJECT_OK');
});
