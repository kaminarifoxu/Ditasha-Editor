import { deflateRaw } from 'pako';
import { testYdd } from '../format.test.mjs';
import { Resource } from '../../src/resource.js';
export function boothPedFixture() {
  const original = new Resource(testYdd, 165),
    bytes = new Uint8Array(4608),
    v = new DataView(bytes.buffer);
  bytes.set(original.bytes.subarray(0, 512));
  const ptr = (at, to) => v.setBigUint64(at, BigInt(0x50000000 + to), true),
    gfx = (at, to) => v.setBigUint64(at, BigInt(0x60000000 + to), true);
  ptr(320, 1000);
  bytes.set(original.bytes.subarray(336, 488), 1000);
  ptr(1024, 2000);
  ptr(1056, 2400);
  ptr(1104, 1800);
  v.setUint16(1114, 1, true);
  v.setUint16(1800, 1, true);
  v.setUint32(312, 0x100, true); // skinned DrawableModel
  v.setUint16(2008, 28, true);
  gfx(2016, 0);
  v.setUint32(2024, 3, true);
  ptr(2048, 2200);
  v.setUint32(2200, 71, true);
  v.setBigUint64(2208, 6n | (9n << 4n) | (8n << 8n) | (5n << 24n), true);
  v.setUint32(2408, 3, true);
  gfx(2416, 128);
  ptr(104, 2560);
  ptr(2592, 2800);
  v.setUint16(2654, 2, true);
  for (let i = 0; i < 2; i++) {
    const at = 2800 + i * 80;
    v.setFloat32(at + 12, 1, true);
    for (const n of [32, 36, 40]) v.setFloat32(at + n, 1, true);
    v.setInt16(at + 50, i - 1, true);
    ptr(at + 56, 3200 + i * 48);
    bytes.set(new TextEncoder().encode(i ? 'SKEL_L_UpperArm' : 'SKEL_Root'), 3200 + i * 48);
    v.setUint16(at + 68, i, true);
  }
  v.setFloat32(2896, 0.5, true);
  v.setFloat32(2904, 1, true);
  for (const [i, p] of [
    [0.5, 0, 1],
    [1.2, 0, 1],
    [1.2, 0, 1.2],
  ].entries()) {
    const at = 4096 + i * 28;
    p.forEach((n, k) => v.setFloat32(at + k * 4, n, true));
    bytes[at + 12] = 255;
    v.setFloat32(at + 20, i === 1 ? 1 : 0, true);
    v.setFloat32(at + 24, i === 2 ? 1 : 0, true);
    v.setUint16(4224 + i * 2, i, true);
  }
  const header = original.header.slice();
  new DataView(header.buffer).setUint32(8, 0x08000003, true);
  const compressed = deflateRaw(bytes),
    out = new Uint8Array(16 + compressed.length);
  out.set(header);
  out.set(compressed, 16);
  return out.buffer;
}
