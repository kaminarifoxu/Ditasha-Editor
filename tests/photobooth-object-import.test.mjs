import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { actorForAsset, createActorMotion } from '../src/booth-actors.js';
import { outfitCategory, outfitLabel } from '../src/booth-outfits.js';
import { validateBoothScene } from '../src/booth-library.js';

const ui = readFileSync(new URL('../src/photo-booth-ui.js', import.meta.url), 'utf8');
const glb = (name='chair.glb') => ({name, size:1024, arrayBuffer:async()=>new ArrayBuffer(1024)});
const scene = (file=glb(), kind='object') => ({
  version:1, textureFiles:[], clipFiles:[],
  assets:[{
    file, kind, category:'object', oldId:1, ownerIndex:null,
    offset:[1.5,0,0], scale:1, yaw:0, hiddenSlots:[], motion:createActorMotion()
  }]
});

test('GLB objects are independent actors, not ped attachments', () => {
  const ped={id:1,kind:'ped'}, object={id:2,kind:'object',owner:null};
  assert.equal(actorForAsset([ped,object],object),object);
  assert.equal(outfitCategory('room-chair.glb','auto','object'),'object');
  assert.equal(outfitLabel('object'),'Objek 3D');
});
test('Photo Booth exposes separate GLB importer with scene controls', () => {
  assert.match(ui,/id="pbObject"/);
  assert.match(ui,/id="pbObjectInput" type="file" accept="\.glb"/);
  assert.match(ui,/importFiles\(files, 'object'\)/);
  assert.match(ui,/\['object', \['Objek 3D \/ GLB'/);
  assert.match(ui,/assetKind === 'object' && !boothVertexCount\(a\)/);
});
test('scene presets persist independent GLB objects and reject invalid ownership', () => {
  assert.equal(validateBoothScene(scene()).assets[0].kind,'object');
  assert.throws(()=>validateBoothScene(scene(glb('bad.ydd'))),/GLB/);
  const owned=scene(); owned.assets[0].ownerIndex=0;
  assert.throws(()=>validateBoothScene(owned),/GLB/);
});
