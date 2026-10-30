import * as THREE from 'three';
import { DecalGeometry } from 'three/addons/geometries/DecalGeometry.js';

export function projectionResolution(width, height, minimum = 2048) {
  const scale = Math.max(1, minimum / Math.max(width, height));
  const w = Math.round(width * scale),
    h = Math.round(height * scale);
  if (w > 8192 || h > 8192 || w * h > 16777216)
    throw Error('Resolusi tattoo maksimal 16 megapiksel. Pilih 2K atau resolusi asli.');
  return { w, h };
}

export function projectionTargets(meshes, target, scope = 'texture') {
  if (!target) return [];
  if (scope === 'mesh') return [target];
  const texture = target.userData.diffuseTexture?.toLowerCase();
  return meshes.filter(
    (mesh) =>
      mesh.visible &&
      (scope === 'all' ||
        (mesh.userData.diffuseTexture?.toLowerCase() || null) === (texture || null)),
  );
}

// Match the baker's projector-facing test. DecalGeometry alone also includes
// back-facing triangles inside the box, producing a misleading live preview.
export function projectionGeometry(mesh, point, rotation, size, side = 1) {
  const geometry = new DecalGeometry(mesh, point, rotation, size);
  const position = geometry.getAttribute('position');
  const inverse = new THREE.Matrix4()
    .compose(point, new THREE.Quaternion().setFromEuler(rotation), new THREE.Vector3(1, 1, 1))
    .invert();
  const a = new THREE.Vector3(),
    b = new THREE.Vector3(),
    c = new THREE.Vector3();
  const kept = [];
  for (let i = 0; i < position.count; i += 3) {
    a.fromBufferAttribute(position, i).applyMatrix4(inverse);
    b.fromBufferAttribute(position, i + 1)
      .applyMatrix4(inverse)
      .sub(a);
    c.fromBufferAttribute(position, i + 2)
      .applyMatrix4(inverse)
      .sub(a);
    if (b.cross(c).z * side > 0) kept.push(i, i + 1, i + 2);
  }
  geometry.setIndex(kept);
  return geometry;
}
