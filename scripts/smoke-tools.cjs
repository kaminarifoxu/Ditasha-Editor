'use strict';
const {app,BrowserWindow}=require('electron');
const path=require('node:path'),fs=require('node:fs/promises');
const check=require('./tools-ui-checks.cjs');
app.whenReady().then(async()=>{
 let win;const captures=[];
 try{
  const {testYdd,testYtd}=await import('../format.test.mjs');
  await fs.mkdir(path.resolve('release/qa'),{recursive:true});
  win=new BrowserWindow({width:1500,height:950,show:false,webPreferences:{contextIsolation:true,sandbox:true,nodeIntegration:false,backgroundThrottling:false}});
  win.webContents.on('console-message',(_event,...args)=>{const message=args.map(a=>typeof a==='string'?a:a?.message).find(a=>a?.startsWith('DITASHA_SNAPSHOT:'));if(message){const name=message.split(':')[1];captures.push(win.webContents.capturePage().then(image=>fs.writeFile(path.resolve('release/qa/'+name+'.png'),image.toPNG())));}});
  await win.loadFile(path.resolve('ui/index.html'));
  const report=await win.webContents.executeJavaScript('('+check.toString()+')('+JSON.stringify({ydd:[...new Uint8Array(testYdd)],ytd:[...new Uint8Array(testYtd)]})+')');
  await Promise.all(captures);console.log('PASS: '+JSON.stringify(report));win.destroy();app.exit(0);
 }catch(e){console.error(e);if(win){await fs.writeFile(path.resolve('release/qa/failure.png'),(await win.webContents.capturePage()).toPNG()).catch(()=>{});win.destroy();}app.exit(1);}
});
