import test from 'node:test';
import assert from 'node:assert/strict';
import { toIlleniumAppearance, fromIlleniumAppearance,faceFeatureNames,overlayNames } from '../src/character-appearance.js';
test('male and female appearance export follows FiveM data contract',()=>{
 for(const gender of ['male','female']){
  const source={gender,appearance:{shapeFirst:12,shapeSecond:24,skinMix:0.3,
    features:Array.from({length:20},(_,i)=>i/100),overlays:Array.from({length:13},(_,i)=>i),
    eyeColor:6,hairColor:10}};
  const output=toIlleniumAppearance(source);
  assert.equal(output.model,gender==='male'?'mp_m_freemode_01':'mp_f_freemode_01');
  assert.deepEqual(Object.keys(output.faceFeatures),faceFeatureNames);
  assert.deepEqual(Object.keys(output.headOverlays),overlayNames);
  assert.equal(output.faceFeatures.noseWidth,0);
  assert.equal(output.faceFeatures.neckThickness,0.19);
  assert.equal(output.headBlend.shapeFirst,12);
  const imported=fromIlleniumAppearance(output);
  assert.equal(imported.gender,gender);
  assert.equal(imported.appearance.features[19],0.19);
  assert.equal(imported.appearance.eyeColor,6);
 }
});
test('unsupported ped model rejected when importing appearance',()=>{
 assert.throws(()=>fromIlleniumAppearance({model:'a_c_boar'}),/tidak valid/);
});
