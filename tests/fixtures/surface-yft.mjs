import { deflateRaw } from 'pako';
import { Resource } from '../../src/resource.js';
import { hashName } from '../../src/asset-tools.js';
import { liveryYftFixture } from './livery-yft.mjs';
export function surfaceYftFixture(model, { falloff = 40 } = {}) {
  const r = new Resource(liveryYftFixture(model, { embedded: false, shader: 'vehicle_mesh' }), 162),
    v = r.v;
  const ptr = (at, to) => v.setBigUint64(at, BigInt(0x50000000 + to), true);
  ptr(2176, 3000);
  r.bytes[2192] = 7;
  r.bytes.fill(0, 3000, 3204);
  const items = [
    ['DiffuseSampler', 0, 2304],
    ['BumpSampler', 0, 3300],
    ['SpecSampler', 0, 3380],
    ['bumpiness', 1, 3112],
    ['specularIntensityMult', 1, 3128],
    ['specularFalloffMult', 1, 3144],
    ['specMapIntMask', 1, 3160],
  ];
  items.forEach(([name, type, data], i) => {
    const p = 3000 + i * 16;
    r.bytes[p] = type;
    ptr(p + 8, data);
    v.setUint32(3176 + i * 4, hashName(name), true);
  });
  ptr(3340, 3480);
  ptr(3420, 3520);
  r.bytes.set(new TextEncoder().encode('surface_normal\0'), 3480);
  r.bytes.set(new TextEncoder().encode('surface_spec\0'), 3520);
  v.setFloat32(3112, 0.8, true);
  v.setFloat32(3128, 2, true);
  v.setFloat32(3144, falloff, true);
  v.setFloat32(3160, 1, true);
  // The native base fixture has constant UV0. Vary it for surface maps.
  for (let i = 0; i < 3; i++) {
    v.setFloat32(4096 + i * 28 + 12, i === 1 ? 1 : 0, true);
    v.setFloat32(4096 + i * 28 + 16, i === 2 ? 1 : 0, true);
  }
  const body = deflateRaw(r.bytes),
    out = new Uint8Array(16 + body.length);
  out.set(r.header);
  out.set(body, 16);
  return out.buffer;
}
