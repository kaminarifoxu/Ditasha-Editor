import * as THREE from 'three';

// Alpha-weighted bilinear filtering avoids dark/white fringes from hidden RGB
// in transparent PNG pixels. UV-edge padding is separate from artwork edges.
function sample(image, x, y, output, offset, opacity) {
  const ix = Math.floor(x),
    iy = Math.floor(y),
    fx = x - ix,
    fy = y - iy;
  let alpha = 0,
    red = 0,
    green = 0,
    blue = 0;
  for (let row = 0; row < 2; row++)
    for (let column = 0; column < 2; column++) {
      const sx = Math.max(0, Math.min(image.width - 1, ix + column));
      const sy = Math.max(0, Math.min(image.height - 1, iy + row));
      const at = (sy * image.width + sx) * 4;
      const weight = (column ? fx : 1 - fx) * (row ? fy : 1 - fy) * image.data[at + 3];
      alpha += weight;
      red += image.data[at] * weight;
      green += image.data[at + 1] * weight;
      blue += image.data[at + 2] * weight;
    }
  output[offset] = alpha ? Math.round(red / alpha) : 0;
  output[offset + 1] = alpha ? Math.round(green / alpha) : 0;
  output[offset + 2] = alpha ? Math.round(blue / alpha) : 0;
  output[offset + 3] = Math.round(alpha * opacity);
  return alpha > 0;
}
function edgeWeights(x, y, points) {
  let distance = Infinity,
    weights;
  for (let edge = 0; edge < 3; edge++) {
    const next = (edge + 1) % 3,
      a = points[edge],
      b = points[next];
    const dx = b[0] - a[0],
      dy = b[1] - a[1];
    const t = Math.max(
      0,
      Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy || 1)),
    );
    const d = (x - a[0] - t * dx) ** 2 + (y - a[1] - t * dy) ** 2;
    if (d < distance) {
      distance = d;
      weights = [0, 0, 0];
      weights[edge] = 1 - t;
      weights[next] = t;
    }
  }
  return distance <= 2.25 ? weights : null;
}

// Rasterize each source triangle in texture space, then sample the projector in
// world space. Separate UV islands therefore receive the same continuous image.
export function projectTexture(
  meshes,
  projector,
  size,
  image,
  width,
  height,
  opacity = 1,
  side = 1,
) {
  const output = new Uint8ClampedArray(width * height * 4);
  const coverage = new Uint8Array(width * height);
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
      if (normal.z * side <= 0) continue;
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
      const x0 = Math.max(0, Math.floor(Math.min(...t.map((t) => t[0]))) - 1),
        x1 = Math.min(width - 1, Math.ceil(Math.max(...t.map((t) => t[0]))) + 1);
      const y0 = Math.max(0, Math.floor(Math.min(...t.map((t) => t[1]))) - 1),
        y1 = Math.min(height - 1, Math.ceil(Math.max(...t.map((t) => t[1]))) + 1);
      if (x1 < x0 || y1 < y0) continue;
      visits += (x1 - x0 + 1) * (y1 - y0 + 1);
      if (visits > 64000000)
        throw Error('Proyeksi terlalu rumit. Kurangi ukuran PNG atau resolusi tekstur.');
      for (let y = y0; y <= y1; y++)
        for (let x = x0; x <= x1; x++) {
          let wa =
            ((v[1] - w[1]) * (x + 0.5 - w[0]) + (w[0] - v[0]) * (y + 0.5 - w[1])) / denominator;
          let wb =
              ((w[1] - u[1]) * (x + 0.5 - w[0]) + (u[0] - w[0]) * (y + 0.5 - w[1])) / denominator,
            wc = 1 - wa - wb;
          const interior = Math.min(wa, wb, wc) >= -1e-7;
          const pixel = y * width + x;
          if (!interior) {
            if (coverage[pixel] === 2) continue;
            const padded = edgeWeights(x + 0.5, y + 0.5, t);
            if (!padded) continue;
            [wa, wb, wc] = padded;
          }
          p.copy(a).multiplyScalar(wa).addScaledVector(b, wb).addScaledVector(c, wc);
          if (
            Math.abs(p.x) > size.x / 2 ||
            Math.abs(p.y) > size.y / 2 ||
            Math.abs(p.z) > size.z / 2
          )
            continue;
          coverage[pixel] = interior ? 2 : 1;
          const sx = (p.x / size.x + 0.5) * image.width - 0.5;
          const sy = (0.5 - p.y / size.y) * image.height - 0.5;
          if (sample(image, sx, sy, output, pixel * 4, opacity)) painted++;
        }
    }
  }
  if (!painted)
    throw Error('PNG tidak mengenai UV tekstur. Pilih permukaan dan tekstur yang sesuai.');
  return output;
}
