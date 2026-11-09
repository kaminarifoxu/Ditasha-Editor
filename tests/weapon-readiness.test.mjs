import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { auditWeaponAssembly } from '../src/creators/weapon-readiness.js';
import { WEAPON_REFERENCES, createWeaponSketch } from '../src/weapon-studio.js';

const selected = WEAPON_REFERENCES[0];

test('M2a empty weapon assembly fails closed without native export promises', () => {
  const audit = auditWeaponAssembly(new THREE.Group(), { reference: selected });
  assert.equal(audit.readiness, 'invalid-model');
  assert.equal(audit.nativeExportVerified, false);
  assert.ok(audit.issues.some(item => item.code === 'no-model' && item.severity === 'error'));
});

test('M2a existing weapon sketch is audited without changing its objects or materials', () => {
  const sketch = createWeaponSketch('pistol');
  const oldNames = sketch.children.map(node => node.name);
  const oldColors = sketch.children.map(node => node.material.color.getHex());
  const audit = auditWeaponAssembly(sketch, { reference: selected });
  assert.equal(audit.readiness, 'design-preview-only');
  assert.equal(audit.stats.meshes, sketch.children.length);
  assert.ok(audit.stats.triangles > 0);
  assert.ok(audit.issues.some(item => item.code === 'skeleton-unverified'));
  assert.ok(audit.issues.some(item => item.code === 'metadata-unverified'));
  assert.deepEqual(sketch.children.map(node => node.name), oldNames);
  assert.deepEqual(sketch.children.map(node => node.material.color.getHex()), oldColors);
  sketch.traverse(obj => { obj.geometry?.dispose(); obj.material?.dispose(); });
});

test('M2a invalid vertices, missing materials and UV omissions are reported', () => {
  const group = new THREE.Group();
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([0,0,0, 1,0,0, Number.NaN,1,0], 3));
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());
  mesh.name = 'invalid';
  group.add(mesh);
  const audit = auditWeaponAssembly(group);
  assert.equal(audit.readiness, 'invalid-model');
  assert.ok(audit.issues.some(item => item.code === 'nonfinite-vertex'));
  assert.ok(audit.issues.some(item => item.code === 'missing-uv'));
  geometry.dispose(); mesh.material.dispose();
});

test('M2a existing GTA weapon references remain unchanged', () => {
  assert.ok(WEAPON_REFERENCES.length >= 5);
  const names = WEAPON_REFERENCES.map(row => row[1]);
  assert.equal(new Set(names).size, names.length);
  for (const reference of WEAPON_REFERENCES) {
    const audit = auditWeaponAssembly(new THREE.Group(), { reference });
    assert.equal(audit.reference.weaponName, reference[1]);
  }
});
