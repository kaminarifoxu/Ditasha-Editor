'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {ensureBundledFreemode}=require('../electron/bundled-freemode.cjs');
test('auto imports built-in male and female GTA assets exactly once',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'ditasha-builtin-'));
 try{
  const base=path.join(root,'freemode-reference','mp_freemode');
  for(const gender of ['mp_m_freemode_01','mp_f_freemode_01']){
   const folder=path.join(base,gender);
   await fs.mkdir(folder,{recursive:true});
   await fs.writeFile(path.join(folder,'head_000_r.ydd'),Buffer.from('RSC7'));
  }
  const {ClothingLibrary}=require('../electron/clothing-library.cjs');
  const library=new ClothingLibrary(path.join(root,'local'));
  const first=await ensureBundledFreemode(library,root);
  assert.equal(first.available,true);
  assert.equal(first.imported,true);
  const list=await library.list();
  assert.equal(list.length,1);
  assert.equal(list[0].files.length,2);
  assert.deepEqual(list[0].files.map(f=>f.gender).sort(),['female','male']);
  const second=await ensureBundledFreemode(library,root);
  assert.equal(second.imported,false);
  assert.equal((await library.list()).length,1);
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
test('missing packaged assets do not crash the Editor',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'ditasha-no-builtin-'));
 try{
  const data=await ensureBundledFreemode({list:async()=>[]},root);
  assert.equal(data.available,false);
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
