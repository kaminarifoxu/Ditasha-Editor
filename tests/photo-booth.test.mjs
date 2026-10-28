import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { readYdd, Resource } from '../src/resource.js';
import { readPedRig, readPedWeights } from '../src/ped-skin.js';
import { boothPedFixture } from './fixtures/booth-ped.mjs';
import {
  BOOTH_POSES,
  boothBoneRole,
  captureBoothRest,
  applyBoothPose,
} from '../src/photo-booth-pose.js';

test('Native booth reader preserves source, converts bind matrices and maps palette weights', () => {
  const buffer = boothPedFixture(),
    before = new Uint8Array(buffer).slice(),
    [d] = readYdd(buffer);
  assert.equal(d.rig.length, 2);
  assert.equal(d.rig[1].name, 'SKEL_L_UpperArm');
  assert.equal(d.rig[1].parent, 0);
  const p = new THREE.Vector3().setFromMatrixPosition(
    new THREE.Matrix4().fromArray(d.rig[1].matrix),
  );
  assert.ok(p.distanceTo(new THREE.Vector3(0.5, 1, 0)) < 1e-6);
  assert.deepEqual([...d.geometries[0].skin.indices], [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]);
  assert.deepEqual([...d.geometries[0].skin.weights], [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0]);
  assert.deepEqual(new Uint8Array(buffer), before);
  const r = new Resource(buffer, 165);
  r.v.setInt16(2800 + 50, 1, true);
  assert.throws(() => readPedRig(r, 80), /Cyclic/);
  r.v.setUint16(1114, 2000, true);
  assert.throws(
    () =>
      readPedWeights(r, 1000, 4096, 3, 28, {
        1: { offset: 12, type: 9 },
        2: { offset: 16, type: 8 },
      }),
    /palette/,
  );
});
test('Relaxed and animated poses deform native skinned vertices, return to bind pose without altering bind pose', () => {
  const [d] = readYdd(boothPedFixture()),
    g = d.geometries[0],
    root = new THREE.Group(),
    bones = d.rig.map((b) => {
      const bone = new THREE.Bone();
      bone.name = b.name;
      new THREE.Matrix4().fromArray(b.matrix).decompose(bone.position, bone.quaternion, bone.scale);
      return bone;
    });
  bones.forEach((b, i) => (d.rig[i].parent < 0 ? root : bones[d.rig[i].parent]).add(b));
  root.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(bones),
    geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(g.positions, 3));
  geometry.setAttribute('skinIndex', new THREE.BufferAttribute(g.skin.indices, 4));
  geometry.setAttribute('skinWeight', new THREE.BufferAttribute(g.skin.weights, 4));
  const mesh = new THREE.SkinnedMesh(geometry, new THREE.MeshBasicMaterial());
  root.add(mesh);
  mesh.bind(skeleton);
  const rest = captureBoothRest(root),
    point = () => {
      root.updateMatrixWorld(true);
      skeleton.update();
      return mesh.getVertexPosition(1, new THREE.Vector3());
    };
  const before = point();
  applyBoothPose(rest, 'relaxed', 0);
  assert.ok(point().y < before.y - 0.3, 'Arm did not lower');
  for (const [pose] of BOOTH_POSES) {
    applyBoothPose(rest, pose, 0.25);
    assert.ok(point().toArray().every(Number.isFinite));
  }
  applyBoothPose(rest, 'rest', 0);
  assert.ok(point().distanceTo(before) < 1e-6);
  applyBoothPose(rest, 'walk', 0.25);
  const a = point();
  applyBoothPose(rest, 'walk', 0.75);
  assert.ok(point().distanceTo(a) > 0.1);
  applyBoothPose(rest, 'rest', 0);
  assert.ok(point().distanceTo(before) < 1e-6);
  assert.equal(boothBoneRole('SKEL_L_UpperArm'), 'leftArm');
  assert.equal(boothBoneRole('mixamorigRightForeArm'), 'rightForearm');
  assert.throws(() => applyBoothPose(rest, 'invalid', 0), /tidak dikenal/);
  assert.throws(() => applyBoothPose(rest, 'wave', NaN), /tidak valid/);
});
