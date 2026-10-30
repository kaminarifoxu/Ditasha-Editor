import { deflateRaw } from 'pako';
import { Resource } from '../../src/resource.js';
import { createYtd } from '../../src/asset-tools.js';
export function bc5YtdFixture({ broken = false, w = 4, h = 4 } = {}) {
  const source = createYtd([
    { name: 'env_smooth_concrete2', w: 4, h: 4, out: new Uint8Array(64).fill(255) },
    ...(broken ? [{ name: 'broken_unused', w: 1, h: 1, out: new Uint8Array(4) }] : []),
  ]);
  const r = new Resource(
      source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength),
      13,
    ),
    ptrs = r.list(48, r.u16(56)),
    p = ptrs.find((p) => r.str(r.ptr(p + 40)) === 'env_smooth_concrete2'),
    data = r.ptr(p + 112);
  r.v.setUint16(p + 80, w, true);
  r.v.setUint16(p + 82, h, true);
  r.v.setUint32(p + 88, 0x32495441, true);
  // Red uses six interpolated values; green uses four plus the 0/255 endpoints.
  r.bytes.set([210, 0, 0, 0, 0, 0, 0, 0, 10, 110, 0, 0, 0, 0, 0, 0], data);
  for (let c = 0; c < 2; c++) {
    let bits = 0n;
    for (let i = 0; i < 16; i++) bits |= BigInt(i % 8) << BigInt(i * 3);
    for (let i = 0; i < 6; i++)
      r.bytes[data + c * 8 + 2 + i] = Number((bits >> BigInt(i * 8)) & 255n);
  }
  if (broken)
    r.v.setUint32(
      ptrs.find((p) => r.str(r.ptr(p + 40)) === 'broken_unused') + 88,
      0xffffffff,
      true,
    );
  const compressed = deflateRaw(r.bytes),
    out = new Uint8Array(16 + compressed.length);
  out.set(r.header);
  out.set(compressed, 16);
  return out.buffer;
}
