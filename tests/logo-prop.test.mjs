import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { Mesh, MeshBasicMaterial, DoubleSide, Raycaster, Vector3 } from 'three';
import { logoContours, buildLogoGeometry, removeLogoBackground } from '../src/logo-prop.js';
import { logoPropFixture } from './fixtures/logo-prop.mjs';
const require = createRequire(import.meta.url),
  { validateJob } = require('../electron/native-build.cjs');
test('edge background removal preserves enclosed artwork and original pixels', () => {
  const pixels = new Uint8ClampedArray(7 * 7 * 4).fill(255);
  for (let y = 1; y < 6; y++)
    for (let x = 1; x < 6; x++)
      if (x === 1 || x === 5 || y === 1 || y === 5) pixels.set([0, 0, 0, 255], (y * 7 + x) * 4);
  const saved = pixels.slice(),
    edge = removeLogoBackground(pixels, 7, 7, { mode: 'edge' }),
    all = removeLogoBackground(pixels, 7, 7, { mode: 'color' });
  assert.equal(edge[3], 0);
  assert.equal(edge[(3 * 7 + 3) * 4 + 3], 255);
  assert.equal(all[(3 * 7 + 3) * 4 + 3], 0);
  assert.deepEqual(pixels, saved);
});
test('extrusion has real depth, correct front UV orientation and an open letter hole', () => {
  const f = logoPropFixture(),
    result = buildLogoGeometry(f.alpha, 32, 32, { tolerance: 0 });
  assert.equal(result.holes, 1);
  assert.equal(result.width, 2);
  assert.equal(result.depth, 0.08);
  const mesh = new Mesh(result.geometry, new MeshBasicMaterial({ side: DoubleSide }));
  mesh.updateMatrixWorld(true);
  const ray = new Raycaster(new Vector3(0, 0, 2), new Vector3(0, 0, -1));
  assert.equal(ray.intersectObject(mesh).length, 0);
  ray.set(new Vector3(0.8, 0.8, 2), new Vector3(0, 0, -1));
  const hit = ray.intersectObject(mesh)[0];
  assert(hit);
  assert(hit.uv.y > 0.5);
  assert(hit.uv.x > 0.5);
  assert(result.geometry.boundingBox.max.z - result.geometry.boundingBox.min.z > 0.079);
  mesh.material.dispose();
  result.geometry.dispose();
});
test('separate letter islands and opaque boards use different geometry', () => {
  const mask = new Uint8Array(12 * 5);
  for (let y = 1; y < 4; y++) for (const x of [1, 2, 8, 9]) mask[y * 12 + x] = 255;
  assert.equal(logoContours(mask, 12, 5).length, 2);
  const board = buildLogoGeometry(mask, 12, 5, { mode: 'board' });
  assert.equal(board.holes, 0);
  assert.equal(board.islands, 1);
  assert.equal(board.geometry.attributes.position.count, 36);
  board.geometry.dispose();
  assert.throws(() => buildLogoGeometry(new Uint8Array(16), 4, 4), /Tidak ada/);
});
test('native logo jobs validate bounded mesh, PNG and model names before running Blender', () => {
  const { logo } = logoPropFixture();
  assert.equal(validateJob({ mode: 'logo', name: 'ditasha_logo', logo }).mode, 'logo');
  for (const change of [
    { positions: [NaN, 0, 0] },
    { texture: 'not a png' },
    { materials: [5] },
    { uvs: [] },
    { sideColor: [2, 0, 0] },
  ])
    assert.throws(() =>
      validateJob({ mode: 'logo', name: 'valid_logo', logo: { ...logo, ...change } }),
    );
  assert.throws(() => validateJob({ mode: 'logo', name: '../escape', logo }));
});

test('reserved Windows prop filenames are rejected', () => {
  const { logo } = logoPropFixture();
  for (const name of ['con', 'nul', 'com1', 'lpt1'])
    assert.throws(() => validateJob({ mode: 'logo', name, logo }));
});
