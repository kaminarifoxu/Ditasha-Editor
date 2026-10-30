import { deflateRaw } from 'pako';
import { Resource } from '../../src/resource.js';
import { hashName } from '../../src/asset-tools.js';
export function componentYddFixture(model, names = ['lowr_000_u', 'teef_000_u', 'head_000_r']) {
  const r = new Resource(model, 165),
    v = r.v;
  const ptr = (at, to) => v.setBigUint64(at, BigInt(0x50000000 + to), true);
  ptr(32, 96);
  v.setUint16(40, 3, true);
  v.setUint16(56, 3, true);
  for (const [i, d] of [128, 3104, 3376].entries()) {
    if (i) r.bytes.copyWithin(d, 128, 336);
    ptr(64 + i * 8, d);
    v.setUint32(96 + i * 4, hashName(names[i]), true);
  }
  const compressed = deflateRaw(r.bytes),
    out = new Uint8Array(16 + compressed.length);
  out.set(r.header);
  out.set(compressed, 16);
  return out.buffer;
}
