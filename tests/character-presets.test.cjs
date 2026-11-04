'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const { CharacterPresets }=require('../electron/character-presets.cjs');
test('character maker stores male and female presets and preserves facial settings', async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'ditasha-character-'));
 try{
   const store=new CharacterPresets(root);
   assert.deepEqual(await store.list(),[]);
   const female=await store.save({name:'Freemode Female',gender:'female',appearance:{
     shapeFirst:12,shapeSecond:7,shapeMix:0.62,skinMix:0.41,
     eyeColor:8,hairColor:12,features:[0.4,-0.3],overlays:[2,3]
   }});
   const male=await store.save({name:'Freemode Male',gender:'male',appearance:{features:[-0.25]}});
   assert.notEqual(male.id,female.id);
   let saved=await store.list();
   assert.equal(saved.length,2);
   assert.equal(saved[0].appearance.shapeMix,0.62);
   assert.equal(saved[0].appearance.features.length,20);
   assert.equal(saved[0].appearance.overlays.length,13);
   assert.equal(saved[1].appearance.features[0],-0.25);
   await store.save({...female,name:'Female Updated'});
   saved=await store.list();
   assert.equal(saved.length,2);
   assert.equal(saved[0].name,'Female Updated');
   assert.equal(await store.remove(male.id),true);
   assert.equal((await store.list()).length,1);
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
test('character presets validate gender, IDs and normalize unsafe input',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'ditasha-character-'));
 try{
   const store=new CharacterPresets(root);
   await assert.rejects(store.save({name:'A',gender:'other'}),/Invalid/);
   await assert.rejects(store.save({name:'A',gender:'male',outfitId:'../../bad'}),/Invalid/);
   const saved=await store.save({name:'Normal',gender:'male',appearance:{
     shapeMix:40,skinMix:-10,features:[12],overlays:[999]
   }});
   assert.equal(saved.appearance.shapeMix,1);
   assert.equal(saved.appearance.skinMix,0);
   assert.equal(saved.appearance.features[0],1);
   assert.equal(saved.appearance.overlays[0],255);
 }finally{await fs.rm(root,{recursive:true,force:true});}
});

test('saved character retains rig mode and hair/head UV calibration across reload', async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'ditasha-character-rig-'));
 try {
  const store=new CharacterPresets(root);
  const settings={skeletonMode:'strict',headUv:[0.1,-0.05,1.15,1.15],hairUv:[-0.2,0.15,0.9,0.9]};
  const saved=await store.save({name:'Rigged female',gender:'female',pedSettings:settings});
  const another=new CharacterPresets(root);
  const loaded=(await another.list()).find(c=>c.id===saved.id);
  assert.deepEqual(loaded.pedSettings,settings);
  await another.save({...loaded,name:'Updated head UV'});
  assert.equal((await store.list()).length,1);
  assert.deepEqual((await store.list())[0].pedSettings,settings);
  for(const invalid of [
   {...settings,headUv:[Infinity,0,1,1]},
   {...settings,headUv:[0,0,0,1]},
   {...settings,skeletonMode:'unsafe'},
   {...settings,extra:'shell'},
  ])await assert.rejects(store.save({name:'Invalid',gender:'female',pedSettings:invalid}),/Invalid/);
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
