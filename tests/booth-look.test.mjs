import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { applyBoothMatte } from '../src/booth-look.js';
import { createBoothStudio } from '../src/booth-studio.js';
import { actorForAsset } from '../src/booth-actors.js';
test('Matte removes Phong and physical highlights reversibly without changing alpha', () => {
  const root = new T.Group(),
    p = new T.MeshPhongMaterial({ specular: 0xaabbcc, transparent: true, opacity: 0.5 }),
    s = new T.MeshPhysicalMaterial({ roughness: 0.2, metalness: 0.3, clearcoat: 1 });
  root.add(new T.Mesh(new T.BoxGeometry(), p), new T.Mesh(new T.BoxGeometry(), s));
  applyBoothMatte(root, true);
  assert.equal(p.specular.getHex(), 0);
  assert.equal(s.roughness, 1);
  assert.equal(s.clearcoat, 0);
  assert.equal(p.opacity, 0.5);
  assert.equal(p.transparent, true);
  applyBoothMatte(root, false);
  assert.equal(p.specular.getHex(), 0xaabbcc);
  assert.equal(s.roughness, 0.2);
  assert.equal(s.metalness, 0.3);
  assert.equal(s.clearcoat, 1);
});
test('New studio location geometry remains finite and anchored; vehicles own their actor frame', () => {
  for (const id of ['hood', 'living', 'office', 'police', 'beach', 'bedroom', 'bathroom']) {
    const root = createBoothStudio(id);
    assert(root.children.length > 10);
    assert.deepEqual(root.position.toArray(), [0, 0, 0]);
    root.traverse((o) => {
      if (o.isMesh) assert(o.geometry.getAttribute('position').array.every(Number.isFinite));
    });
  }
  const ped = { id: 1, kind: 'ped' },
    vehicle = { id: 2, kind: 'vehicle', owner: 1 };
  assert.equal(actorForAsset([ped, vehicle], vehicle), vehicle);
});
