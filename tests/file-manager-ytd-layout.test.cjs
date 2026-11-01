'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
test('File Manager keeps YTD inspector separate from 3D viewport',()=>{
 const ui=read('src/file-manager-ui.js');
 const css=read('ui/files-workspace.css');
 assert.match(ui,/meta\.className = 'fm-inspector-meta'/);
 assert.match(ui,/\['#fmName','#fmDetails','#fmNote','\.fm-open-actions','#fmYtdPreview'/);
 assert.match(ui,/inspector\.append\(meta\)/);
 assert.doesNotMatch(ui,/button\.onclick = \(\) => assetPreview\.show\(\{id:data\.companion\.id/);
 assert.match(css,/grid-template-columns:minmax\(0, 7fr\) minmax\(235px, 3fr\)/);
 assert.match(css,/\.fm-preview-expanded #fmImage[\s\S]*?grid-column:1/);
 assert.match(css,/\.fm-preview-expanded \.fm-inspector-meta[\s\S]*?grid-column:2/);
});
