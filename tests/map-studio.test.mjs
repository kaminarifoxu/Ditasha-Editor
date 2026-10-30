import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { readMapMeta } from '../src/map-meta.js';
import {
  prepareStudioPack,
  buildMapStudio,
  studioEntityMatrix,
  expandStudioFiles,
} from '../src/booth-map-studio.js';
import { studioMetaFixture } from './fixtures/studio-meta.mjs';
import { performResourceJob } from '../src/resource-jobs.js';
import { testYdr } from './format.test.mjs';
import { zipFiles } from '../src/asset-tools.js';
import { validateBoothScene } from '../src/booth-library.js';
import { createActorMotion } from '../src/booth-actors.js';
const decode = async (k, b, o) => performResourceJob(k, b, o);
const files = () => [
  new File([studioMetaFixture()], 'one.ymap'),
  new File([studioMetaFixture('ytyp')], 'types.ytyp'),
  new File([testYdr], 'qa-room.ydr'),
];
test('Native META pointers read entity/archetype transforms and reject invalid block references', () => {
  const m = readMapMeta(studioMetaFixture());
  assert.equal(m.entities.length, 1);
  assert.deepEqual(m.entities[0].position, [1200, 2500, 55]);
  assert.equal(readMapMeta(studioMetaFixture('ytyp')).archetypes[0].asset, m.entities[0].hash);
  assert.throws(() => readMapMeta(studioMetaFixture('ymap', { badPointer: true })), /pointer/);
  const matrix = studioEntityMatrix(m.entities[0]);
  assert.deepEqual(matrix.elements.slice(12, 15).map(Math.round), [1200, 55, -2500]);
});
test('Studio instances are rebased, grounded and independent of actor transforms', async () => {
  const pack = await prepareStudioPack({ id: 'test', label: 'Test', files: files() }, decode),
    root = await buildMapStudio(pack, 0, decode);
  const box = new T.Box3().setFromObject(root);
  assert(Math.abs(box.min.y) < 1e-8);
  assert(Math.abs(box.getCenter(new T.Vector3()).x) < 1e-8);
  assert.equal(root.userData.vertices, 3);
  assert.deepEqual(root.position.toArray(), [0, 0, 0]);
  const actor = new T.Group();
  actor.position.set(5, 2, 3);
  actor.rotation.y = 2;
  assert.deepEqual(root.position.toArray(), [0, 0, 0]);
  assert.equal(root.rotation.y, 0);
});
test('ZIP studio import extracts only native assets; scripts remain unused', async () => {
  const zip = zipFiles([
    { name: 'test/one.ymap', data: new Uint8Array(studioMetaFixture()) },
    { name: 'test/qa-room.ydr', data: new Uint8Array(testYdr) },
    { name: 'test/fxmanifest.lua', data: new TextEncoder().encode('not executed') },
  ]);
  const out = await expandStudioFiles([new File([zip], 'test.zip')]);
  assert.equal(out.length, 2);
  assert(out.every((f) => !f.name.endsWith('.lua')));
});
test('Presets include native studio sources and reject missing custom packs', () => {
  const studio = {
    id: 'custom:test:0',
    background: '#242938',
    light: 1,
    transparent: false,
    floor: true,
    size: '1920x1080',
    packs: [{ id: 'test', label: 'Test', files: files() }],
    studioY: 0,
    studioYaw: 30,
    cutaway: true,
  };
  const s = {
    version: 1,
    studio,
    textureFiles: [],
    clipFiles: [],
    assets: [
      {
        file: new File([testYdr], 'ped.ydr'),
        kind: 'ped',
        ownerIndex: null,
        oldId: 1,
        offset: [0, 0, 0],
        yaw: 0,
        scale: 1,
        motion: createActorMotion(),
        hiddenSlots: [],
      },
    ],
  };
  assert.equal(validateBoothScene(s), s);
  studio.packs = [];
  assert.throws(() => validateBoothScene(s), /Sumber studio/);
});
