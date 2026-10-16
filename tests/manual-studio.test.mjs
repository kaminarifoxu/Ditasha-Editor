import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { alignLayer } from '../src/editor.js';
import { snapshotObject, writeObject, validateSceneProject } from '../src/scene-state.js';
import { validateCanvasProject, pngDimensions } from '../src/canvas-project.js';
test('Alignment uses rotated bounds and scene transforms preserve independent scale axes', () => {
  const layer = { x: 12, y: 18, w: 20, h: 10, angle: 90 };
  const aligned = alignLayer(layer, 100, 100, 'right');
  assert.equal(aligned.x, 85);
  const object = new THREE.Object3D();
  object.position.set(1, 2, 3);
  object.scale.set(1, 2, 3);
  object.rotation.z = Math.PI / 2;
  const saved = snapshotObject(object);
  object.scale.setScalar(1);
  writeObject(object, saved);
  assert.deepEqual(object.scale.toArray(), [1, 2, 3]);
  assert.equal(object.rotation.z, Math.PI / 2);
  assert.throws(() => writeObject(object, { ...saved, sx: 0 }), /Transform/);
  assert.throws(() => writeObject(object, { ...saved, x: Infinity }), /Transform/);
});
test('Scene projects reject different assets, duplicate objects, external backdrop URLs, and invalid cameras', () => {
  const object = new THREE.Object3D();
  const p = {
    format: 'ditasha-scene',
    version: 1,
    source: 'ped.ydd|123',
    objects: [{ key: 'mesh:0', transform: snapshotObject(object) }],
    props: [],
    camera: { position: [1, 2, 3], target: [0, 0, 0], fov: 40 },
    lighting: { preset: 'neutral', intensity: 1 },
    background: '#171a21',
  };
  assert.equal(validateSceneProject(p, p.source, new Set(['mesh:0'])), p);
  for (const bad of [
    { ...p, source: 'other' },
    { ...p, objects: [...p.objects, ...p.objects] },
    { ...p, camera: { ...p.camera, fov: 180 } },
    {
      ...p,
      props: [
        {
          name: 'remote',
          image: 'https://example.com/image.png',
          transform: snapshotObject(object),
        },
      ],
    },
  ])
    assert.throws(() => validateSceneProject(bad, p.source, new Set(['mesh:0'])), /tidak/);
});
test('Canvas projects restrict blend modes and embedded PNG dimensions before pixel decoding', () => {
  const l = {
    name: 'art',
    x: 0,
    y: 0,
    w: 8,
    h: 8,
    sx: 0,
    sy: 0,
    sw: 8,
    sh: 8,
    angle: 0,
    opacity: 1,
    visible: true,
    locked: false,
    flipX: false,
    flipY: false,
    blend: 'multiply',
    image: 'data:image/png;base64,AA==',
    mask: null,
  };
  const p = { format: 'ditasha-canvas', version: 1, name: 'design', w: 8, h: 8, layers: [l] };
  assert.equal(validateCanvasProject(p), p);
  assert.throws(
    () => validateCanvasProject({ ...p, layers: [{ ...l, image: 'https://example.com/art.png' }] }),
    /layer/,
  );
  assert.throws(
    () => validateCanvasProject({ ...p, layers: [{ ...l, blend: 'unsupported' }] }),
    /layer/,
  );
  const header = new Uint8Array(24);
  header.set([137, 80, 78, 71, 13, 10, 26, 10]);
  const view = new DataView(header.buffer);
  view.setUint32(16, 8);
  view.setUint32(20, 8);
  assert.deepEqual(pngDimensions(header), { w: 8, h: 8 });
  view.setUint32(16, 65535);
  assert.throws(() => pngDimensions(header), /Dimensi/);
});
