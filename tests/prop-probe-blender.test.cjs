'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const { extractProbe } = require('../electron/creators/prop-provider.cjs');

test('Prop probe reads registered module keys, not Blender Addon.__name__', () => {
  const py = [
    'import sys, types, runpy',
    'class Addons(dict): pass',
    'def operator(): return types.SimpleNamespace(get_rna_type=lambda: object())',
    'bpy = types.ModuleType("bpy")',
    'bpy.context = types.SimpleNamespace(preferences=types.SimpleNamespace(addons=Addons({"bl_ext.ditasha.sollumz": object()})))',
    'bpy.app = types.SimpleNamespace(version=(5,2,2))',
    'bpy.ops = types.SimpleNamespace(import_scene=types.SimpleNamespace(gltf=operator(), fbx=operator()), wm=types.SimpleNamespace(obj_import=operator()))',
    'sys.modules["bpy"] = bpy',
    'deps = types.ModuleType("bl_ext.ditasha.sollumz.dependencies")',
    'deps.IS_SZIO_NATIVE_AVAILABLE = True',
    'sys.modules["bl_ext"] = types.ModuleType("bl_ext")',
    'sys.modules["bl_ext.ditasha"] = types.ModuleType("bl_ext.ditasha")',
    'sys.modules["bl_ext.ditasha.sollumz"] = types.ModuleType("bl_ext.ditasha.sollumz")',
    'sys.modules[deps.__name__] = deps',
    'runpy.run_path(sys.argv[1])',
  ].join('\n');
  const command = process.platform === 'win32' ? 'python' : 'python3';
  const source = path.resolve(__dirname, '../electron/creators/prop-probe.py');
  const output = execFileSync(command, ['-c', py, source], { encoding: 'utf8', timeout: 10000 });
  const report = extractProbe(output);
  assert.equal(report.sollumzLoaded, true);
  assert.equal(report.nativeProviderAvailable, true);
  assert.deepEqual(report.importers, ['glb','obj','fbx']);
});
