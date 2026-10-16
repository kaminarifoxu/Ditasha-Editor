import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { photoshootPoints, fitPhotoshoot } from '../src/photoshoot-framing.js';
import { modelAlphaMode } from '../src/model-material.js';
import { hashName } from '../src/asset-tools.js';
import { defaultPreviewSettings, previewAlpha } from '../src/material-preview.js';

test('Wide vehicle fills each angle independently and stays inside the export panel', () => {
  const root = new THREE.Mesh(new THREE.BoxGeometry(6, 2, 1));
  const points = photoshootPoints([root]);
  const aspect = 595 / 994;
  const camera = new THREE.PerspectiveCamera(35, aspect, 0.0001, 1000);
  const distances = [];
  for (const direction of [new THREE.Vector3(0, 0, 1), new THREE.Vector3(1, 0, 0)]) {
    const fit = fitPhotoshoot(points, direction, camera.up, aspect, 35);
    distances.push(fit.distance);
    camera.position.copy(fit.center).addScaledVector(direction, fit.distance);
    camera.lookAt(fit.center);
    camera.updateMatrixWorld();
    let extent = 0;
    for (let i = 0; i < points.length; i += 3) {
      const p = new THREE.Vector3().fromArray(points, i).project(camera);
      assert.ok(Math.abs(p.x) <= 0.941 && Math.abs(p.y) <= 0.941);
      extent = Math.max(extent, Math.abs(p.x), Math.abs(p.y));
    }
    assert.ok(extent > 0.93, 'Model still wastes panel space');
    assert.ok(fitPhotoshoot(points, direction, camera.up, aspect, 35, 3).distance < fit.distance);
  }
  assert.ok(distances[0] > distances[1] * 2, 'Both angles still use a shared sphere');
});

test('Hidden parts, unused vertices and collapsed debadge triangles do not shrink photoshoot', () => {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0, 999, 999, 999], 3),
  );
  geometry.setIndex([0, 1, 2, 3, 3, 3]);
  const group = new THREE.Group();
  const mesh = new THREE.Mesh(geometry);
  mesh.position.x = 5;
  group.add(mesh);
  const hidden = new THREE.Mesh(new THREE.BoxGeometry(100, 100, 100));
  hidden.visible = false;
  group.add(hidden);
  assert.deepEqual([...photoshootPoints([group])], [5, 0, 0, 6, 0, 0, 5, 1, 0]);
  geometry.setDrawRange(3, 3);
  assert.equal(photoshootPoints([group]).length, 0);
});

test('Opaque vehicle shader variants preserve solid surfaces while glass and decals keep alpha', () => {
  for (const name of [
    'vehicle_mesh2_enveff',
    'vehicle_paint6_enveff',
    'vehicle_tire_emissive',
    'vehicle_detail2',
    'vehicle_cloth2',
  ]) {
    assert.equal(modelAlphaMode({ shaderFileHash: hashName(name + '.sps') }), 'opaque');
    assert.equal(modelAlphaMode({ shaderHash: hashName(name) }), 'opaque');
  }
  for (const name of ['vehicle_vehglass', 'vehicle_badges', 'vehicle_decal', 'vehicle_cutout'])
    assert.equal(modelAlphaMode({ shaderFileHash: hashName(name + '.sps') }), 'blend');
});

test('Ped material defaults cannot overwrite the solid vehicle shader mode', () => {
  const material = new THREE.MeshStandardMaterial();
  assert.equal(defaultPreviewSettings(material).mode, 'cutout');
  material.userData.previewAlphaDefault = { mode: 'opaque', cutoff: 0 };
  assert.deepEqual(previewAlpha(defaultPreviewSettings(material), true), {
    transparent: false,
    alphaTest: 0,
    depthWrite: true,
  });
});
