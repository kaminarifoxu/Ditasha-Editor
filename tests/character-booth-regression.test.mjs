import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateBoothScene } from '../src/booth-library.js';
import { createActorMotion } from '../src/booth-actors.js';

const fakeFile = (name) => Object.assign(new Blob([1,2,3]), { name });
const scene = () => ({
 version:1,
 assets:[{file:fakeFile('mp_f_freemode_01^head_000_r.ydd'),kind:'ped',oldId:1,
   ownerIndex:null,offset:[0,0,0],yaw:0,scale:1,motion:createActorMotion(),hiddenSlots:[],
   characterPresetId:'12345678-a123-4bcd-8abc-123456789abc',
   characterAppearance:{shapeMix:0.4,features:[0.2,-0.3],overlays:[0,2]},
   characterMorphPack:{version:1,vertexCount:3,
     targets:[{key:'feature:0',deltas:[0.1,0,0,0,0,0,0,0,0]}]}}],
 textureFiles:[],clipFiles:[]
});

test('saved freemode character keeps facial morph and appearance metadata',()=>{
  const record=scene();
  assert.equal(validateBoothScene(record),record);
  assert.equal(record.assets[0].characterMorphPack.targets[0].deltas[0],0.1);
  assert.equal(record.assets[0].characterAppearance.features[0],0.2);
});
test('old Photo Booth presets without Character Maker fields remain valid',()=>{
 const old=scene();delete old.assets[0].characterPresetId;
 delete old.assets[0].characterAppearance;delete old.assets[0].characterMorphPack;
 assert.equal(validateBoothScene(old),old);
});
test('invalid morphs or oversized appearance are rejected before persistence',()=>{
 const bad=scene();bad.assets[0].characterMorphPack.targets[0].deltas[0]=Infinity;
 assert.throws(()=>validateBoothScene(bad),/Morph wajah/);
 const oversized=scene();oversized.assets[0].characterAppearance.description='x'.repeat(10000);
 assert.throws(()=>validateBoothScene(oversized),/Appearance karakter/);
 const invalid=scene();invalid.assets[0].characterPresetId='../outside';
 assert.throws(()=>validateBoothScene(invalid),/ID Character Maker/);
});
test('Photo Booth snapshot stores Character Maker metadata and makes head primary',()=>{
 const source=readFileSync(new URL('../src/photo-booth-ui.js',import.meta.url),'utf8');
 assert.match(source,/characterMorphPack: a\.characterMorphPack \|\| null/);
 assert.match(source,/characterAppearance: a\.characterAppearance \|\| null/);
 assert.match(source,/planFreemodeActor\(pending\)/);
 assert.match(source,/await restoreScene\(await library\.get\(row\.id\)\)/);
});
