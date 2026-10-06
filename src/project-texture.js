import * as THREE from 'three';

// Rasterize each source triangle in texture space, then sample the projector in
// world space. Separate UV islands therefore receive the same continuous image.
export function projectTexture(meshes, projector, size, image, width, height, opacity = 1) {
  const output = new Uint8ClampedArray(width * height * 4);
  const inverse = projector.clone().invert();
  const p = new THREE.Vector3(),
    a = new THREE.Vector3(),
    b = new THREE.Vector3(),
    c = new THREE.Vector3();
  let visits = 0,
    painted = 0;
  for (const mesh of meshes) {
    const position = mesh.geometry.getAttribute('position'),
      uv = mesh.geometry.getAttribute('uv');
    if (!position || !uv) continue;
    mesh.updateWorldMatrix(true, false);
    const transform = inverse.clone().multiply(mesh.matrixWorld);
    const index = mesh.geometry.index;
    for (let i = 0; i < (index?.count ?? position.count); i += 3) {
      const ids = [0, 1, 2].map((k) => (index ? index.getX(i + k) : i + k));
      const points = [a, b, c];
      points.forEach((v, k) => v.fromBufferAttribute(position, ids[k]).applyMatrix4(transform));
      const normal = new THREE.Vector3()
        .subVectors(b, a)
        .cross(new THREE.Vector3().subVectors(c, a));
      // Do not project through the model onto its back side.
      if (normal.z <= 0) continue;
      if (
        ['x', 'y', 'z'].some(
          (axis, k) =>
            points.every((v) => v[axis] < -size.getComponent(k) / 2) ||
            points.every((v) => v[axis] > size.getComponent(k) / 2),
        )
      )
        continue;
      const t = ids.map((id) => [uv.getX(id) * width, uv.getY(id) * height]);
      const [u, v, w] = t;
      const denominator = (v[1] - w[1]) * (u[0] - w[0]) + (w[0] - v[0]) * (u[1] - w[1]);
      if (Math.abs(denominator) < 1e-9) continue;
      const x0 = Math.max(0, Math.floor(Math.min(...t.map((t) => t[0])))),
        x1 = Math.min(width - 1, Math.ceil(Math.max(...t.map((t) => t[0]))));
      const y0 = Math.max(0, Math.floor(Math.min(...t.map((t) => t[1])))),
        y1 = Math.min(height - 1, Math.ceil(Math.max(...t.map((t) => t[1]))));
      visits += (x1 - x0 + 1) * (y1 - y0 + 1);
      if (visits > 64000000)
        throw Error('Proyeksi terlalu rumit. Kurangi ukuran PNG atau resolusi tekstur.');
      for (let y = y0; y <= y1; y++)
        for (let x = x0; x <= x1; x++) {
          const wa =
            ((v[1] - w[1]) * (x + 0.5 - w[0]) + (w[0] - v[0]) * (y + 0.5 - w[1])) / denominator;
          const wb =
              ((w[1] - u[1]) * (x + 0.5 - w[0]) + (u[0] - w[0]) * (y + 0.5 - w[1])) / denominator,
            wc = 1 - wa - wb;
          if (Math.min(wa, wb, wc) < -1e-7) continue;
          p.copy(a).multiplyScalar(wa).addScaledVector(b, wb).addScaledVector(c, wc);
          if (
            Math.abs(p.x) > size.x / 2 ||
            Math.abs(p.y) > size.y / 2 ||
            Math.abs(p.z) > size.z / 2
          )
            continue;
          const sx = Math.min(image.width - 1, Math.floor((p.x / size.x + 0.5) * image.width));
          const sy = Math.min(image.height - 1, Math.floor((0.5 - p.y / size.y) * image.height));
          const src = (sy * image.width + sx) * 4,
            dst = (y * width + x) * 4;
          if (!image.data[src + 3]) continue;
          output.set(image.data.subarray(src, src + 3), dst);
          output[dst + 3] = Math.round(image.data[src + 3] * opacity);
          painted++;
        }
    }
  }
  if (!painted)
    throw Error('PNG tidak mengenai UV tekstur. Pilih permukaan dan tekstur yang sesuai.');
  return output;
}
