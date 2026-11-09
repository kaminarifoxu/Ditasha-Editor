'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
test('small preview and thumbnail load YTD before first 3D draw',()=>{
 const viewer=fs.readFileSync(path.join(__dirname,'../src/file-preview.js'),'utf8');
 const ui=fs.readFileSync(path.join(__dirname,'../src/file-manager-ui.js'),'utf8');
 assert.match(viewer,/textureId = null/);
 assert.match(viewer,/textureId \|\| data\.companion\?\.id/);
 assert.match(viewer,/const dictionary = await api\.read\(id\)/);
 assert.match(ui,/assetPreview\.show\(file, api\(\), \{/);
 assert.match(ui,/textureId: activeTextureVariant \|\| file\.textures\?\.\[0\]\?\.id/);
 assert.match(ui,/snapshot: true/);
 assert.match(ui,/textureCandidateIds: \(file\.textures \|\| \[\]\)\.map/);
});
