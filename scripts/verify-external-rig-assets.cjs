'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const pathRe = /\.(ydd|yft|ytd|ymt)$/i;
async function inventory(root) {
  const result = [];
  const pending = [path.resolve(root)];
  while(pending.length) {
    const dir=pending.pop();
    for(const item of await fs.readdir(dir,{withFileTypes:true})) {
      if(item.isSymbolicLink()) continue;
      const full=path.join(dir,item.name);
      if(item.isDirectory()) pending.push(full);
      else if(item.isFile() && pathRe.test(item.name)) {
        const stat=await fs.stat(full);
        if(stat.size>256*1024*1024) throw Error('Oversized asset: '+item.name);
        const bytes=await fs.readFile(full);
        result.push({relativePath:path.relative(root,full).replaceAll('\\','/'),extension:path.extname(full).toLowerCase(),bytes:stat.size,sha256:crypto.createHash('sha256').update(bytes).digest('hex')});
      }
      if(result.length>10000) throw Error('Too many assets');
    }
  }
  return result.sort((a,b)=>a.relativePath.localeCompare(b.relativePath));
}
async function run() {
  const sources=[['MP Characters Overhaul',process.env.DITASHA_MP_OVERHAUL_DIR],['Ambient Female Ped',process.env.DITASHA_AMBIENT_FEMALE_DIR]];
  const report={generatedAt:new Date().toISOString(),sources:[]};
  for(const [name,folder] of sources){
    if(!folder){report.sources.push({name,status:'not-provided',models:0,rigVerified:false});continue;}
    const files=await inventory(folder);
    const models=files.filter(f=>f.extension==='.ydd');
    report.sources.push({name,status:models.length?'inventory-ready':'no-ydd',files,models:models.length,rigVerified:false,notes:'File hashes and presence only. Rig/bone verification requires actual decoded skeleton/skin and poses.'});
  }
  const output=path.resolve(process.env.DITASHA_RIG_REPORT||'rig-verification-report.json');
  await fs.writeFile(output,JSON.stringify(report,null,2));
  process.stdout.write(JSON.stringify(report.sources.map(({name,status,models,rigVerified})=>({name,status,models,rigVerified})))+'\n');
}
if(require.main===module)run().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={inventory};
