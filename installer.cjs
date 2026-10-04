'use strict';
const fs=require('node:fs/promises'),path=require('node:path');
const {spawn}=require('node:child_process');
const {replacementScript}=require('./updater.cjs');
async function startReplacement({target,staged,parentPid,bootloaderPid,directory}) {
 if(process.platform!=='win32')throw Error('Pemasangan otomatis tersedia pada EXE Windows.');
 await fs.mkdir(directory,{recursive:true});await fs.access(staged);
 // Check directory writes, rather than W_OK, which does not check Windows ACLs.
 const probe=await fs.mkdtemp(path.join(path.dirname(target),'.ditasha-write-'));
 await fs.rm(probe,{recursive:true});
 const handshakePath=path.join(directory,'install.started'),logPath=path.join(directory,'install.json');
 await fs.rm(handshakePath,{force:true});
 const script=replacementScript({target,staged,parentPid,bootloaderPid,logPath,handshakePath});
 const executable=path.join(process.env.SystemRoot||'C:\\Windows','System32','WindowsPowerShell','v1.0','powershell.exe');
 const env={...process.env};for(const key of Object.keys(env))if(key.startsWith('PORTABLE_'))delete env[key];
 // The helper must survive Electron/NSIS shutdown. On Windows, detached plus
 // windowsHide combines incompatible console creation flags. Let PowerShell
 // hide its own independent console instead.
 const output=await fs.open(path.join(directory,'helper-output.log'),'w');
 const child=spawn(executable,['-NoProfile','-NonInteractive','-WindowStyle','Hidden','-EncodedCommand',Buffer.from(script,'utf16le').toString('base64')],{cwd:path.dirname(target),env,detached:true,windowsHide:false,stdio:['ignore',output.fd,output.fd]});
 try{await new Promise((resolve,reject)=>{child.once('spawn',resolve);child.once('error',reject);});}finally{await output.close();}
 try {
  let started=false;
  for(let i=0;i<150;i++){try{await fs.access(handshakePath);started=true;break;}catch{}if(child.exitCode!==null)break;await new Promise(resolve=>setTimeout(resolve,100));}
  if(!started){const detail=await fs.readFile(path.join(directory,'helper-output.log'),'utf8').catch(()=>'');throw Error('Helper update tidak dapat berjalan (exit '+child.exitCode+'). '+detail.slice(-3000));}
 }catch(error){child.kill();throw error;}
 child.unref();return {logPath};
}
module.exports={startReplacement};
