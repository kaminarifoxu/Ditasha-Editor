import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { scorePreviewDictionary, shouldTryPreviewFallback } from '../src/file-preview-texture-selection.js';

const rgba = (name) => ({ name, w:1, h:1, out:new Uint8Array([180,100,90,255]) });
const head = [{name:'Head',diffuseTexture:'head_diff_002_a_bla'}];
test('a head dictionary resolves its requested diffuse by internal sampler name, not YTD filename',()=>{
  const wrong=[rgba('head_spec_000')];
  const correct=[rgba('head_diff_002_a_bla')];
  assert.equal(scorePreviewDictionary(head,wrong,'mp_f_freemode_01_cpxhead^head_000_u.ydd'),0);
  assert.equal(shouldTryPreviewFallback(head,wrong,'mp_f_freemode_01_cpxhead^head_000_u.ydd'),true);
  assert.equal(scorePreviewDictionary(head,correct,'mp_f_freemode_01_cpxhead^head_000_u.ydd'),1);
  assert.equal(shouldTryPreviewFallback(head,correct,'mp_f_freemode_01_cpxhead^head_000_u.ydd'),false);
});
test('never assign unrelated diffuse to head even when the YTD has exactly one texture',()=>{
 assert.equal(scorePreviewDictionary(head,[rgba('hair_diff_000_a_uni')],'head_000_u.ydd'),0);
});
test('paired hair texture resolves only hair sampler, not separate head sampler',()=>{
 const hair=[{name:'Hair',diffuseTexture:'hair_diff_001_a_uni'}];
 assert.equal(scorePreviewDictionary(hair,[rgba('hair_diff_001_a_uni')],'hair_001_u.ydd'),1);
 assert.equal(scorePreviewDictionary(head,[rgba('hair_diff_001_a_uni')],'head_000_u.ydd'),0);
});
test('embedded-only and textureless models do not force alternate YTD lookups',()=>{
 const embedded=[{...head[0],sourceEmbeddedTextures:[rgba('head_diff_002_a_bla')]}];
 assert.equal(scorePreviewDictionary(embedded,[], 'head_000_u.ydd'),0);
 assert.equal(shouldTryPreviewFallback([{name:'No sampler'}],[], 'model.ydd'),false);
});
test('File Manager tests both thumbnail and inspector against paired IDs',()=>{
 const viewer=readFileSync(new URL('../src/file-preview.js',import.meta.url),'utf8');
 const manager=readFileSync(new URL('../src/file-manager-ui.js',import.meta.url),'utf8');
 assert.match(viewer,/scorePreviewDictionary\(geometric, decoded, file\.name\)/);
 assert.match(viewer,/textureCandidateIds\.slice\(0, 12\)/);
 assert.match(manager,/textureCandidateIds: \(file\.textures \|\| \[\]\)\.map/);
 assert.match(manager,/onTextureResolved:/);
});
