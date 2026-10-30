import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { repeatedUVTriangles } from '../src/uv-repeat.js';
import { drawUV } from '../src/editor.js';
import { projectTexture } from '../src/project-texture.js';

test('negative and positive atlas tiles translate whole triangles without altering seams', () => {
  const triangle = [
    [-0.8, 1.1],
    [-0.2, 1.1],
    [-0.8, 1.9],
  ];
  const original = structuredClone(triangle);
  const [tile] = repeatedUVTriangles(triangle);
  assert(tile.every(([u, v]) => u >= 0 && u <= 1 && v >= 0 && v <= 1));
  assert.deepEqual(triangle, original);
  const seam = repeatedUVTriangles([
    [0.9, 0.2],
    [1.1, 0.2],
    [0.9, 0.8],
  ]);
  assert.equal(seam.length, 2);
  assert(Math.abs(seam[0][1][0] - seam[0][0][0] - 0.2) < 1e-10);
  assert(Math.abs(seam[1][1][0] - seam[1][0][0] - 0.2) < 1e-10);
});

test('invalid or excessively repeated UVs stay bounded', () => {
  for (const points of [
    [
      [NaN, 0],
      [1, 0],
      [0, 1],
    ],
    [
      [0, 0],
      [1e30, 0],
      [0, 1],
    ],
    [
      [0, 0],
      [100, 0],
      [0, 100],
    ],
    [
      [1e30, 0],
      [1e30, 0],
      [1e30, 1],
    ],
  ])
    assert.deepEqual(repeatedUVTriangles(points), []);
});

test('UV guide skips UV-less meshes and brings negative islands onto the canvas', () => {
  const vertices = [];
  const ctx = {
    clearRect() {},
    beginPath() {},
    moveTo(...p) {
      vertices.push(p);
    },
    lineTo(...p) {
      vertices.push(p);
    },
    closePath() {},
    fill() {},
    stroke() {},
  };
  const uv = new Float32Array([-0.8, 0.1, -0.2, 0.1, -0.8, 0.9]);
  const saved = uv.slice();
  assert.equal(
    drawUV(
      ctx,
      [
        { indices: [0, 1, 2], uvs: null },
        { indices: [0, 1, 2], uvs: uv },
      ],
      100,
      100,
    ),
    1,
  );
  assert(vertices.every((p) => p.every((x) => x >= 0 && x <= 100)));
  assert.deepEqual(uv, saved);
});

function stamp(uv) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, -1, 1, 0], 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return projectTexture(
    [new THREE.Mesh(g)],
    new THREE.Matrix4(),
    new THREE.Vector3(2, 2, 1),
    { width: 1, height: 1, data: new Uint8ClampedArray([80, 120, 200, 255]) },
    32,
    32,
  );
}

test('3D stamp on a negative tile produces the same pixels as its base atlas tile', () => {
  assert.deepEqual(
    stamp([-0.75, 0.25, -0.25, 0.25, -0.75, 0.75]),
    stamp([0.25, 0.25, 0.75, 0.25, 0.25, 0.75]),
  );
});

test('3D stamp crossing a repeat boundary paints both atlas edges without filling its middle', () => {
  const pixels = stamp([0.875, 0.25, 1.125, 0.25, 0.875, 0.75]);
  const alpha = (x, y) => pixels[(y * 32 + x) * 4 + 3];
  assert(alpha(31, 9) > 0);
  assert(alpha(0, 9) > 0);
  assert.equal(alpha(16, 9), 0);
});
