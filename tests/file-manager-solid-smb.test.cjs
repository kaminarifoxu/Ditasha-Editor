'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
test('nested folder view, safe SMB paths, and solid clothing renderer are wired',()=>{
 const ui=fs.readFileSync(path.join(__dirname,'../src/file-manager-ui.js'),'utf8');
 const manager=fs.readFileSync(path.join(__dirname,'../electron/file-manager.cjs'),'utf8');
 const preview=fs.readFileSync(path.join(__dirname,'../src/file-preview.js'),'utf8');
 assert.match(ui,/id="fmRecursive" type="checkbox" checked/);
 assert.match(ui,/smbButton\.id = 'fmSmb'/);
 assert.match(ui,/choose\(\{networkPath:saved\.networkPath\}\)/);
 assert.match(manager,/networkPath\.includes\('\.\.'\)/);
 assert.match(manager,/No passwords or SMB credentials/);
 assert.match(preview,/const solidFabric = outerGarment/);
 assert.match(preview,/depthWrite: solidFabric/);
});
