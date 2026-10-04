const { app, BrowserWindow, Menu, dialog, ipcMain, net } = require('electron');
const path = require('node:path');
const {pathToFileURL}=require('node:url');
const {spawn}=require('node:child_process');
const {createPortableUpdater,replacementScript}=require('./updater.cjs');
let win,updater,allowQuit=false;
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) app.quit();
else {
 app.on('second-instance', () => { if(win) { if(win.isMinimized())win.restore();win.focus(); } });
 app.whenReady().then(() => {
  app.setAppUserModelId('com.ganomabi.assetstudio');
  win = new BrowserWindow({width:1500,height:950,minWidth:800,minHeight:600,title:'GANOMABI Asset Studio',backgroundColor:'#100f11',icon:path.join(__dirname,'icon.ico'),show:false,autoHideMenuBar:true,webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true,preload:path.join(__dirname,'preload.cjs')}});
  Menu.setApplicationMenu(null);
  win.webContents.setWindowOpenHandler(() => ({action:'deny'}));
  win.webContents.on('will-navigate', e => e.preventDefault());
  win.webContents.on('will-prevent-unload', e => {
   if(allowQuit){e.preventDefault();return;}
   const choice=dialog.showMessageBoxSync(win,{type:'question',title:'Tutup GANOMABI Asset Studio?',message:'Ada desain yang belum diekspor.',detail:'Ekspor hasilnya sebelum menutup agar perubahan tidak hilang.',buttons:['Kembali ke editor','Tutup aplikasi'],defaultId:0,cancelId:0});
   if(choice===1)e.preventDefault();
  });
  win.webContents.session.setPermissionRequestHandler((_contents,_permission,callback)=>callback(false));
  win.webContents.session.on('will-download', (_event,item) => {
   const result=dialog.showSaveDialogSync(win,{title:'Simpan hasil ekspor',defaultPath:path.join(app.getPath('downloads'),item.getFilename())});
   if (!result) item.cancel(); else item.setSavePath(result);
  });
  win.once('ready-to-show', () => {win.maximize();win.show();});
  updater=createPortableUpdater({version:app.getVersion(),directory:path.join(app.getPath('userData'),'updates'),fetcher:(...args)=>net.fetch(...args),onState:state=>{if(win&&!win.isDestroyed())win.webContents.send('gano:update-state',state);}});
  const trusted=event=>{if(event.sender!==win?.webContents||event.senderFrame?.url!==pathToFileURL(path.join(__dirname,'ui','index.html')).href)throw Error('Untrusted update request');};
  ipcMain.handle('gano:update-state',event=>{trusted(event);return updater.getState();});
  ipcMain.handle('gano:update-check',event=>{trusted(event);return updater.check();});
  ipcMain.handle('gano:update-download',event=>{trusted(event);return updater.download();});
  ipcMain.handle('gano:update-auto',(event,enabled)=>{trusted(event);return updater.setAutoDownload(enabled);});
  ipcMain.handle('gano:update-install',async event=>{
   trusted(event);const staged=updater.getReadyPath(),target=process.env.PORTABLE_EXECUTABLE_FILE;
   if(!staged)throw Error('Unduh update terlebih dahulu.');
   if(process.platform!=='win32'||!target){dialog.showMessageBoxSync(win,{type:'info',message:'Pemasangan otomatis tersedia saat menjalankan EXE portable Windows.'});return false;}
   const unsaved=await win.webContents.executeJavaScript("(()=>{const e=new Event('beforeunload',{cancelable:true});window.dispatchEvent(e);return e.defaultPrevented;})()");
   const choice=dialog.showMessageBoxSync(win,{type:'question',title:'Pasang update GANOMABI?',message:unsaved?'Ada desain yang belum diekspor.':'Update siap dipasang.',detail:unsaved?'Pilih Kembali dan ekspor desainmu lebih dahulu. Pasang update akan menutup aplikasi dan membuka versi baru.':'Aplikasi akan ditutup dan versi baru dibuka di lokasi EXE yang sama.',buttons:['Kembali','Pasang & mulai ulang'],defaultId:0,cancelId:0});
   if(choice!==1)return false;
   const script=replacementScript({target,staged,parentPid:process.pid,logPath:path.join(app.getPath('userData'),'updates','install.log')});
   const executable=path.join(process.env.SystemRoot||'C:\\Windows','System32','WindowsPowerShell','v1.0','powershell.exe');
   const child=spawn(executable,['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-EncodedCommand',Buffer.from(script,'utf16le').toString('base64')],{detached:true,windowsHide:true,stdio:'ignore'});
   await new Promise((resolve,reject)=>{child.once('spawn',resolve);child.once('error',reject);});child.unref();allowQuit=true;app.quit();return true;
  });
  win.webContents.once('did-finish-load',()=>setTimeout(()=>updater.check(),2500));
  win.loadFile(path.join(__dirname,'ui','index.html'));
  win.on('closed', () => {win=null;});
 });
 app.on('window-all-closed', () => app.quit());
}
