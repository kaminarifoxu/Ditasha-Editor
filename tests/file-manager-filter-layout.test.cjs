'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
test('asset filters include gender and GTA clothing slots without changing source files',()=>{
 const backend=read('electron/file-manager.cjs'),ui=read('src/file-manager-ui.js');
 assert.match(backend,/fileGender === gender/);
 assert.match(backend,/fileSlot === slot/);
 assert.match(backend,/mp_f_freemode/);
 assert.match(backend,/mp_m_freemode/);
 assert.match(ui,/gender:activeGender/);
 assert.match(ui,/slot:activeSlot/);
 assert.match(ui,/fm-asset-filter-panel/);
 assert.match(ui,/fm-folder-switch/);
});
test('preview settings rendered as bounded floating popover',()=>{
 const ui=read('src/file-manager-ui.js'),css=read('ui/files-workspace.css');
 assert.match(ui,/fm-preview-settings-body/);
 assert.match(css,/position:absolute;right:0;top:calc\(100% \+ 8px\)/);
 assert.match(css,/\.fm-preview-settings\[open\] \.fm-preview-settings-body/);
});
