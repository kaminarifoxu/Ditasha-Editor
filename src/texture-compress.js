// Original CPU BC1/BC3 encoder. Runs in the resource worker, without network services.
const pack565 = (c) =>
  (Math.round((c[0] * 31) / 255) << 11) |
  (Math.round((c[1] * 63) / 255) << 5) |
  Math.round((c[2] * 31) / 255);
const unpack565 = (c) => [
  Math.round(((c >>> 11) * 255) / 31),
  Math.round((((c >>> 5) & 63) * 255) / 63),
  Math.round(((c & 31) * 255) / 31),
];
export function resizeTexture(t, w, h, dataMap = false) {
  const out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const x0 = (x * t.w) / w,
        x1 = ((x + 1) * t.w) / w,
        y0 = (y * t.h) / h,
        y1 = ((y + 1) * t.h) / h;
      const sum = [0, 0, 0];
      let alpha = 0,
        weight = 0,
        colorWeight = 0;
      for (let sy = Math.floor(y0); sy < Math.ceil(y1); sy++)
        for (let sx = Math.floor(x0); sx < Math.ceil(x1); sx++) {
          const a =
            (Math.min(sx + 1, x1) - Math.max(sx, x0)) * (Math.min(sy + 1, y1) - Math.max(sy, y0));
          const p = (sy * t.w + sx) * 4,
            cw = a * (dataMap ? 1 : t.out[p + 3] / 255);
          for (let c = 0; c < 3; c++) sum[c] += t.out[p + c] * cw;
          alpha += t.out[p + 3] * a;
          weight += a;
          colorWeight += cw;
        }
      const p = (y * w + x) * 4;
      for (let c = 0; c < 3; c++) out[p + c] = colorWeight ? sum[c] / colorWeight : 0;
      out[p + 3] = alpha / weight;
    }
  return { w, h, out };
}
function colorBlock(pixels, out, offset) {
  const active = pixels.filter((p) => p[3] > 0),
    colors = active.length ? active : pixels;
  let lo = [255, 255, 255],
    hi = [0, 0, 0];
  for (const p of colors)
    for (let c = 0; c < 3; c++) {
      lo[c] = Math.min(lo[c], p[c]);
      hi[c] = Math.max(hi[c], p[c]);
    }
  // Fit endpoints to the assignments, then quantize again. Three iterations bound CPU work.
  let bestError = Infinity,
    best;
  for (let iteration = 0; iteration < 3; iteration++) {
    let a = pack565(hi),
      b = pack565(lo);
    if (a < b) [a, b] = [b, a];
    if (a === b) {
      if (a < 65535) a++;
      else b--;
    }
    const ca = unpack565(a),
      cb = unpack565(b),
      palette = [
        ca,
        cb,
        ca.map((v, c) => Math.round((2 * v + cb[c]) / 3)),
        ca.map((v, c) => Math.round((v + 2 * cb[c]) / 3)),
      ];
    const weights = [1, 0, 2 / 3, 1 / 3];
    let bits = 0,
      error = 0,
      aa = 0,
      ab = 0,
      bb = 0;
    const ax = [0, 0, 0],
      bx = [0, 0, 0];
    pixels.forEach((p, i) => {
      let choice = 0,
        distance = Infinity;
      for (let j = 0; j < 4; j++) {
        const d = palette[j].reduce((s, v, c) => s + (v - p[c]) ** 2, 0);
        if (d < distance) {
          distance = d;
          choice = j;
        }
      }
      bits |= choice << (i * 2);
      const importance = p[3] / 255,
        wa = weights[choice],
        wb = 1 - wa;
      error += distance * importance;
      aa += wa * wa * importance;
      ab += wa * wb * importance;
      bb += wb * wb * importance;
      for (let c = 0; c < 3; c++) {
        ax[c] += wa * p[c] * importance;
        bx[c] += wb * p[c] * importance;
      }
    });
    if (error < bestError) {
      bestError = error;
      best = [a, b, bits];
    }
    const determinant = aa * bb - ab * ab;
    if (determinant < 1e-8) break;
    hi = ax.map((v, c) => Math.max(0, Math.min(255, (v * bb - bx[c] * ab) / determinant)));
    lo = bx.map((v, c) => Math.max(0, Math.min(255, (v * aa - ax[c] * ab) / determinant)));
  }
  const v = new DataView(out.buffer, out.byteOffset, out.byteLength);
  v.setUint16(offset, best[0], true);
  v.setUint16(offset + 2, best[1], true);
  v.setUint32(offset + 4, best[2] >>> 0, true);
}
export function compressTexture(t, alpha) {
  const stride = alpha ? 16 : 8,
    out = new Uint8Array(Math.ceil(t.w / 4) * Math.ceil(t.h / 4) * stride);
  let offset = 0;
  for (let y = 0; y < t.h; y += 4)
    for (let x = 0; x < t.w; x += 4) {
      const pixels = [];
      for (let j = 0; j < 4; j++)
        for (let i = 0; i < 4; i++) {
          const p = (Math.min(y + j, t.h - 1) * t.w + Math.min(x + i, t.w - 1)) * 4;
          pixels.push([t.out[p], t.out[p + 1], t.out[p + 2], t.out[p + 3]]);
        }
      if (alpha) {
        const values = pixels.map((p) => p[3]),
          high = Math.max(...values),
          low = Math.min(...values),
          palette = [high, low];
        if (high > low)
          for (let i = 1; i <= 6; i++) palette.push(Math.round(((7 - i) * high + i * low) / 7));
        else {
          for (let i = 1; i <= 4; i++) palette.push(Math.round(((5 - i) * high + i * low) / 5));
          palette.push(0, 255);
        }
        out[offset] = high;
        out[offset + 1] = low;
        values.forEach((a, i) => {
          let choice = 0;
          for (let j = 1; j < 8; j++)
            if (Math.abs(palette[j] - a) < Math.abs(palette[choice] - a)) choice = j;
          const bit = i * 3,
            byte = offset + 2 + (bit >>> 3),
            shift = bit & 7;
          out[byte] |= choice << shift;
          if (shift > 5) out[byte + 1] |= choice >>> (8 - shift);
        });
      }
      colorBlock(pixels, out, offset + (alpha ? 8 : 0));
      offset += stride;
    }
  return out;
}
