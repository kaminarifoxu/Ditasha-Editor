import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { projectTexture } from '../src/project-texture.js';
import { fitSurfaceRadius, surfacePoint } from '../src/surface-projection.js';

test('Cylindrical tattoo follows a neck past 90 degrees without the planar side cut', () => {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 2, 96, 4, true));
  const projector = new THREE.Matrix4().makeTranslation(0, 0, 1),
    size = new THREE.Vector3(5.5, 1, 0.5);
  const radius = fitSurfaceRadius([mesh], projector, size);
  assert(Math.abs(radius - 1) < 0.01);
  const pixels = projectTexture(
    [mesh],
    projector,
    size,
    { width: 1, height: 1, data: new Uint8ClampedArray([20, 30, 40, 255]) },
    256,
    256,
    1,
    1,
    { radius },
  );
  assert.equal(
    pixels[(128 * 256 + 85) * 4 + 3],
    255,
    'Tattoo still cuts at the tangent side of the neck',
  );
  assert.equal(pixels[(128 * 256 + 171) * 4 + 3], 255, 'Opposite side of the neck is missing');
  assert.equal(pixels[(128 * 256 + 128) * 4 + 3], 0, 'Rear image boundary leaked');
  const mapped = surfacePoint(new THREE.Vector3(1, 0, -1), size, { radius: 1 });
  assert(Math.abs(mapped.x - Math.PI / 2) < 1e-9);
});
