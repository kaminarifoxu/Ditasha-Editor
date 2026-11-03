import test from 'node:test';
import assert from 'node:assert/strict';
import { createSafeGeometry } from '../src/safe-model-geometry.js';

test('preview accepts a valid indexed triangle', () => {
  const geometry = createSafeGeometry({
    positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
    indices: new Uint16Array([0, 1, 2]),
    uvs: new Float32Array([0, 0, 1, 0, 0, 1]),
  });
  assert.equal(geometry.getIndex().count, 3);
  assert.equal(geometry.getAttribute('position').count, 3);
  assert.ok(Number.isFinite(geometry.boundingSphere.radius));
  geometry.dispose();
});

test('invalid vertices remove only affected triangles', () => {
  const geometry = createSafeGeometry({
    positions: new Float32Array([
      0, 0, 0, 1, 0, 0, 0, 1, 0,
      NaN, 0, 0,
    ]),
    indices: new Uint16Array([0, 1, 2, 0, 1, 3]),
  });
  assert.deepEqual([...geometry.getIndex().array], [0, 1, 2]);
  geometry.dispose();
});

test('all invalid triangles fail with actionable decoder error', () => {
  assert.throws(() => createSafeGeometry({
    positions: new Float32Array([NaN, 0, 0, 1, 0, 0, 0, 1, 0]),
    indices: new Uint16Array([0, 1, 2]),
  }), /no valid triangles|no usable/);
});

test('invalid UV values do not affect position bounds', () => {
  const geometry = createSafeGeometry({
    positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
    indices: [0, 1, 2],
    uvs: new Float32Array([NaN, Infinity, 1, 0, 0, 1]),
  });
  assert.equal(geometry.getAttribute('uv').getX(0), 0);
  assert.equal(geometry.getAttribute('uv').getY(0), 0);
  geometry.dispose();
});
