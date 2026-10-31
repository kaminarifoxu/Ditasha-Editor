'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const preview=fs.readFileSync(path.join(__dirname,'../src/file-preview.js'),'utf8');
const css=fs.readFileSync(path.join(__dirname,'../ui/files-workspace.css'),'utf8');
test('opaque freemode surface culls backfaces and writes depth',()=>{
 assert.match(preview,/if \(solidFabric && !\/hair\|eyelash/i);
 assert.match(preview,/mesh\.material\.side = THREE\.FrontSide/);
 assert.match(preview,/mesh\.material\.depthWrite = true/);
 assert.match(preview,/mesh\.material\.transparent = false/);
});
test('expanded YTD inspector uses larger atlas viewport',()=>{
 assert.match(css,/minmax\(0, 64fr\) minmax\(320px, 36fr\)/);
 assert.match(css,/max-height:310px!important/);
});
