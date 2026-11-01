'use strict';
const { app, BrowserWindow } = require('electron');
const path = require('node:path');
app.whenReady().then(async () => {
  let win;
  const errors = [];
  try {
    win = new BrowserWindow({show:true,width:1300,height:850,webPreferences:{
      contextIsolation:true,sandbox:true,nodeIntegration:false,backgroundThrottling:false,
    }});
    win.webContents.on('console-message', (_event, details) => {
      if (details?.level === 'error') errors.push(details.message);
    });
    win.webContents.on('did-fail-load',(_event,code,message)=>errors.push(code+': '+message));
    await win.loadFile(path.resolve('ui/index.html'));
    const state = await win.webContents.executeJavaScript(`(async()=>{
      const $=id=>document.getElementById(id);
      const open=$('openTexture'),input=$('fileInput'),paint=$('brush');
      if(!open||!input||!paint)throw Error('Editor controls are missing');
      // Programmatic click must invoke the application click listener, not navigate.
      let opened=false;const original=input.click.bind(input);
      input.click=()=>{opened=true;};
      open.click();
      input.click=original;
      if(!opened)throw Error('Open Texture has no working event handler');
      const nav=document.querySelector('[data-page="files"]');
      if(!nav)throw Error('File Manager navigation not mounted');
      nav.click();
      if(!document.querySelector('.fm-explorer'))throw Error('File Manager failed to activate');
      return {opened, fileManager:true, title:document.title};
    })()`);
    if(errors.length)throw Error('Renderer errors: '+errors.join(' | '));
    console.log('Editor button smoke PASSED',JSON.stringify(state));
  } catch(e) { console.error(e.stack||e);process.exitCode=1; }
  finally {win?.destroy();app.quit();}
}).catch(e=>{console.error(e);app.quit();process.exitCode=1;});
