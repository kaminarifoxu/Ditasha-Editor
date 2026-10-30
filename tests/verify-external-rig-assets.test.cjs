const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {inventory}=require('../scripts/verify-external-rig-assets.cjs');
test('real mod inventory detects YDD/YFT/YTD/YMT and ignores unrelated files',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'ditasha-rig-inventory-'));
 try{
  const sub=path.join(root,'stream');await fs.mkdir(sub);
  for(const name of ['mp_f_freemode_01^uppr_001_u.ydd','ambient_female.yft','ambient_female.ytd','ped.ymt','readme.txt'])await fs.writeFile(path.join(sub,name),'abc');
  const found=await inventory(root);
  assert.equal(found.length,4);
  assert.ok(found.every(f=>f.sha256.length===64));
  assert.ok(found.every(f=>f.relativePath.startsWith('stream/')));
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
