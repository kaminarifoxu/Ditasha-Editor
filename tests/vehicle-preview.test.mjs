import test from 'node:test';
import assert from 'node:assert/strict';
import { deflateRaw } from 'pako';
import { Resource, readYtd, readYdd, readYft } from '../src/resource.js';
import { createYtd, hashName } from '../src/asset-tools.js';
import { viewerModel } from './viewer-format.test.mjs';
function pack(r, version) {
  const bytes = deflateRaw(r.bytes),
    out = new Uint8Array(16 + bytes.length);
  out.set(r.header);
  if (version) new DataView(out.buffer).setUint32(4, version, true);
  out.set(bytes, 16);
  return out.buffer;
}
function textureResource() {
  return new Resource(
    createYtd([{ name: 'vehicle_mask', w: 3, h: 2, out: new Uint8Array(24).fill(140) }]).buffer,
    13,
  );
}
export function alphaYtd() {
  const r = textureResource(),
    p = r.list(48, r.u16(56))[0],
    data = r.ptr(p + 112);
  r.v.setUint32(p + 88, 28, true);
  r.v.setUint16(p + 86, 4, true);
  r.bytes.set([0, 128, 255, 222, 64, 255, 1, 222], data);
  return pack(r);
}
test('Vehicle A8 masks decode alpha, padded rows and truncation safely', () => {
  const r = readYtd(alphaYtd()),
    t = r.textures[0];
  assert.equal(t.format, 'A8');
  assert.deepEqual(
    [...t.out].filter((_, i) => i % 4 === 3),
    [0, 128, 255, 64, 255, 1],
  );
  assert.ok([...t.out].every((v, i) => i % 4 === 3 || v === 255));
  const p = r.list(48, r.u16(56))[0];
  r.v.setUint16(p + 86, 65535, true);
  assert.throws(() => readYtd(pack(r)), /truncated/);
});
test('XRGB ignores unused alpha; luminance masks preserve channels', () => {
  for (const [format, expected] of [
    [22, [140, 140, 140, 255]],
    [50, [140, 140, 140, 255]],
    [51, [140, 140, 140, 140]],
  ]) {
    const r = textureResource(),
      p = r.list(48, r.u16(56))[0];
    r.v.setUint32(p + 88, format, true);
    assert.deepEqual([...readYtd(pack(r)).textures[0].out.slice(0, 4)], expected);
  }
});
test('Vehicle secondary diffuse sampler and UV2 are retained', () => {
  const r = new Resource(viewerModel, 165);
  r.v.setUint32(2256, hashName('DiffuseSampler2'), true);
  r.v.setUint32(1728, 193, true);
  r.v.setBigUint64(1736, 6n | (5n << 24n) | (5n << 28n), true);
  for (const [vb, at] of [
    [1408, 0],
    [1472, 128],
  ]) {
    r.v.setUint16(vb + 8, 28, true);
    for (let i = 0; i < 3; i++)
      for (const [offset, value] of [
        [0, i === 1 ? 1 : 0],
        [4, 0],
        [8, i === 2 ? 1 : 0],
        [12, 0.1],
        [16, 0.2],
        [20, 0.3],
        [24, 0.7],
      ])
        r.v.setFloat32(4096 + at + i * 28 + offset, value, true);
  }
  const [d] = readYdd(pack(r));
  assert.equal(d.geometries[0].diffuseTexture, 'cloth_diffuse');
  assert.equal(d.geometries[0].textureSamplers[0].hash, hashName('DiffuseSampler2'));
  assert.ok(Math.abs(d.geometries[0].uvs2[0] - 0.3) < 1e-6);
});
export function fragmentYft() {
  const r = new Resource(viewerModel, 165),
    ptr = (at, to) => r.v.setBigUint64(at, BigInt(0x50000000 + to), true);
  // Reuse the validated drawable at 128; empty separate drawable container with shared LOD geometry.
  ptr(48, 128);
  r.v.setUint32(72, 0, true);
  ptr(240, 3000);
  ptr(3016, 3056);
  ptr(3056 + 208, 3376);
  r.bytes[3056 + 285] = 1;
  ptr(3376, 3392);
  ptr(3392 + 160, 3680);
  ptr(3680 + 80, 512);
  r.v.setUint16(3392 + 18, 1234, true);
  return pack(r, 162);
}
test('YFT physics child drawables are inspectable and inherit parent shader bindings', () => {
  const d = readYft(fragmentYft());
  assert.equal(d.length, 2);
  assert.match(d[1].name, /Fragment 1.*1234.*Pristine/);
  assert.equal(d[1].fragmentChild, true);
  assert.equal(d[1].geometries[0].diffuseTexture, 'cloth_diffuse');
});
test('Unsupported physics child retains main YFT with an explicit warning', () => {
  const r = new Resource(fragmentYft(), 162);
  r.v.setBigUint64(3680 + 80, 0x90000000n, true);
  const drawables = readYft(pack(r));
  assert.equal(drawables.length, 1);
  assert.ok(drawables[0].warnings.some((w) => /Fragment 1.*Pointer/.test(w)));
});

test('Rigid vehicle parts use hierarchical bone transforms without mutating shared geometry', () => {
  const r = new Resource(viewerModel, 165);
  const ptr = (at, to) => r.v.setBigUint64(at, BigInt(0x50000000 + to), true);
  ptr(128 + 24, 3000);
  ptr(3000 + 32, 3200);
  ptr(3000 + 56, 3400);
  r.v.setUint16(3000 + 94, 2, true);
  for (let i = 0; i < 2; i++) {
    const at = 3200 + i * 80;
    r.v.setFloat32(at + 12, 1, true);
    for (const offset of [32, 36, 40]) r.v.setFloat32(at + offset, 1, true);
    r.v.setInt16(3400 + i * 2, i - 1, true);
  }
  r.v.setFloat32(3200 + 16, 2, true);
  r.v.setFloat32(3280 + 20, 3, true);
  r.v.setUint32(648 + 40, 1 << 24, true);
  const model = readYdd(pack(r))[0];
  assert.deepEqual([...model.geometries[0].positions.slice(0, 3)], [2, 0, -0]);
  assert.deepEqual([...model.geometries[1].positions.slice(0, 3)], [2, 0, -3]);
  r.v.setInt16(3400, 1, true);
  assert.throws(() => readYdd(pack(r)), /Cyclic/);
});

export function bc7Ytd() {
  const r = new Resource(
    createYtd([{ name: 'bc7_diffuse', w: 4, h: 4, out: new Uint8Array(64) }]).buffer,
    13,
  );
  const p = r.list(48, r.u16(56))[0],
    data = r.ptr(p + 112);
  const block = new Uint8Array(16);
  let bit = 0;
  const write = (value, count) => {
    for (let i = 0; i < count; i++, bit++) block[bit >> 3] |= ((value >> i) & 1) << (bit & 7);
  };
  // BC7 mode 6, equal endpoints (opaque red), independent endpoint p-bits.
  write(64, 7);
  for (const value of [127, 127, 0, 0, 0, 0, 127, 127]) write(value, 7);
  write(1, 1);
  write(1, 1);
  r.v.setUint32(p + 88, 0x20374342, true);
  r.bytes.set(block, data);
  return pack(r);
}
test('BC7 YTD decodes RGBA and exports editable pixels; truncated blocks are rejected', () => {
  const r = readYtd(bc7Ytd()),
    t = r.textures[0];
  assert.equal(t.format, 'BC7');
  for (let i = 0; i < t.out.length; i += 4)
    assert.deepEqual([...t.out.slice(i, i + 4)], [255, 1, 1, 255]);
  const edited = t.out.slice();
  edited.set([20, 30, 40, 50], 0);
  assert.deepEqual(
    [
      ...readYtd(
        createYtd([{ name: t.name, w: t.w, h: t.h, out: edited }]).buffer,
      ).textures[0].out.slice(0, 4),
    ],
    [20, 30, 40, 50],
  );
  r.v.setBigUint64(t.p + 112, BigInt(0x60000000 + r.bytes.length - r.sys - 8), true);
  assert.throws(() => readYtd(pack(r)), /truncated/);
});
