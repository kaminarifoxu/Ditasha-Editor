'use strict';
const {app,BrowserWindow}=require('electron');
const path=require('node:path'),fs=require('node:fs/promises');
const check=require('./tools-ui-checks.cjs'),checkArchives=require('./archive-ui-checks.cjs'),checkViewers=require('./viewers-ui-checks.cjs');
app.whenReady().then(async()=>{
 let win;const captures=[];
 try{
  const {testYdd,testYtd}=await import('../format.test.mjs');
  await fs.mkdir(path.resolve('release/qa'),{recursive:true});
  win=new BrowserWindow({width:1500,height:950,show:false,webPreferences:{contextIsolation:true,sandbox:true,nodeIntegration:false,backgroundThrottling:false}});
  win.webContents.on('console-message',(_event,...args)=>{const message=args.map(a=>typeof a==='string'?a:a?.message).find(a=>a?.startsWith('DITASHA_SNAPSHOT:'));if(message){const name=message.split(':')[1];captures.push(win.webContents.capturePage().then(image=>fs.writeFile(path.resolve('release/qa/'+name+'.png'),image.toPNG())));}});
  await win.loadFile(path.resolve('ui/index.html'));
  const report=await win.webContents.executeJavaScript('('+check.toString()+')('+JSON.stringify({ydd:[...new Uint8Array(testYdd)],ytd:[...new Uint8Array(testYtd)]})+')');
  const {writeRpf}=await import('../src/archives.js');const {zipFiles}=await import('../src/asset-tools.js');const ytd=new Uint8Array(testYtd);const rpf=writeRpf([{name:'textures/test.ytd',data:ytd},{name:'nested.rpf',data:writeRpf([{name:'readme.txt',data:new TextEncoder().encode('nested')}])},{name:'readme.txt',data:new TextEncoder().encode('test')}]);const xml='<package version="2.2" target="Five" id="{12345678-90AB-CDEF-1234-567890ABCDEF}"><metadata><name>Test package</name><author><displayName>Workshop</displayName></author></metadata><colors/><content><add source="content/test.ytd">mods/test.ytd</add></content></package>';const oiv=zipFiles([{name:'assembly.xml',data:xml},{name:'content/test.ytd',data:ytd}]);const archiveReport=await win.webContents.executeJavaScript('('+checkArchives.toString()+')('+JSON.stringify({rpf:[...rpf],oiv:[...oiv],ytd:[...ytd]})+')');for(const save of archiveReport.saves.filter(s=>s.name.endsWith('.rpf'))){const {openArchive}=await import('../src/archives.js');const archive=await openArchive(new Blob([new Uint8Array(save.data)]),save.name);if(!archive.entries.some(e=>e.name==='textures/test.ytd'))throw Error('Rebuilt RPF missing texture');}archiveReport.saves=archiveReport.saves.map(s=>({name:s.name,size:s.data.length}));const {viewerModel}=await import('../viewer-format.test.mjs');const viewerReport=await win.webContents.executeJavaScript('('+checkViewers.toString()+')('+JSON.stringify({ytd:[...ytd],model:[...new Uint8Array(viewerModel)],requireWebgl:true})+')');await Promise.all(captures);console.log('PASS: '+JSON.stringify({report,archiveReport,viewerReport}));win.destroy();app.exit(0);
 }catch(e){console.error(e);if(win){await fs.writeFile(path.resolve('release/qa/failure.png'),(await win.webContents.capturePage()).toPNG()).catch(()=>{});win.destroy();}app.exit(1);}
});
