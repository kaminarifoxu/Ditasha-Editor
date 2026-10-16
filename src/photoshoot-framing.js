import { Vector3 } from 'three';

// Fit actual visible, indexed vertices in this camera basis. A sphere wastes most
// of a portrait panel around a long vehicle, and unused vertices can inflate it.
export function photoshootPoints(roots) {
  const points = [],
    point = new Vector3();
  for (const root of roots) {
    root.updateWorldMatrix(true, true);
    root.traverseVisible((mesh) => {
      if (!mesh.isMesh) return;
      const position = mesh.geometry.getAttribute('position');
      if (!position) return;
      const index = mesh.geometry.index;
      const count = index ? index.count : position.count;
      const start = Math.max(0, mesh.geometry.drawRange.start);
      const end = Math.min(count, start + mesh.geometry.drawRange.count);
      const used = new Set();
      for (let i = start; i + 2 < end; i += 3) {
        const ids = [0, 1, 2].map((n) => (index ? index.getX(i + n) : i + n));
        if (new Set(ids).size < 3) continue;
        ids.forEach((id) => used.add(id));
      }
      for (const id of used) {
        point.fromBufferAttribute(position, id).applyMatrix4(mesh.matrixWorld);
        if (Number.isFinite(point.x) && Number.isFinite(point.y) && Number.isFinite(point.z))
          points.push(point.x, point.y, point.z);
      }
    });
  }
  return new Float32Array(points);
}

export function fitPhotoshoot(points, direction, up, aspect, fov, zoom = 1) {
  if (!points.length) throw Error('Tidak ada mesh untuk difoto.');
  const forward = direction.clone().normalize();
  const right = new Vector3().crossVectors(up, forward).normalize();
  const vertical = new Vector3().crossVectors(forward, right).normalize();
  const min = new Vector3(Infinity, Infinity, Infinity);
  const max = new Vector3(-Infinity, -Infinity, -Infinity);
  const p = new Vector3();
  for (let i = 0; i < points.length; i += 3) {
    p.fromArray(points, i);
    const local = new Vector3(p.dot(right), p.dot(vertical), p.dot(forward));
    min.min(local);
    max.max(local);
  }
  const middle = min.clone().add(max).multiplyScalar(0.5);
  const center = right
    .clone()
    .multiplyScalar(middle.x)
    .addScaledVector(vertical, middle.y)
    .addScaledVector(forward, middle.z);
  const tangent = Math.tan((fov * Math.PI) / 360);
  let distance = 0;
  for (let i = 0; i < points.length; i += 3) {
    const delta = p.fromArray(points, i).sub(center);
    distance = Math.max(
      distance,
      delta.dot(forward) +
        Math.max(
          Math.abs(delta.dot(right)) / (tangent * aspect * 0.94),
          Math.abs(delta.dot(vertical)) / (tangent * 0.94),
        ),
    );
  }
  const depth = (max.z - min.z) / 2;
  // Zoom may crop intentionally, but never moves the camera through the model.
  return { center, distance: Math.max(distance / zoom, depth + 0.001), depth };
}
