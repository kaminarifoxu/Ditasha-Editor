export function validSize(w, h) {
  return (
    Number.isInteger(w) &&
    Number.isInteger(h) &&
    w > 0 &&
    h > 0 &&
    w <= 8192 &&
    h <= 8192 &&
    w * h <= 16777216
  );
}
export function makeLayer(source, name, w = source.width, h = source.height) {
  return {
    source,
    name,
    x: 0,
    y: 0,
    w,
    h,
    sx: 0,
    sy: 0,
    sw: source.width,
    sh: source.height,
    angle: 0,
    flipX: false,
    flipY: false,
    opacity: 1,
    visible: true,
  };
}
export function cropLayer(layer, rect) {
  const x = Math.max(layer.x, rect.x),
    y = Math.max(layer.y, rect.y),
    right = Math.min(layer.x + layer.w, rect.x + rect.w),
    bottom = Math.min(layer.y + layer.h, rect.y + rect.h);
  if (right - x < 1 || bottom - y < 1) throw Error('Area crop harus mengenai gambar yang dipilih.');
  return {
    ...layer,
    sx: layer.sx + ((x - layer.x) / layer.w) * layer.sw,
    sy: layer.sy + ((y - layer.y) / layer.h) * layer.sh,
    sw: ((right - x) / layer.w) * layer.sw,
    sh: ((bottom - y) / layer.h) * layer.sh,
    x,
    y,
    w: right - x,
    h: bottom - y,
  };
}
export function drawLayers(ctx, layers, w, h) {
  ctx.clearRect(0, 0, w, h);
  for (const l of layers) {
    if (l.visible) {
      ctx.save();
      ctx.translate(l.x + l.w / 2, l.y + l.h / 2);
      ctx.rotate(((l.angle || 0) * Math.PI) / 180);
      ctx.scale(l.flipX ? -1 : 1, l.flipY ? -1 : 1);
      ctx.globalAlpha = l.opacity ?? 1;
      ctx.drawImage(l.source, l.sx, l.sy, l.sw, l.sh, -l.w / 2, -l.h / 2, l.w, l.h);
      ctx.restore();
    }
  }
}
export function drawUV(ctx, geometries, w, h) {
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#3948f0';
  ctx.strokeStyle = '#151d83';
  ctx.lineWidth = Math.max(0.35, w / 2048);
  let triangles = 0;
  for (const g of geometries) {
    for (let i = 0; i < g.indices.length; i += 3) {
      const ids = [g.indices[i], g.indices[i + 1], g.indices[i + 2]],
        points = ids.map((id) => [g.uvs[id * 2] * w, g.uvs[id * 2 + 1] * h]);
      if (points.some((p) => !Number.isFinite(p[0]) || !Number.isFinite(p[1]))) continue;
      const a = points[0],
        b = points[1],
        c = points[2];
      if (Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) < 0.001) continue;
      ctx.beginPath();
      ctx.moveTo(...a);
      ctx.lineTo(...b);
      ctx.lineTo(...c);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      triangles++;
    }
  }
  return triangles;
}
export function normalizeRect(a, b) {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    w: Math.abs(a.x - b.x),
    h: Math.abs(a.y - b.y),
  };
}

export const normalizedAngle = (a) => ((a % 360) + 360) % 360;
export function layerPoint(layer, x, y) {
  const a = ((layer.angle || 0) * Math.PI) / 180,
    c = Math.cos(a),
    s = Math.sin(a),
    dx = x - layer.w / 2,
    dy = y - layer.h / 2;
  return { x: layer.x + layer.w / 2 + c * dx - s * dy, y: layer.y + layer.h / 2 + s * dx + c * dy };
}
export function localPoint(layer, p) {
  const a = (-(layer.angle || 0) * Math.PI) / 180,
    c = Math.cos(a),
    s = Math.sin(a),
    dx = p.x - layer.x - layer.w / 2,
    dy = p.y - layer.y - layer.h / 2;
  return { x: layer.w / 2 + c * dx - s * dy, y: layer.h / 2 + s * dx + c * dy };
}
export function resizedLayer(layer, dx, dy, lock) {
  const a = ((layer.angle || 0) * Math.PI) / 180,
    c = Math.cos(a),
    s = Math.sin(a),
    lx = c * dx + s * dy,
    ly = -s * dx + c * dy,
    w = Math.min(32768, Math.max(1, layer.w + lx)),
    h = lock ? (w * layer.h) / layer.w : Math.min(32768, Math.max(1, layer.h + ly)),
    anchor = layerPoint(layer, 0, 0),
    cx = anchor.x + (c * w) / 2 - (s * h) / 2,
    cy = anchor.y + (s * w) / 2 + (c * h) / 2;
  return { ...layer, x: cx - w / 2, y: cy - h / 2, w, h };
}
export function layerBounds(layer) {
  const p = [
      layerPoint(layer, 0, 0),
      layerPoint(layer, layer.w, 0),
      layerPoint(layer, 0, layer.h),
      layerPoint(layer, layer.w, layer.h),
    ],
    left = Math.floor(Math.min(...p.map((p) => p.x))),
    top = Math.floor(Math.min(...p.map((p) => p.y))),
    right = Math.ceil(Math.max(...p.map((p) => p.x))),
    bottom = Math.ceil(Math.max(...p.map((p) => p.y)));
  return { x: left, y: top, w: right - left, h: bottom - top };
}

export function eraseAt(layer, p, radius) {
  const local = localPoint(layer, p),
    u = local.x / layer.w,
    v = local.y / layer.h,
    x = layer.sx + (layer.flipX ? 1 - u : u) * layer.sw,
    y = layer.sy + (layer.flipY ? 1 - v : v) * layer.sh,
    c = layer.source.getContext('2d');
  c.save();
  c.globalCompositeOperation = 'destination-out';
  c.beginPath();
  c.ellipse(x, y, (radius * layer.sw) / layer.w, (radius * layer.sh) / layer.h, 0, 0, Math.PI * 2);
  c.fill();
  c.restore();
}

export const resizeHandles = [
  [0, 0],
  [0.5, 0],
  [1, 0],
  [1, 0.5],
  [1, 1],
  [0.5, 1],
  [0, 1],
  [0, 0.5],
];
export function resizeFromHandle(layer, dx, dy, index, lock = false) {
  const [hx, hy] = resizeHandles[index],
    ax = 1 - hx,
    ay = 1 - hy,
    a = ((layer.angle || 0) * Math.PI) / 180,
    c = Math.cos(a),
    s = Math.sin(a),
    lx = c * dx + s * dy,
    ly = -s * dx + c * dy;
  let w = hx === 0.5 ? layer.w : Math.max(1, Math.min(32768, layer.w + lx * (hx === 0 ? -1 : 1))),
    h = hy === 0.5 ? layer.h : Math.max(1, Math.min(32768, layer.h + ly * (hy === 0 ? -1 : 1)));
  if (lock) {
    let scale =
      hx === 0.5
        ? h / layer.h
        : hy === 0.5
          ? w / layer.w
          : Math.abs(w / layer.w - 1) >= Math.abs(h / layer.h - 1)
            ? w / layer.w
            : h / layer.h;
    scale = Math.min(
      32768 / Math.max(layer.w, layer.h),
      Math.max(1 / Math.min(layer.w, layer.h), scale),
    );
    w = layer.w * scale;
    h = layer.h * scale;
  }
  const anchor = layerPoint(layer, ax * layer.w, ay * layer.h),
    cx = anchor.x - c * (ax - 0.5) * w + s * (ay - 0.5) * h,
    cy = anchor.y - s * (ax - 0.5) * w - c * (ay - 0.5) * h;
  return { ...layer, x: cx - w / 2, y: cy - h / 2, w, h };
}
