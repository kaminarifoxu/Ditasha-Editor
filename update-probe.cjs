// CI-only probe runs the same download and replacement code as the editor.
'use strict';
const fs=require('node:fs/promises'),path=require('node:path');
const {createPortableUpdater}=require('./updater.cjs');
const {startReplacement}=require('./installer.cjs');
async function run(app,net){
 const root=process.env.DITASHA_UPDATE_SMOKE_ROOT;
 try {
  const statePath=path.join(root,'state.json');let state;
  try{state=JSON.parse(await fs.readFile(statePath,'utf8'));}catch{}
  if(state){
   await fs.writeFile(path.join(root,'result.json'),JSON.stringify({version:app.getVersion(),runtime:process.execPath,target:process.env.PORTABLE_EXECUTABLE_FILE,oldRuntime:state.runtime,downloaded:state.downloaded}));
   app.quit();return;
  }
  // Download the current public release with Electron's real network stack.
  const updater=createPortableUpdater({version:'1.0.0',directory:path.join(root,'download'),fetcher:(...args)=>net.fetch(...args)});
  await updater.setAutoDownload(true);const result=await updater.check();if(result.status!=='ready')throw Error(result.message);
  const downloaded=(await fs.stat(updater.getReadyPath())).size;
  const stage=path.join(root,'stage');await fs.mkdir(stage);
  const staged=path.join(stage,'update.exe'),target=process.env.PORTABLE_EXECUTABLE_FILE;
  await fs.copyFile(target,staged);
  await fs.writeFile(statePath,JSON.stringify({runtime:process.execPath,downloaded}));
  await startReplacement({target,staged,parentPid:process.pid,bootloaderPid:process.ppid,directory:path.join(root,'helper')});
  app.quit();
 }catch(error){await fs.writeFile(path.join(root,'failure.txt'),error.stack);app.exit(1);}
}
module.exports={run};
