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
  assert.deepEqual(pixel(15, 20), [0, 0, 255, 255]);
  assert.deepEqual(pixel(85, 20), [255, 255, 0, 255]);
  assert.deepEqual(pixel(15, 80), [255, 0, 0, 255]);
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
