import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const review=readFileSync(new URL('../electron/ped_review.py',import.meta.url),'utf8');
const bridge=readFileSync(new URL('../electron/native_bridge.py',import.meta.url),'utf8');
const ui=readFileSync(new URL('../src/native-build-ui.js',import.meta.url),'utf8');

test('Muto source GLB textures and UVs are audited before rig operations',()=>{
  assert.match(review,/source_audit = audit_source\(bpy, meshes, image_node\)/);
  assert.match(review,/result\['sourceMaterialAudit'\] = source_audit/);
  assert.match(bridge,/image_node=source_image_node/);
});
test('failed Muto step and actual error are included in the native report',()=>{
  assert.match(bridge,/review\.muto_failure_message\(result\)/);
  assert.match(review,/def muto_failure_message\(result\)/);
  assert.match(bridge,/report\['rigging'\] = result/);
});
test('source texture audit appears in the existing Ped Workshop UI',()=>{
  assert.match(ui,/report\.sourceQuality \|\| report\.sourceMaterialAudit/);
  assert.match(ui,/\['missingUV', 'Tanpa UV'\]/);
  assert.match(ui,/\['missingTextures', 'Gambar tidak terbaca'\]/);
});
