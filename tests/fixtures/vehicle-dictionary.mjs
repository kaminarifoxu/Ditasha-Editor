import { deflateRaw } from 'pako';
import { Resource } from '../../src/resource.js';
import { createYtd, hashName } from '../../src/asset-tools.js';

// Visible label differs from the dictionary lookup key; an unrelated map is broken.
export function keyedVehicleDictionary() {
  const r = new Resource(
    createYtd([
      { name: 'editor_body_label', w: 1, h: 1, out: new Uint8Array([0, 255, 0, 255]) },
      {
        name: 'vehicle_sign_1',
        w: 4,
        h: 1,
        out: new Uint8Array([0, 0, 255, 0, 0, 0, 255, 0, 0, 0, 255, 255, 0, 0, 255, 255]),
      },
      { name: 'broken_unused', w: 1, h: 1, out: new Uint8Array(4) },
    ]).buffer,
    13,
  );
  const hashes = r.ptr(32);
  r.list(48, r.u16(56)).forEach((p, i) => {
    const name = r.str(r.ptr(p + 40));
    if (name === 'editor_body_label')
      r.v.setUint32(hashes + i * 4, hashName('cloth_diffuse'), true);
    if (name === 'broken_unused') r.v.setUint32(p + 88, 0xffffffff, true);
  });
  const compressed = deflateRaw(r.bytes),
    out = new Uint8Array(16 + compressed.length);
  out.set(r.header);
  out.set(compressed, 16);
  return out.buffer;
}
