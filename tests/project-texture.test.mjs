import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createYtd } from '../src/asset-tools.js';
import { readYtd } from '../src/resource.js';
import { projectTexture } from '../src/project-texture.js';
test('Projection crosses separated UV islands and avoids the back face', () => {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(
      [
        -1, -1, 0, 0, -1, 0, 0, 1, 0, -1, -1, 0, 0, 1, 0, -1, 1, 0, 0, -1, 0, 1, -1, 0, 1, 1, 0, 0,
        -1, 0, 1, 1, 0, 0, 1, 0, -1, -1, -0.1, -1, 1, -0.1, 1, 1, -0.1,
      ],
      3,
    ),
  );
  geometry.setAttribute(
    'uv',
    new THREE.Float32BufferAttribute(
      [
        0, 0, 0.3, 0, 0.3, 1, 0, 0, 0.3, 1, 0, 1, 0.7, 0, 1, 0, 1, 1, 0.7, 0, 1, 1, 0.7, 1, 0.4, 0,
        0.4, 1, 0.6, 1,
      ],
      2,
    ),
  );
  const mesh = new THREE.Mesh(geometry);
  const image = {
    width: 2,
    height: 2,
    data: new Uint8ClampedArray([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 0, 255]),
  };
  const pixels = projectTexture(
    [mesh],
    new THREE.Matrix4(),
    new THREE.Vector3(2, 2, 1),
    image,
    100,
    100,
  );
  const pixel = (x, y) => [...pixels.slice((y * 100 + x) * 4, (y * 100 + x) * 4 + 4)];
  for (const [x, y, expected] of [
    [15, 20, [0, 0, 255, 255]],
    [85, 20, [255, 255, 0, 255]],
    [15, 80, [255, 0, 0, 255]],
  ]) {
    const actual = pixel(x, y);
    assert(
      actual.every((value, i) => Math.abs(value - expected[i]) < 16),
      'Bilinear colour/orientation mismatch: ' + actual,
    );
  }
  assert.deepEqual(pixel(50, 50), [0, 0, 0, 0]);
  const exported = readYtd(createYtd([{ name: 'tattoo', w: 100, h: 100, out: pixels }]).buffer)
    .textures[0];
  assert.deepEqual(
    [...exported.out.slice((20 * 100 + 15) * 4, (20 * 100 + 15) * 4 + 4)],
    pixel(15, 20),
  );
  assert.throws(
    () => projectTexture([], new THREE.Matrix4(), new THREE.Vector3(2, 2, 1), image, 100, 100),
    /UV/,
  );
});

test('Double-sided visible back faces can receive a tattoo without projecting onto the front', () => {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute([0, 0, 0, 0, 1, 0, 1, 0, 0], 3),
  );
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 0, 1, 1, 0], 2));
  const pixels = projectTexture(
    [new THREE.Mesh(geometry)],
    new THREE.Matrix4(),
    new THREE.Vector3(2, 2, 1),
    { width: 1, height: 1, data: new Uint8ClampedArray([4, 5, 6, 255]) },
    10,
    10,
    1,
    -1,
  );
  assert.deepEqual([...pixels.slice(0, 4)], [4, 5, 6, 255]);
});

test('Bilinear PNG sampling preserves transparent edges without hidden RGB halos', () => {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
  const pixels = projectTexture(
    [mesh],
    new THREE.Matrix4(),
    new THREE.Vector3(2, 2, 1),
    { width: 2, height: 1, data: new Uint8ClampedArray([255, 255, 255, 0, 0, 0, 0, 255]) },
    10,
    10,
  );
  const centre = [...pixels.slice((5 * 10 + 5) * 4, (5 * 10 + 5) * 4 + 4)];
  assert.deepEqual(centre.slice(0, 3), [0, 0, 0]);
  assert(
    centre[3] > 120 && centre[3] < 200,
    'PNG sampling still uses hard nearest-neighbour steps',
  );
});
test('UV island edges receive a texel gutter without flooding the atlas', () => {
  const geometry = new THREE.PlaneGeometry(2, 2),
    uv = geometry.getAttribute('uv');
  for (let i = 0; i < uv.count; i++) uv.setXY(i, 0.25 + uv.getX(i) * 0.5, 0.25 + uv.getY(i) * 0.5);
  const pixels = projectTexture(
    [new THREE.Mesh(geometry)],
    new THREE.Matrix4(),
    new THREE.Vector3(2, 2, 1),
    { width: 1, height: 1, data: new Uint8ClampedArray([10, 20, 30, 255]) },
    32,
    32,
  );
  assert.equal(pixels[(16 * 32 + 7) * 4 + 3], 255, 'UV edge gutter missing');
  assert.equal(pixels[(16 * 32 + 5) * 4 + 3], 0, 'UV gutter escaped its island');
});

test('A curved neck spanning the UV wrap seam keeps continuous projected colours', () => {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 2, 48, 4, true));
  const image = { width: 8, height: 8, data: new Uint8ClampedArray(8 * 8 * 4) };
  for (let y = 0; y < 8; y++)
    for (let x = 0; x < 8; x++) image.data.set([x * 32, y * 32, 0, 255], (y * 8 + x) * 4);
  const projector = new THREE.Matrix4().makeTranslation(0, 0, 1);
  const pixels = projectTexture([mesh], projector, new THREE.Vector3(1.4, 1, 0.7), image, 256, 256);
  const left = [...pixels.slice(128 * 256 * 4, 128 * 256 * 4 + 4)];
  const right = [...pixels.slice((128 * 256 + 255) * 4, (128 * 256 + 255) * 4 + 4)];
  assert(left[3] === 255 && right[3] === 255, 'Curved UV seam has a transparent hole');
  assert(
    left.every((value, i) => Math.abs(value - right[i]) < 20),
    'UV wrap seam tears the projected image',
  );
  assert.equal(
    pixels[(128 * 256 + 128) * 4 + 3],
    0,
    'Tattoo projected through the back of the neck',
  );
});
