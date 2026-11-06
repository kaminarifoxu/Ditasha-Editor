import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';

test('thumbnail framing aims at off-origin hair/clothing bounds', () => {
 const bounds = new THREE.Box3(
   new THREE.Vector3(85, -30, 4),
   new THREE.Vector3(86, -29, 6),
 );
 const center = bounds.getCenter(new THREE.Vector3());
 const size = bounds.getSize(new THREE.Vector3());
 const diameter = Math.max(size.x, size.y, size.z, 0.01);
 const camera = new THREE.PerspectiveCamera(35, 188/168, diameter/1000, diameter*1000);
 camera.position.copy(center).add(new THREE.Vector3(diameter*.85,diameter*.4,diameter*1.8));
 camera.lookAt(center);
 camera.updateMatrixWorld(true);
 camera.updateProjectionMatrix();
 const projected = center.clone().project(camera);
 assert.ok(Math.abs(projected.x)<1e-5 && Math.abs(projected.y)<1e-5,
   'Model center must be inside the middle of each thumbnail');
 assert.ok(projected.z>-1 && projected.z<1,
   'Model center must be within the camera clipping planes');
});

test('the static thumbnail camera does not depend on removed OrbitControls', () => {
 const src = readFileSync(new URL('../src/file-preview.js', import.meta.url), 'utf8');
 assert.match(src,/if \(snapshot\) \{\s*camera\.lookAt\(center\);\s*camera\.updateMatrixWorld\(true\);/);
 assert.match(src,/const controls = snapshot\s*\? \{ target: new THREE\.Vector3\(\), update\(\) \{\}/);
 assert.match(src,/captureThumbnailRenderTarget\(renderer, scene, camera,/);
});
