import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  projectionResolution,
  projectionTargets,
  projectionGeometry,
} from '../src/sticker-projection.js';
import { projectTexture } from '../src/project-texture.js';

test('Tattoo baking upsizes low-resolution atlases without downsampling existing detail', () => {
  assert.deepEqual(projectionResolution(512, 256), { w: 2048, h: 1024 });
  assert.deepEqual(projectionResolution(4096, 2048, 2048), { w: 4096, h: 2048 });
  assert.deepEqual(projectionResolution(128, 128, 0), { w: 128, h: 128 });
  assert.throws(() => projectionResolution(8192, 8192), /16 megapiksel/);
});
test('Tattoo crosses separate meshes on the same atlas and avoids unrelated or hidden materials', () => {
  const mesh = (texture, x) => {
    const geometry = new THREE.PlaneGeometry(1, 2);
    const uv = geometry.getAttribute('uv');
    for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * 0.4 + (x < 0 ? 0 : 0.6));
    const m = new THREE.Mesh(geometry);
    m.position.x = x;
    m.userData.diffuseTexture = texture;
    return m;
  };
  const left = mesh('neck_diff', -0.5),
    right = mesh('NECK_DIFF', 0.5),
    eyes = mesh('eyes_diff', 0),
    hidden = mesh('neck_diff', 0);
  hidden.visible = false;
  const targets = projectionTargets([left, right, eyes, hidden], left);
  assert.deepEqual(targets, [left, right]);
  assert.deepEqual(projectionTargets([left, right], left, 'mesh'), [left]);
  const pixels = projectTexture(
    targets,
    new THREE.Matrix4(),
    new THREE.Vector3(2, 2, 3),
    { width: 1, height: 1, data: new Uint8ClampedArray([12, 34, 56, 255]) },
    64,
    64,
  );
  assert.equal(pixels[(32 * 64 + 12) * 4 + 3], 255);
  assert.equal(pixels[(32 * 64 + 52) * 4 + 3], 255, 'Neighbour mesh lost the tattoo');
  assert.equal(pixels[(32 * 64 + 32) * 4 + 3], 0, 'Unrelated UV area was painted');
});
test('Deep curved neck projection covers the edge and live geometry rejects the far side', () => {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 2, 64, 4, true));
  const point = new THREE.Vector3(0, 0, 1),
    rotation = new THREE.Euler();
  const size = new THREE.Vector3(1.9, 1, 2.85);
  const preview = projectionGeometry(mesh, point, rotation, size);
  const position = preview.getAttribute('position');
  for (let i = 0; i < preview.index.count; i++)
    assert(position.getZ(preview.index.getX(i)) >= -1e-6, 'Preview projects onto the back');
  const image = { width: 1, height: 1, data: new Uint8ClampedArray([0, 0, 0, 255]) };
  const pixels = projectTexture(
    [mesh],
    new THREE.Matrix4().makeTranslation(0, 0, 1),
    size,
    image,
    256,
    256,
  );
  // This front-facing surface is 0.56 units behind the tangent plane. The old
  // width*0.4 depth clips it at 0.38 units, cutting a wide tattoo off vertically.
  assert.equal(
    pixels[(128 * 256 + 44) * 4 + 3],
    255,
    'Curved neck edge was cut by the projector depth',
  );
  assert.equal(pixels[(128 * 256 + 128) * 4 + 3], 0, 'Tattoo leaked through the rear surface');
});
