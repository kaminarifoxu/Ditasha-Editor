'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {CharacterPresets}=require('../electron/character-presets.cjs');
test('saved character restores its morph pack after reopening local database',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'ditasha-morph-presets-'));
 try{
  const pack={version:1,vertexCount:3,targets:[{key:'feature:0',deltas:[0.2,0,0,0,0,0,0,0,0]}]};
  const store=new CharacterPresets(root);
  const saved=await store.save({name:'Freemode test',gender:'female',morphPack:pack});
  const reopened=new CharacterPresets(root);
  const character=(await reopened.list()).find(x=>x.id===saved.id);
  assert.deepEqual(character.morphPack,pack);
  await assert.rejects(reopened.save({name:'bad',gender:'female',morphPack:{version:1,vertexCount:3,targets:[{key:'feature:0',deltas:[NaN]}]}}),/Invalid/);
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
