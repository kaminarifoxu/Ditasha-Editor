'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
(async()=>{
 if(process.platform!=='win32')throw Error('Windows only');
 const root=await fs.mkdtemp(path.join(os.tmpdir(),"Ditasha's portable test "));
 const target=path.join(root,'DITASHA-Editor.exe');
 try {
  await fs.copyFile(path.resolve('release/DITASHA-Editor.exe'),target);
  const child=spawn(target,[],{cwd:root,env:{...process.env,DITASHA_UPDATE_SMOKE_ROOT:root},stdio:'ignore'});
  const errors=[];child.on('error',e=>errors.push(e));
  const deadline=Date.now()+2*60*1000;let nextReport=0;
  while(Date.now()<deadline){
   if(errors.length)throw errors[0];
   if(Date.now()>nextReport){nextReport=Date.now()+10000;for(const file of ['phase.json','helper/install.json','helper/helper-output.log','result.json']){try{console.log(file+': '+(await fs.readFile(path.join(root,file),'utf8')).slice(-3000));}catch{}}console.log('portable launcher exit:',child.exitCode);}
   try{throw Error(await fs.readFile(path.join(root,'failure.txt'),'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
   let result,report;
   try{result=JSON.parse(await fs.readFile(path.join(root,'result.json'),'utf8'));}catch{}
   try{report=JSON.parse((await fs.readFile(path.join(root,'helper','install.json'),'utf8')).replace(/^\uFEFF/,''));}catch{}
   if(report?.status==='error')throw Error(report.message);
   if(result&&report?.status==='success'){
    assert.equal(result.version,require('../package.json').version);
    assert.equal(result.target.toLowerCase(),target.toLowerCase());
    assert.notEqual(result.pid,result.oldPid,'Restart must launch a new Electron process');
    assert.equal(result.staleRuntime,false,'NSIS must clean the old extraction before restart');
    assert(result.downloaded>1000000,'Real release was downloaded and verified');
    try{await fs.access(result.oldRuntime);}catch{try{await fs.unlink(target);console.log('PASS: real GitHub download, portable EXE replacement, fresh runtime restart and old runtime cleanup.');return;}catch{}}
   }
   await new Promise(r=>setTimeout(r,500));
  }
  throw Error('Portable update did not finish. Root: '+root);
 }finally{await fs.rm(root,{recursive:true,force:true,maxRetries:20,retryDelay:500}).catch(e=>console.error('Cleanup: '+e.message));}
})().catch(e=>{console.error(e);process.exitCode=1;});
