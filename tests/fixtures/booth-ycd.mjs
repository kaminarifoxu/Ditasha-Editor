import { deflateRaw } from 'pako';
// Entirely synthetic two-bone clip. No uploaded animation data is redistributed.
export function boothYcdFixture({
  encoding = 'quantized',
  cached = 7,
  segments = 1,
  variant = 0,
} = {}) {
  const data = new Uint8Array(8192),
    v = new DataView(data.buffer);
  const ptr = (p, n) => v.setBigUint64(p, BigInt(0x50000000 + n), true),
    u16 = (p, n) => v.setUint16(p, n, true),
    u32 = (p, n) => v.setUint32(p, n, true),
    f32 = (p, n) => v.setFloat32(p, n, true);
  ptr(40, 64);
  u16(48, 11);
  u16(50, 1);
  ptr(64, 160);
  u32(160, 123);
  ptr(168, 192);
  u32(208, 1);
  ptr(216, 300);
  data.set(new TextEncoder().encode('pack:/synthetic_emote'), 300);
  ptr(272, 352);
  f32(280, 0);
  f32(284, segments);
  f32(288, 1);
  u16(372, 2 * segments);
  u16(374, 2);
  f32(376, segments);
  ptr(416, 464);
  u16(424, segments);
  ptr(432, 448);
  u16(440, 2);
  u16(448, 0);
  data[451] = 0;
  u16(452, 1);
  data[455] = 1;
  for (let segment = 0; segment < segments; segment++) {
    const at = 512 + segment * 1024;
    ptr(464 + segment * 8, at);
    const header = [],
      counts = Array(9).fill(0),
      associations = Array.from({ length: 9 }, () => []),
      frames = [[], []];
    const int = (n) => {
      const b = new DataView(new ArrayBuffer(4));
      b.setInt32(0, n, true);
      header.push(...new Uint8Array(b.buffer));
    };
    const float = (n) => {
      const b = new DataView(new ArrayBuffer(4));
      b.setFloat32(0, n, true);
      header.push(...new Uint8Array(b.buffer));
    };
    const assoc = (type, seq, component) => {
      counts[type]++;
      associations[type].push(seq * 4 + component);
    };
    assoc(1, 0, 0);
    [0, 0, 0].forEach(float);
    const type = { static: 0, raw: 3, quantized: 4, indirect: 5, linear: 6, cached: 4 }[encoding];
    if (type === 0) {
      // static quaternions must precede static vectors in the binary stream
      const old = header.splice(0);
      assoc(0, 1, 0);
      [0, 0, 0.5].forEach(float);
      header.push(...old);
    } else {
      for (let component = 0; component < 3; component++) {
        assoc(type, 1, component);
        if (type === 4) {
          int(8);
          float(0.5 / 255);
          float(0);
          frames[0].push([0, 8]);
          frames[1].push([component === 0 ? 255 : 0, 8]);
        }
        if (type === 5) {
          int(2);
          int(8);
          int(1);
          float(0.5 / 255);
          float(0);
          int(component === 0 ? 255 << 8 : 0);
          frames[0].push([0, 2]);
          frames[1].push([1, 2]);
        }
        if (type === 3) {
          const b = new DataView(new ArrayBuffer(4));
          b.setFloat32(0, component === 0 ? 0.5 : 0, true);
          frames[0].push([0, 32]);
          frames[1].push([b.getUint32(0, true), 32]);
        }
        if (type === 6) {
          int(5);
          int(0x00080800);
          float(0.5 / 255);
          float(0);
          int(component === 0 ? 0x0001ff00 : 0x00010000);
        }
      }
      assoc(cached, 1, 3);
    }
    const bits = frames[0].reduce((n, [, width]) => n + width, 0),
      stride = Math.ceil(bits / 8),
      fo = header.length;
    const body = [...header, ...new Uint8Array(stride * 2)];
    for (let f = 0; f < 2; f++) {
      let p = (fo + f * stride) * 8;
      for (const [value, width] of frames[f])
        for (let k = 0; k < width; k++, p++)
          if (Math.floor(value / 2 ** k) % 2) body[p >> 3] |= 1 << (p & 7);
    }
    for (const n of counts) body.push(n & 255, n >> 8);
    for (const a of associations) {
      for (const n of a) body.push(n & 255, n >> 8);
      for (let n = a.length; n % 4; n++) body.push(0, 0);
    }
    u32(at + 4, body.length);
    u32(at + 12, fo);
    u16(at + 22, 2);
    u16(at + 24, stride);
    data[at + 30] = 64;
    data.set(body, at + 32);
  }
  const h = new Uint8Array(16),
    hv = new DataView(h.buffer);
  hv.setUint32(0, 0x37435352, true);
  hv.setUint32(4, 46, true);
  hv.setUint32(8, 0x08000004, true);
  if (variant) data[data.length - 1] = variant;
  const compressed = deflateRaw(data),
    out = new Uint8Array(16 + compressed.length);
  out.set(h);
  out.set(compressed, 16);
  return out.buffer;
}
