import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { automaticPairedDiffuse, availableDiffuseTextures } from '../src/file-preview-force-ytd.js';
const tex=(name)=>({name,w:1,h:1,out:new Uint8Array([10,20,30,255])});
const resolver=(name,external,embedded)=>external.find((t)=>t.name===name) || embedded.find((t)=>t.name===name) || null;
test('automatically uses uniquely named diffuse in a verified filename-paired YTD',()=>{
 const texture=tex('head_skin_a_uni');
 assert.equal(automaticPairedDiffuse('unresolved_head_sampler',[texture],[],'head_000_u.ydd',resolver),texture);
});
test('normal, specular and ambiguous atlases are never forced as skin',()=>{
 assert.equal(automaticPairedDiffuse('skin',[tex('head_normal')],[],'head.ydd',resolver),null);
 assert.equal(automaticPairedDiffuse('skin',[tex('head_spec_s')],[],'head.ydd',resolver),null);
 assert.equal(automaticPairedDiffuse('skin',[tex('face'),tex('hair')],[],'head.ydd',resolver),null);
 assert.equal(availableDiffuseTextures([tex('skin'),tex('face_n')]).length,1);
});
test('matched external YTD diffuse overrides embedded grey placeholder',()=>{
 const embedded=tex('original-grey'),external=tex('new_skin');
 assert.equal(automaticPairedDiffuse('original-grey',[external],[embedded],'head.ydd',resolver),external);
});
test('multiple external images leave valid embedded sampler unchanged',()=>{
 const original=tex('original');
 assert.equal(automaticPairedDiffuse('original',[tex('face'),tex('tattoo')],[original],'head.ydd',resolver),original);
});
test('File Manager removes manual force control and attaches automatically by paired family',()=>{
 const ui=readFileSync(new URL('../src/file-manager-ui.js',import.meta.url),'utf8');
 const preview=readFileSync(new URL('../src/file-preview.js',import.meta.url),'utf8');
 const backend=readFileSync(new URL('../electron/ytd-groups.cjs',import.meta.url),'utf8');
 assert.doesNotMatch(ui,/fmForceYtd|forcePick|forcedYtd/);
 assert.match(ui,/textureCandidateIds: \(file\.textures \|\| \[\]\)\.map/);
 assert.match(preview,/automaticPairedDiffuse\(g\.diffuseTexture/);
 assert.match(backend,/pairedTextureNames/);
});
