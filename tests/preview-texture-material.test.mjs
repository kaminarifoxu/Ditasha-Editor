import test from 'node:test';
import assert from 'node:assert/strict';
import { previewMaterialAlpha, textureAlphaStats, resolveVariantDiffuse } from '../src/preview-texture-material.js';
import { resolveModelTexture } from '../src/model-material.js';

const texture=(name,alphas)=>({name,out:Uint8Array.from(alphas.flatMap(a=>[0,0,0,a]))});
test('eyelash cards with transparent atlas pixels use cutout instead of opaque black planes',()=>{
  const t=texture('face_diffuse',[0,0,255,255]);
  assert.equal(textureAlphaStats(t).transparent,2);
  const settings=previewMaterialAlpha({name:'eyelashes',diffuseTexture:'face_diffuse'},t,'head_001_u.ydd');
  assert.ok(settings.alphaTest>0);
  assert.equal(settings.transparent,false);
});
test('opaque police fabric keeps its alpha data opaque',()=>{
  const t=texture('cloth',[0,90,255,255]);
  const settings=previewMaterialAlpha({diffuseTexture:'cloth'},t,'mp_m_freemode_01^jbib_015_u.ydd');
  assert.equal(settings.transparent,false);
  assert.equal(settings.alphaTest,0);
});
test('switching YTD does not assign unrelated single texture to a missing sampler',()=>{
 const src={name:'patch',dictionary:'police.ytd'};
 assert.equal(resolveVariantDiffuse('eyelash',[src],[],'police.ydd',resolveModelTexture),null);
 assert.equal(resolveVariantDiffuse('patch',[src],[],'police.ydd',resolveModelTexture),src);
});
test('transparent and opaque textures produce different material decisions on variant changes',()=>{
 const g={name:'eyelash_card',diffuseTexture:'head'};
 assert.ok(previewMaterialAlpha(g,texture('head',[0,255]),'head_000_u.ydd').alphaTest>0);
 assert.equal(previewMaterialAlpha(g,texture('head',[255,255]),'head_000_u.ydd').alphaTest,0);
});
