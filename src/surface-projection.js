import * as THREE from 'three';
// A tangent-plane stamp cannot follow the sides of a neck. Cylindrical mapping
// uses arc length, including outward-facing side triangles past 90 degrees.
export function surfacePoint(point, size, wrap) {
  if (!wrap) return { x: point.x, y: point.y, depth: point.z };
  const r = wrap.radius,
    angle = Math.atan2(point.x, point.z + r);
  const x = angle * r,
    y = point.y;
  const a = wrap.rotation || 0,
    c = Math.cos(a),
    s = Math.sin(a);
  return { x: c * x + s * y, y: -s * x + c * y, depth: Math.hypot(point.x, point.z + r) - r };
}
export function surfaceFacing(normal, center, side, wrap) {
  return (wrap ? normal.x * center.x + normal.z * (center.z + wrap.radius) : normal.z) * side > 0;
}
export function fitSurfaceRadius(meshes, projector, size) {
  const inverse = projector.clone().invert(),
    p = new THREE.Vector3(),
    values = [];
  for (const mesh of meshes) {
    mesh.updateWorldMatrix(true, false);
    const transform = inverse.clone().multiply(mesh.matrixWorld),
      positions = mesh.geometry.getAttribute('position');
    const step = Math.max(1, Math.ceil(positions.count / 20000));
    for (let i = 0; i < positions.count; i += step) {
      p.fromBufferAttribute(positions, i).applyMatrix4(transform);
      if (
        Math.abs(p.y) > size.y * 0.25 ||
        p.z >= -size.x * 0.01 ||
        Math.abs(p.x) > size.x * 2 ||
        p.z < -size.x * 4
      )
        continue;
      const r = -(p.x * p.x + p.z * p.z) / (2 * p.z);
      if (r > size.x * 0.08 && r < size.x * 4) values.push(r);
    }
  }
  values.sort((a, b) => a - b);
  return values.length >= 4 ? values[Math.floor(values.length / 2)] : size.x / 2;
}
