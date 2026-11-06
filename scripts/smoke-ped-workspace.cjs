'use strict';
const {app,BrowserWindow}=require('electron');
const path=require('node:path');
async function smoke(){
 const win=new BrowserWindow({width:1510,height:940,show:true,webPreferences:{contextIsolation:true,sandbox:true,nodeIntegration:false,backgroundThrottling:false}});
 try{
  await win.loadFile(path.resolve('ui/index.html'));
  const outcome=await win.webContents.executeJavaScript(`(async()=>{
   for(let i=0;i<100&&!document.getElementById('openNativeBuild');i++)await new Promise(r=>setTimeout(r,70));
   const trigger=document.getElementById('openNativeBuild');
   if(!trigger)throw Error('Rig Ped workspace entry unavailable');
   trigger.click();
   await new Promise(r=>setTimeout(r,450));
   const root=document.getElementById('nativeBuildDialog');
   const center=root?.querySelector('.native-build-layout > section');
   const preview=root?.querySelector('.native-preview');
   const viewport=root?.querySelector('#nbViewport');
   if(!root||root.hidden||!center||!preview||preview.parentElement!==center||preview.hidden)
     throw Error('Ped 3D viewport missing from the center of workspace');
   const rect=viewport?.getBoundingClientRect();
   if(!rect||rect.width<300||rect.height<250)
     throw Error('Ped middle 3D viewport collapsed: '+JSON.stringify({width:rect?.width,height:rect?.height}));
   const button=preview.querySelector('#nbPedPreviewAction');
   if(!button||!button.textContent.includes('Preview selected model'))
     throw Error('Missing visible preview source action');
   if(!button.disabled)
     throw Error('Cannot request a preview without a selected ped source');
   const inspector=root.querySelector('#nbSourcePanel');
   if(!inspector||inspector.getBoundingClientRect().width<180)
     throw Error('Ped rig inspector is too narrow');
   if(getComputedStyle(inspector.querySelector('.rig-option-grid')).gridTemplateColumns.split(' ').length>1)
     throw Error('Ped checkbox grid is cramped into multiple narrow columns');
   return {passed:true,viewportWidth:Math.round(rect.width),viewportHeight:Math.round(rect.height)};
  })()`);
  console.log(JSON.stringify(outcome));
 }finally{win.destroy();app.quit();}
}
app.whenReady().then(smoke).catch(e=>{console.error(e);process.exitCode=1;app.quit();});
