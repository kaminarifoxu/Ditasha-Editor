import test from 'node:test';
import assert from 'node:assert/strict';
import { freemodeIdentity, matchingFreemodeTextures, selectFreemodeTexture } from '../src/freemode-texture-pairing.js';
const file=(name,folder='female')=>({name,webkitRelativePath:folder+'/'+name});
test('matches same collection head YDD and variant a YTD only',()=>{
  const head=file('mp_f_freemode_01^head_000_r.ydd');
  const a=file('mp_f_freemode_01^head_diff_000_a_uni.ytd');
  const b=file('mp_f_freemode_01^head_diff_000_b_uni.ytd');
  const male=file('mp_m_freemode_01^head_diff_000_a_uni.ytd','male');
  assert.equal(selectFreemodeTexture(head,[male,b,a],'a','female').file,a);
  assert.deepEqual(matchingFreemodeTextures(head,[b,a],{gender:'female'}).map(x=>x.variant),['a','b']);
});
test('hair does not borrow diffuse from same drawable in another collection',()=>{
  const model=file('mp_f_freemode_01_mp_f_custom^hair_001_u.ydd');
  const wrong=file('mp_f_freemode_01_mp_f_other^hair_diff_001_a_uni.ytd');
  const correct=file('mp_f_freemode_01_mp_f_custom^hair_diff_001_a_uni.ytd');
  assert.equal(selectFreemodeTexture(model,[wrong,correct],'a','female').file,correct);
});
test('missing and ambiguous variants fail closed instead of selecting a random texture',()=>{
 const m=file('hair_001_u.ydd');
 const a=file('hair_diff_001_a_uni.ytd');
 assert.equal(selectFreemodeTexture(m,[a],'b','female').status,'missing');
 assert.equal(selectFreemodeTexture(m,[a,a],'a','female').status,'ambiguous');
});
test('ignores normal/specular and invalid names as diffuse alternatives',()=>{
 const m=file('hair_001_u.ydd');
 assert.deepEqual(matchingFreemodeTextures(m,[file('hair_n_001_a_uni.ytd'),file('hair_001_a_uni.ytd')]),[]);
 assert.equal(freemodeIdentity(file('hair_diff_001_a_uni.ytd')).variant,'a');
});
test('rejects cross-gender textures even when files share drawable and component',()=>{
 const m=file('hair_001_u.ydd','female');
 const t=file('hair_diff_001_a_uni.ytd','male');
 assert.equal(selectFreemodeTexture(m,[t],'a','female').status,'missing');
});

test('Character Maker retains its GLB freemode model import route', async () => {
  const { freemodePart } = await import('../src/freemode-character.js');
  const glb={name:'mp_f_freemode_01^hair_001_u.glb',webkitRelativePath:'female/mp_f_freemode_01^hair_001_u.glb'};
  assert.equal(freemodePart(glb).part,'hair');
  assert.equal(freemodePart(glb).texture,false);
});
