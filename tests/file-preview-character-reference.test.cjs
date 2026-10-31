'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
test('expanded preview has optional user-supplied character reference model',()=>{
 const ui=read('src/file-manager-ui.js'),engine=read('src/file-preview.js');
 assert.match(ui,/data-with-character/);
 assert.match(ui,/data-use-base/);
 assert.match(ui,/characterReference=\{id:picked\.id,name:picked\.name,gender:referenceGender\(picked\)\}/);
 assert.match(ui,/modelController\.setCharacterModel\(characterReference\)/);
 assert.match(engine,/const setCharacterModel = async \(reference\)/);
 assert.match(engine,/await decodeResource\(kind, new Uint8Array\(bytes\.data\)\.buffer\)/);
 assert.match(engine,/setTextureVariant, setCharacterModel/);
});

test('automatic freemode reference follows the selected asset while manual reference stays pinned',()=>{
 const ui=read('src/file-manager-ui.js');
 assert.match(ui,/let characterReferenceIsAutomatic = false/);
 assert.match(ui,/characterReferenceIsAutomatic \|\|/);
 assert.match(ui,/characterReferenceIsAutomatic=true/);
 assert.match(ui,/characterReferenceIsAutomatic=false/);
 assert.match(ui,/item\.textureVariant === 'a'/);
});

test('switching model reference cannot commit an out-of-date async body',()=>{
 const engine=read('src/file-preview.js');
 assert.match(engine,/let characterRequest = 0/);
 assert.match(engine,/const request = \+\+characterRequest/);
 assert.match(engine,/request !== characterRequest/);
 assert.match(engine,/bodyReference = nextReference/);
});
