import { deflateRaw } from 'pako';
import { hashName } from '../../src/asset-tools.js';
export function studioMetaFixture(
  kind = 'ymap',
  { hash = hashName('qa-room'), x = 1200, badPointer = false } = {},
) {
  const data = new Uint8Array(4608),
    v = new DataView(data.buffer),
    ptr = (p, n) => v.setBigUint64(p, BigInt(0x50000000 + n), true);
  v.setUint32(16, 0x50524430, true);
  v.setUint16(20, 0x79, true);
  v.setUint32(28, 1, true);
  ptr(48, 128);
  v.setUint16(76, 3, true);
  for (const [i, type, len, p] of [
    [0, kind === 'ymap' ? 3545841574 : 3649811809, kind === 'ymap' ? 512 : 80, 256],
    [1, kind === 'ymap' ? 3461354627 : 2195127427, kind === 'ymap' ? 128 : 144, 1024],
    [2, 7, 8, 1280],
  ]) {
    const at = 128 + i * 16;
    v.setUint32(at, type, true);
    v.setUint32(at + 4, len, true);
    ptr(at + 8, p);
  }
  const at = kind === 'ymap' ? 256 + 96 : 256 + 24;
  v.setUint32(at, badPointer ? 4095 : 3, true);
  v.setUint16(at + 8, 1, true);
  v.setUint32(1280, 2, true);
  if (kind === 'ymap') {
    v.setUint32(1032, hash, true);
    v.setFloat32(1056, x, true);
    v.setFloat32(1060, 2500, true);
    v.setFloat32(1064, 55, true);
    v.setFloat32(1084, 1, true);
    v.setFloat32(1088, 1, true);
    v.setFloat32(1092, 1, true);
    v.setUint32(1108, 5, true);
  } else {
    v.setUint32(1024 + 88, hash, true);
    v.setUint32(1024 + 92, hash, true);
    v.setUint32(1024 + 112, hash, true);
  }
  const header = new Uint8Array(16),
    h = new DataView(header.buffer);
  h.setUint32(0, 0x37435352, true);
  h.setUint32(4, 2, true);
  h.setUint32(8, 0x08000003, true);
  h.setUint32(12, 0x08000000, true);
  const compressed = deflateRaw(data),
    out = new Uint8Array(16 + compressed.length);
  out.set(header);
  out.set(compressed, 16);
  return out.buffer;
}
