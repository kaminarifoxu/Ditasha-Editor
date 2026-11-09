import test from 'node:test';
import assert from 'node:assert/strict';
import { validateNativeMaterialReferences } from '../src/native-material-report.js';
import { readFileSync } from 'node:fs';
const base={name:'head',positions:Array(9).fill(0),uvs:[0,0,1,0,0,1],texture:0,normalTexture:1,specularTexture:2,
  materialInfo:{uv:'present',diffuse:'present',normal:'present',specular:'present'}};
test('all three sampler roles resolve to separate texture indices',()=>{
  assert.deepEqual(validateNativeMaterialReferences([base],3),[]);
});
test('material diagnostics retain missing and UV-mismatched references without fallback',()=>{
  const mesh={...base,normalTexture:null,specularTexture:null,materialInfo:{uv:'present',diffuse:'present',normal:'missing',specular:'uv-mismatch'}};
  assert.deepEqual(validateNativeMaterialReferences([mesh],1),[
    {name:'head',role:'normal',status:'missing'},
    {name:'head',role:'specular',status:'uv-mismatch'}
  ]);
});
test('rejects invalid indices and nonfinite UVs',()=>{
  assert.throws(()=>validateNativeMaterialReferences([{...base,normalTexture:33}],3),/normal sampler index/);
  assert.throws(()=>validateNativeMaterialReferences([{...base,uvs:[NaN,0]}],3),/UV buffer/);
});
test('native bridge resolves exact Sollumz sampler roles and Blender Principled nodes',()=>{
 const bridge=readFileSync(new URL('../electron/native_bridge.py',import.meta.url),'utf8');
 const viewer=readFileSync(new URL('../src/native-preview.js',import.meta.url),'utf8');
 assert.match(bridge,/\('DiffuseSampler', 'TextureSampler', 'DiffuseSampler2'\)/);
 assert.match(bridge,/\('BumpSampler', 'NormalSampler', 'PlateBgBumpSampler'\)/);
 assert.match(bridge,/\('SpecSampler', 'SpecularSampler'\)/);
 assert.match(bridge,/'normalTexture': indices\['normal'\]/);
 assert.match(bridge,/'specularTexture': indices\['specular'\]/);
 assert.match(viewer,/new THREE\.MeshPhongMaterial/);
 assert.match(viewer,/map\.colorSpace = THREE\.NoColorSpace/);
});
