import test from 'node:test';
import assert from 'node:assert/strict';
import { Group, Mesh, BoxGeometry, MeshBasicMaterial, PerspectiveCamera } from 'three';
import { createBoothViewCulling } from '../src/booth-view-culling.js';
test('Studio frustum omits rear/side meshes without hiding shadow casters and restores on camera turn', () => {
  const root = new Group(),
    camera = new PerspectiveCamera(60, 1, 0.1, 100);
  camera.position.set(0, 0, 5);
  camera.lookAt(0, 0, 0);
  const meshes = [0, 10, -10].map((z) => {
    const m = new Mesh(new BoxGeometry(), new MeshBasicMaterial());
    m.position.z = z;
    m.castShadow = true;
    root.add(m);
    return m;
  });
  const side = new Mesh(new BoxGeometry(), new MeshBasicMaterial());
  side.position.x = 100;
  root.add(side);
  const cull = createBoothViewCulling();
  assert.deepEqual(cull(root, camera), { visible: 2, total: 4 });
  assert(meshes.every((m) => m.visible && m.castShadow && m.frustumCulled));
  camera.lookAt(0, 0, 20);
  assert.equal(cull(root, camera).visible, 1);
  assert.deepEqual(cull(root, camera, false), { visible: 4, total: 4 });
  assert(meshes.every((m) => !m.frustumCulled));
});
