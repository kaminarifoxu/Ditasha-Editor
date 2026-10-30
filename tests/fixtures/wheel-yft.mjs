import { deflateRaw } from 'pako';
import { Resource } from '../../src/resource.js';

// Wrap an existing small drawable in six independently positioned physics children.
export function wheelYftFixture(drawableBuffer, { damaged = true, pose = false } = {}) {
  const original = new Resource(drawableBuffer, 165),
    sys = 16384;
  const bytes = new Uint8Array(sys + original.bytes.length - original.sys),
    v = new DataView(bytes.buffer);
  bytes.set(original.bytes.subarray(0, original.sys));
  bytes.set(original.bytes.subarray(original.sys), sys);
  const ptr = (at, to) => v.setBigUint64(at, BigInt(0x50000000 + to), true);
  ptr(48, 128);
  v.setUint32(72, 0, true);
  ptr(240, 2704);
  ptr(2720, 2768);
  ptr(2768 + 208, 3104);
  bytes[2768 + 285] = 6;
  ptr(2768 + 256, 7040);
  v.setUint32(7056, 6, true);
  const tags = [27922, 26418, 27902, 26398, 29921, 5857];
  for (let i = 0; i < 6; i++) {
    const d = 3456 + i * 336,
      child = 5472 + i * 256;
    // Front/rear donor geometry; other wheels use empty drawable placeholders.
    if (i === 0 || i === 2) bytes.set(original.bytes.subarray(128, 464), d);
    ptr(3104 + i * 8, child);
    v.setUint16(child + 18, tags[i], true);
    ptr(child + 160, i === 4 ? 3456 : d); // One explicit shared drawable instance too.
    const at = 7072 + i * 64;
    for (const n of [0, 5, 10]) v.setFloat32(at + n * 4, 1, true);
    v.setFloat32(at + 48, i % 2 ? 2 : -2, true);
    v.setFloat32(at + 52, i < 2 ? 3 : i < 4 ? -3 : 0, true);
    v.setFloat32(at + 56, 0.75, true);
  }
  v.setFloat32(2768 + 48, 0.25, true);
  v.setFloat32(2768 + 52, 0.5, true);
  ptr(3792 + 80, 10000); // A non-null but empty model list is still a placeholder.
  if (damaged) {
    bytes.set(original.bytes.subarray(128, 464), 8800);
    ptr(5472 + 168, 8800);
  }
  if (pose) {
    ptr(128 + 24, 7488);
    ptr(7488 + 32, 7600);
    v.setUint16(7488 + 94, 1, true);
    v.setFloat32(7600 + 12, 1, true);
    for (const at of [32, 36, 40]) v.setFloat32(7600 + at, 1, true);
    v.setInt16(7600 + 50, -1, true);
    v.setFloat32(7600 + 16, 99, true);
    ptr(168, 8192);
    bytes[8192 + 16] = 1;
    for (const i of [0, 5, 10]) v.setFloat32(8192 + 32 + i * 4, 1, true);
    v.setFloat32(8192 + 32 + 3 * 4, 4, true);
  }
  const compressed = deflateRaw(bytes),
    out = new Uint8Array(16 + compressed.length);
  out.set(original.header);
  const h = new DataView(out.buffer);
  h.setUint32(4, 162, true);
  h.setUint32(8, 0x08000005, true);
  out.set(compressed, 16);
  return out.buffer;
}
