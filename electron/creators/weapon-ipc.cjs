'use strict';
const path = require('node:path');
const { createJobManager } = require('./job-manager.cjs');
const { createWeaponFolderGrants, validateWeaponBuildRequest, inspectWeaponSource } = require('./weapon-schema.cjs');
const { buildNativeWeapon } = require('./weapon-build.cjs');
const { SPECS } = require('../gta-tools.cjs');

function registerWeaponCreator({ipcMain,trusted,app,dialog,win}={}) {
  if (!ipcMain?.handle || !app?.getPath || typeof trusted !== 'function')
    throw Error('Missing weapon creator IPC dependencies');
  const grants=createWeaponFolderGrants();
  const jobs=createJobManager({concurrency:1,maxQueued:8,maxHistory:64,timeoutMs:20*60*1000});
  const auth=event=>{trusted(event);};
  const directory=async (event,kind) => {
    auth(event);
    if (!['source','output'].includes(kind)) throw Error('Invalid weapon directory kind');
    const result=await dialog.showOpenDialog(win,{
      title:kind==='source'?'Choose prepared native weapon folder (paired YDR + YTD)':'Choose GTA/FiveM weapon output folder',
      properties:['openDirectory'],
    });
    if (result.canceled || result.filePaths?.length!==1) return null;
    return grants.issue(kind,result.filePaths[0]);
  };
  ipcMain.handle('ditasha:weapon-pick',directory);
  ipcMain.handle('ditasha:weapon-revoke',(event,token)=>{auth(event);return grants.revoke(token);});
  ipcMain.handle('ditasha:weapon-deps',async event=>{
    auth(event);
    const root=app.getPath('userData');
    try {
      const { managedExecutable }=require('./prop-build.cjs');
      await managedExecutable(path.join(root,'native-tools'));
      const state=await require('../gta-tools.cjs').createGtaTools({root:path.join(root,'gta-tools')}).state();
      const awb=state.tools.find(tool=>tool.id==='weapons');
      return {managedBlender:true,addonWeaponsBuilder:awb?.installed===true,
        message:awb?.installed===true
          ? 'Managed Blender and AddonWeaponsBuilder detected. Native weapon round-trip still runs before packaging.'
          : 'Blender detected. Install verified AddonWeaponsBuilder 2.0.0 in its existing tool panel.'};
    } catch(error) {
      return {managedBlender:false,addonWeaponsBuilder:false,
        message:'Native engine is not ready: '+String(error.message||error).slice(0,500)};
    }
  });
  ipcMain.handle('ditasha:weapon-start',async (event,request)=>{
    auth(event);
    const validated=validateWeaponBuildRequest(request);
    const source=await grants.resolve(validated.sourceToken,'source');
    await grants.resolve(validated.outputToken,'output');
    await inspectWeaponSource(source,validated.reference);
    const job=jobs.submit('weapon',({signal})=>buildNativeWeapon({
      request:validated,grants,userDataRoot:app.getPath('userData'),signal,
    }));
    return {jobId:job.id};
  });
  ipcMain.handle('ditasha:weapon-job',(event,id)=>{
    auth(event);
    const current=jobs.snapshot(id);
    return current?{...current,result:jobs.result(id)}:null;
  });
  ipcMain.handle('ditasha:weapon-cancel',(event,id)=>{auth(event);return jobs.cancel(id);});
  app.on?.('before-quit',()=>{jobs.close();grants.clear();});
  return Object.freeze({grants,jobs});
}
module.exports={registerWeaponCreator};
