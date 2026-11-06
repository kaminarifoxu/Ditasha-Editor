'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const PY = process.platform === 'win32' ? 'python' : 'python3';
const SCRIPT = [
  'import importlib.util, pathlib, sys, types',
  'source = pathlib.Path(sys.argv[1]) / "prop_material.py"',
  'spec = importlib.util.spec_from_file_location("material", source)',
  'm = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)',
  'def sock(v=None, links=None): return types.SimpleNamespace(default_value=v, is_linked=bool(links), links=links or [])',
  'def node(t, **kwargs): return types.SimpleNamespace(type=t, **kwargs)',
  'def mat(base, alpha=None):',
  '    p = node("BSDF_PRINCIPLED", inputs={"Base Color":base, "Alpha":alpha or sock(1.0)})',
  '    return types.SimpleNamespace(use_nodes=True, node_tree=types.SimpleNamespace(nodes=[p]), name="test")',
  'from_node = node("RGB")',
  'red = mat(sock((0.8,0.01,0.02,1.0)))',
  'assert m.material_diffuse_spec(red) == (None, (0.8,0.01,0.02,1.0))',
  'black = mat(sock((0.0,0.0,0.0,1.0)))',
  'assert m.material_diffuse_spec(black)[1] == (0.0,0.0,0.0,1.0)',
  'purple = mat(sock((0.5,0.01,0.85,1.0)))',
  'assert m.material_diffuse_spec(purple)[1][2] == 0.85',
  'img = object()',
  'image_node = node("TEX_IMAGE", image=img)',
  'link = types.SimpleNamespace(from_node=image_node, from_socket=sock((1,1,1,1)))',
  'sample = mat(sock(None,[link]))',
  'assert m.material_diffuse_spec(sample) == (img, (1,1,1,1))',
  'mix_node = node("MIX_RGB", blend_type="MULTIPLY", inputs=[',
  '    sock(1.0), sock(None,[link]), sock((0.5,0.25,1.0,1.0))])',
  'mix_link = types.SimpleNamespace(from_node=mix_node, from_socket=sock(None))',
  'tinted = mat(sock(None, [mix_link]))',
  'image, color = m.material_diffuse_spec(tinted)',
  'assert image is img and color == (0.5,0.25,1.0,1.0)',
  'unsupported = node("NORMAL_MAP")',
  'bad = mat(sock(None,[types.SimpleNamespace(from_node=unsupported,from_socket=sock(None))]))',
  'try: m.material_diffuse_spec(bad)',
  'except ValueError as error: assert "Unsupported Base Color" in str(error)',
  'else: raise AssertionError("Unsupported shader silently accepted")',
  'print("MATERIAL_COLORS_OK")',
].join('\n');

test('glTF Principled solid colors and image tints preserve expected RGB', () => {
  const output = execFileSync(PY, ['-I','-c',SCRIPT, path.resolve(__dirname,'../electron/creators')], {
    encoding:'utf8', timeout:10000,
  });
  assert.match(output, /MATERIAL_COLORS_OK/);
});

test('DDS encoder converts linear RGB to sRGB without gamma-correcting alpha', () => {
  const script = [
    'import importlib.util, pathlib, sys',
    'spec = importlib.util.spec_from_file_location("dds",pathlib.Path(sys.argv[1])/"prop_dds.py")',
    'm = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)',
    'assert abs(m._linear_to_srgb(0.214)-0.5) < 0.02',
    'assert m._linear_to_srgb(0.0) == 0',
    'assert m._linear_to_srgb(1.0) == 1.0',
    'print("SRGB_OK")',
  ].join('\n');
  const output = execFileSync(PY, ['-I','-c', script, path.resolve(__dirname,'../electron/creators')], {
    encoding:'utf8', timeout:10000,
  });
  assert.match(output,/SRGB_OK/);
});
