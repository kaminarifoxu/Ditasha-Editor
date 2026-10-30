import { deflateRaw } from 'pako';

// Three independent 4K DXT1 textures, each with a 2K mip: 192 MB RGBA,
// but only 30 MB native graphics. No user asset or network download is required.
export function largeYtdFixture(count = 3) {
  const sys = 4096,
    gfx = 32 * 1024 * 1024;
  const bytes = new Uint8Array(sys + gfx),
    v = new DataView(bytes.buffer);
  const ptr = (at, to) => v.setBigUint64(at, BigInt(to), true);
  ptr(48, 0x50000060);
  v.setUint16(56, count, true);
  for (let i = 0; i < count; i++) {
    const p = 256 + i * 144,
      offset = (i % 3) * 10 * 1024 * 1024;
    ptr(96 + i * 8, 0x50000000 + p);
    ptr(p + 40, 0x50000c00 + i * 32);
    bytes.set(new TextEncoder().encode('vehicle_diff_' + i), 3072 + i * 32);
    v.setUint16(p + 80, 4096, true);
    v.setUint16(p + 82, 4096, true);
    v.setUint16(p + 86, 8192, true);
    v.setUint32(p + 88, 0x31545844, true);
    bytes[p + 93] = 2;
    ptr(p + 112, 0x60000000 + offset);
    v.setUint16(sys + offset, 0xf800, true);
    bytes[sys + offset + 8 * 1024 * 1024] = 0x7b;
  }
  const compressed = deflateRaw(bytes),
    result = new Uint8Array(16 + compressed.length);
  const header = new DataView(result.buffer);
  header.setUint32(0, 0x37435352, true);
  header.setUint32(4, 13, true);
  header.setUint32(8, 0x08000003, true);
  header.setUint32(12, 0xd002000c, true);
  result.set(compressed, 16);
  return result.buffer;
}
