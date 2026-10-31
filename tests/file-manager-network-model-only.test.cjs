'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');
test('persistent SMB settings use internal Electron storage and in-app chooser',()=>{
 const backend=read('electron/file-manager.cjs'),ui=read('src/file-manager-ui.js');
 const preload=read('electron/preload.cjs');
 assert.match(backend,/file-manager-network\.json/);
 assert.match(backend,/async function networkSettings/);
 assert.match(backend,/networkSettings,\s*state/);
 assert.match(preload,/ditasha:files-networkSettings/);
 assert.match(ui,/data-connect/);
 assert.match(ui,/choose\(\{networkPath:saved\.networkPath\}\)/);
});
test('model-only view applies server-side without hiding YTD companions from selected 3D model',()=>{
 const backend=read('electron/file-manager.cjs'),ui=read('src/file-manager-ui.js');
 assert.match(backend,/const modelOnly=value\.modelOnly===true/);
 assert.match(backend,/pairTextureGroups\(queried\)/);
 assert.match(backend,/visibleQuery=\s*modelOnly/);
 assert.match(ui,/modelOnly = true/);
 assert.match(ui,/modelOnly,/);
 assert.match(ui,/fmModelOnly/);
});
