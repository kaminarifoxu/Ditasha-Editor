import { deflateRaw } from 'pako';
import { Resource } from '../../src/resource.js';
import { hashName } from '../../src/asset-tools.js';
export function liveryYftFixture(
  model,
  { embedded = true, shader = 'vehicle_paint3', primary = 'cloth_diffuse' } = {},
) {
  const r = new Resource(model, 165),
    v = r.v;
  const ptr = (at, to) => v.setBigUint64(at, BigInt(0x50000000 + to), true);
  if (!embedded) v.setBigUint64(2048 + 8, 0n, true);
  if (primary !== 'cloth_diffuse') {
    ptr(2344, 2880);
    r.bytes.set(new TextEncoder().encode(primary + '\0'), 2880);
  }
  ptr(48, 128);
  v.setUint32(72, 0, true);
  // One visible surface: manual replacement targets one selected mesh.
  // The source fixture has two coincident meshes, which would hide each other.
  v.setUint16(512 + 8, 1, true);
  v.setUint32(2176 + 8, hashName(shader), true);
  v.setUint32(2176 + 24, hashName(shader + '.sps'), true);
  r.bytes[2176 + 16] = 2;
  r.bytes.fill(0, 2256, 2272);
  ptr(2264, 2400);
  ptr(2440, 2480);
  r.bytes.set(new TextEncoder().encode('vehicle_sign_1\0'), 2480);
  v.setUint32(2272, hashName('DiffuseSampler'), true);
  v.setUint32(2276, hashName('DiffuseSampler2'), true);
  v.setUint32(1728, 193, true);
  v.setBigUint64(1736, 6n | (5n << 24n) | (5n << 28n), true);
  for (const [vb, data] of [
    [1408, 4096],
    [1472, 4224],
  ]) {
    v.setUint16(vb + 8, 28, true);
    for (let i = 0; i < 3; i++) {
      for (const [offset, value] of [
        [0, i === 1 ? 1 : 0],
        [4, 0],
        [8, i === 2 ? 1 : 0],
        [12, 0.5],
        [16, 0.5],
        [20, i === 1 ? 1 : 0],
        [24, i === 2 ? 1 : 0],
      ])
        v.setFloat32(data + i * 28 + offset, value, true);
    }
  }
  const bytes = deflateRaw(r.bytes),
    out = new Uint8Array(16 + bytes.length);
  out.set(r.header);
  new DataView(out.buffer).setUint32(4, 162, true);
  out.set(bytes, 16);
  return out.buffer;
}
