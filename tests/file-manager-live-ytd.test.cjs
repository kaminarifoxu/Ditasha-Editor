'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const source=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
test('right-side YTD selection updates the existing 3D preview controller',()=>{
 const ui=source('src/file-manager-ui.js');
 const viewer=source('src/file-preview.js');
 assert.match(ui,/activeTextureVariant = texture\.id/);
 assert.match(ui,/modelController\.setTextureVariant\(texture\.id\)/);
 assert.match(ui,/modelController = previewController\?\.setTextureVariant/);
 assert.match(viewer,/const setTextureVariant = async \(textureId\)/);
 assert.match(viewer,/mesh\.material\.map = texture/);
 assert.match(viewer,/request !== textureRequest/);
 assert.match(viewer,/return snapshot \? thumbnail : \{ applyFace, supported:faceMeshes\.length>0, setTextureVariant, setCharacterModel \}/);
});
