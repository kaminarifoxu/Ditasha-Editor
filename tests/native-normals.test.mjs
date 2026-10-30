import test from 'node:test';
import assert from 'node:assert/strict';
import { deflateRaw } from 'pako';
import { Resource, readYdd } from '../src/resource.js';
import { testYdd } from './format.test.mjs';
for (const type of [6, 10])
  test(
    'Native authored normals survive decoding: ' + (type === 6 ? 'Float3' : 'RGBA8 SNORM'),
    () => {
      const r = new Resource(testYdd, 165),
        v = r.v,
        b = r.bytes;
      const stride = type === 6 ? 32 : 24;
      v.setUint16(408, stride, true);
      v.setBigUint64(480, 0x60000080n, true);
      v.setUint32(496, 73, true);
      v.setBigUint64(504, 6n | (BigInt(type) << 12n) | (5n << 24n), true);
      for (let i = 0; i < 3; i++) {
        const at = 512 + i * stride;
        v.setFloat32(at, i === 1 ? 1 : 0, true);
        v.setFloat32(at + 4, 0, true);
        v.setFloat32(at + 8, i === 2 ? 1 : 0, true);
        if (type === 6) {
          v.setFloat32(at + 12, 0, true);
          v.setFloat32(at + 16, 1, true);
          v.setFloat32(at + 20, 0, true);
        } else b.set([0, 127, 0, 0], at + 12);
        v.setFloat32(at + stride - 8, i === 1 ? 1 : 0, true);
        v.setFloat32(at + stride - 4, i === 2 ? 1 : 0, true);
        v.setUint16(640 + i * 2, i, true);
      }
      const z = deflateRaw(b),
        packed = new Uint8Array(16 + z.length);
      packed.set(r.header);
      packed.set(z, 16);
      const normals = readYdd(packed.buffer)[0].geometries[0].normals;
      for (let i = 0; i < 3; i++)
        assert.deepEqual([...normals.slice(i * 3, i * 3 + 3)], [0, 0, -1]);
    },
  );
