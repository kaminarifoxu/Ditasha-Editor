'use strict';
const {app,BrowserWindow}=require('electron');
const path=require('node:path');
async function smoke(){
 const win=new BrowserWindow({width:1400,height:900,show:true,webPreferences:{contextIsolation:true,sandbox:true,nodeIntegration:false}});
 try{
  await win.loadFile(path.resolve('ui/index.html'));
  const out=await win.webContents.executeJavaScript("(async()=>{for(let i=0;i<80&&!document.querySelector('.wd-native-weapon');i++)await new Promise(r=>setTimeout(r,100));const nav=document.querySelector('[data-page=weapons]');if(!nav)throw Error('No weapon navigation');nav.click();const panel=document.querySelector('.wd-native-weapon');if(!panel||!panel.open||!panel.querySelector('[data-wn-custom]'))throw Error('Missing primary YDR/YTD export');if(!document.querySelector('#wdExport')?.textContent.includes('GLB backup'))throw Error('GLB must be optional backup');const prop=document.querySelector('.prop-creator-workspace');if(prop&&!prop.hidden)throw Error('Prop Creator affected');return 'WEAPON_M2C_UI_OK';})()");
  console.log(out);
 }finally{win.destroy();app.quit();}
}
app.whenReady().then(smoke).catch(e=>{console.error(e);process.exitCode=1;app.quit();});
