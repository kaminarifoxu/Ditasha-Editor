import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { makePropPreviewOverlay, validatePreviewSettings } from '../src/creators/prop-preview.js';

test('M1b validates bounded pivot, collision mode and ordered LOD ranges', () => {
  assert.deepEqual(validatePreviewSettings({ collision: 'none', lodDistances: [] }).lodDistances, []);
  for (const value of [
    { collision: 'unknown' }, { pivot: [0, NaN, 0] }, { pivot: [0, 0] },
    { drawDistance: Infinity }, { lodDistances: [70, 30] }, { lodDistances: [30,30] },
    { lodDistances: [5000] },
  ]) assert.throws(() => validatePreviewSettings(value));
});
test('M1b reuses existing Three scene model and disposes overlay without modifying model geometry', () => {
  const scene = new THREE.Scene();
  const model = new THREE.Group();
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 3, 4), new THREE.MeshBasicMaterial());
  model.add(mesh);
  model.position.set(5, 0, -1);
  scene.add(model);
  const before = mesh.geometry.attributes.position.array.slice();
  const overlay = makePropPreviewOverlay(model, { collision: 'box', pivot: [5,0,-1], lodDistances: [12, 40] });
  assert.equal(overlay.bounds.getSize(new THREE.Vector3()).x, 2);
  assert.equal(overlay.settings.collision, 'box');
  assert.ok(overlay.group.children.some(o => o.name.includes('Collision preview')));
  assert.equal(overlay.group.children.filter(o => o.name.startsWith('LOD threshold')).length, 2);
  assert.equal(overlay.group.userData.ditashaPreviewOnly, true);
  scene.add(overlay.group);
  overlay.dispose();
  assert.equal(overlay.group.parent, null);
  assert.deepEqual(mesh.geometry.attributes.position.array, before);
  mesh.geometry.dispose(); mesh.material.dispose();
});
test('M1b convex shape is explicitly visual-only and invalid/empty models fail closed', () => {
  const model = new THREE.Group();
  assert.throws(() => makePropPreviewOverlay(model), /bounds/);
  const obj = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
  model.add(obj);
  const preview = makePropPreviewOverlay(model, { collision: 'convex', lodDistances: [] });
  assert.ok(preview.group.children.some(o => o.name.includes('not native YBN')));
  preview.dispose();
  obj.geometry.dispose(); obj.material.dispose();
});
