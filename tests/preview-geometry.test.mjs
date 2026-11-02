import test from 'node:test';
import assert from 'node:assert/strict';
import { safePreviewMesh } from '../src/preview-geometry.js';

test('valid mesh retains geometry', () => {
  const positions = Float32Array.from([0,0,0,1,0,0,0,1,0]);
  const mesh = safePreviewMesh({positions,indices:Uint16Array.from([0,1,2])});
  assert.deepEqual(Array.from(mesh.indices),[0,1,2]);
  assert.equal(mesh.positions,positions);
});
test('discard broken triangles but retain valid model parts', () => {
  const positions = Float32Array.from([0,0,0,1,0,0,0,1,0,NaN,2,0]);
  const mesh = safePreviewMesh({positions,indices:Uint16Array.from([0,1,2,0,2,3])});
  assert.deepEqual(Array.from(mesh.indices),[0,1,2]);
  assert.equal(mesh.droppedTriangles,1);
  assert.equal(mesh.positions[9],0);
  assert.ok(Number.isNaN(positions[9]),'decoded source must stay untouched');
});
test('reject out of range vertex index and fully invalid mesh', () => {
  const positions = Float32Array.from([0,0,0,1,0,0,0,1,0]);
  assert.equal(safePreviewMesh({positions,indices:[0,1,9]}),null);
  assert.equal(safePreviewMesh({positions:Float32Array.from([NaN,0,0,0,0,0,0,1,0])}),null);
});
test('sanitize nonfinite UV and normal values for WebGL', () => {
  const mesh = safePreviewMesh({
    positions: Float32Array.from([0,0,0,1,0,0,0,1,0]),
    uvs: Float32Array.from([0,0,NaN,0,1,1]),
    normals: Float32Array.from([0,0,1,0,0,Infinity,0,0,1]),
    indices: Uint16Array.from([0,1,2]),
  });
  assert.equal(mesh.uvs[2],0);
  assert.equal(mesh.normals[5],0);
});
