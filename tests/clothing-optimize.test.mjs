import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { deflateRaw } from 'pako';
import { createYtd, zipFiles } from '../src/asset-tools.js';
import { readYtd, Resource } from '../src/resource.js';
import { optimizeYtd } from '../src/texture-optimize.js';
import { resizeTexture } from '../src/texture-compress.js';
import { analyzePack, clothingInfo } from '../src/clothing-pack.js';
const hash = (b) => createHash('sha256').update(new Uint8Array(b)).digest('hex');
const texture = (name, w, h, alpha = false) => ({
  name,
  w,
  h,
  out: Uint8Array.from({ length: w * h * 4 }, (_, i) =>
    i % 4 === 3 ? (alpha ? (Math.floor(i / 4) % 4) * 85 : 255) : [200, 60, 30][i % 4],
  ),
});
test('optimizer writes native BC1/BC3 with full mip chains, names and lookup hashes intact', () => {
  const input = createYtd([texture('opaque', 32, 16), texture('alpha', 16, 16, true)]),
    original = hash(input);
  const result = optimizeYtd(input.buffer),
    output = readYtd(result.bytes.buffer),
    source = readYtd(input.buffer);
  assert.equal(result.changed, 2);
  assert.ok(result.after < result.before);
  assert.equal(hash(input), original);
  for (const t of output.textures) {
    const expected = source.textures.find((s) => s.name === t.name);
    assert.equal(t.nameHash, expected.nameHash);
    assert.equal(t.format, t.name === 'alpha' ? 'DXT5' : 'DXT1');
    assert.equal(output.u16(t.p + 86), t.w * (t.format === 'DXT5' ? 1 : 0.5));
    assert.equal(t.mipLevels, Math.floor(Math.log2(t.w)) + 1);
    assert.equal(t.w, expected.w);
    assert.equal(t.h, expected.h);
    for (let i = 0; i < t.out.length; i += 4) {
      for (let c = 0; c < 3; c++)
        if (expected.out[i + 3]) assert.ok(Math.abs(t.out[i + c] - expected.out[i + c]) <= 10);
      assert.ok(Math.abs(t.out[i + 3] - expected.out[i + 3]) <= 18);
      if ([0, 255].includes(expected.out[i + 3])) assert.equal(t.out[i + 3], expected.out[i + 3]);
    }
  }
  const again = optimizeYtd(result.bytes.buffer);
  assert.equal(again.changed, 0);
  assert.equal(hash(again.bytes), hash(result.bytes));
});
test('resize preserves aspect ratio, lowers memory and never upscales a small atlas', () => {
  const input = createYtd([texture('atlas', 512, 256), texture('small', 16, 8)]),
    result = optimizeYtd(input.buffer, { maxSize: 256 }),
    out = readYtd(result.bytes.buffer);
  assert.equal(out.textures.find((t) => t.name === 'atlas').w, 256);
  assert.equal(out.textures.find((t) => t.name === 'atlas').h, 128);
  assert.equal(out.textures.find((t) => t.name === 'small').w, 16);
  assert.ok(result.after < result.before / 4);
});
test('already-compressed pixels repack oversized graphics allocation without another lossy encode', () => {
  const first = optimizeYtd(createYtd([texture('cloth', 32, 16)]).buffer);
  const resource = new Resource(first.bytes.buffer, 13);
  const oversized = new Uint8Array(resource.sys + 65536);
  oversized.set(resource.bytes);
  const header = resource.header.slice();
  new DataView(header.buffer).setUint32(12, 0x08000007, true);
  const payload = deflateRaw(oversized),
    input = new Uint8Array(16 + payload.length);
  input.set(header);
  input.set(payload, 16);
  const original = hash(input),
    result = optimizeYtd(input.buffer);
  assert.equal(result.changed, 0);
  assert.equal(result.repacked, true);
  assert.equal(result.allocation.before, 65536);
  assert.ok(result.allocation.after < 65536);
  assert.equal(hash(input), original);
  assert.deepEqual(
    readYtd(result.bytes.buffer).textures[0].out,
    readYtd(first.bytes.buffer).textures[0].out,
  );
  assert.equal(optimizeYtd(result.bytes.buffer).repacked, false);
});
test('transparent borders use alpha-weighted filtering without bleeding hidden black pixels', () => {
  const t = { w: 2, h: 1, out: new Uint8Array([255, 0, 0, 255, 0, 0, 0, 0]) },
    out = resizeTexture(t, 1, 1);
  assert.deepEqual([...out.out], [255, 0, 0, 128]);
});
test('a small pixel reduction cannot increase GPU pages through allocation rounding', () => {
  const first = optimizeYtd(createYtd([texture('near_limit', 513, 256, true)]).buffer);
  const r = new Resource(first.bytes.buffer, 13),
    gfx = 196608;
  const body = r.bytes.slice(0, r.sys + gfx),
    header = r.header.slice();
  new DataView(header.buffer).setUint32(12, 0x0c000007, true);
  const pages = r.ptr(8);
  if (pages !== null) body[pages + 9] = 2;
  const payload = deflateRaw(body),
    input = new Uint8Array(16 + payload.length);
  input.set(header);
  input.set(payload, 16);
  const result = optimizeYtd(input.buffer, { maxSize: 512 });
  assert.equal(result.changed, 0);
  assert.match(result.preservedReason, /alokasi GPU/);
  assert.equal(hash(input), hash(result.bytes));
  assert.equal(result.allocation.after, gfx);
});
test('oversized atlas uses a bounded existing mip, preserving names and source bytes', () => {
  const base = new Resource(createYtd([texture('large_clothing', 4, 4)]).buffer, 13);
  const body = new Uint8Array(base.sys + 131072);
  body.set(base.bytes.subarray(0, base.sys));
  const view = new DataView(body.buffer),
    p = base.list(48, base.u16(56))[0];
  view.setUint16(p + 80, 16384, true);
  view.setUint16(p + 82, 4, true);
  view.setUint16(p + 86, 8192, true);
  view.setUint32(p + 88, 0x31545844, true);
  body[p + 93] = 15;
  view.setBigUint64(p + 112, 0x60000000n, true);
  const header = base.header.slice();
  new DataView(header.buffer).setUint32(12, 0x08000008, true);
  const payload = deflateRaw(body),
    input = new Uint8Array(16 + payload.length);
  input.set(header);
  input.set(payload, 16);
  const original = hash(input),
    result = optimizeYtd(input.buffer, { maxSize: 256 });
  const output = readYtd(result.bytes.buffer).textures[0];
  assert.equal(output.name, 'large_clothing');
  assert.equal(output.w, 256);
  assert.equal(output.h, 1);
  assert.equal(hash(input), original);
  assert.ok(result.allocation.after < result.allocation.before);
});
test('unsupported texture descriptors fail without rewriting or dropping a texture', () => {
  const input = createYtd([texture('unknown', 16, 16)]),
    r = new Resource(input.buffer, 13),
    p = r.list(48, r.u16(56))[0];
  // Invalid settings also fail before processing or allocating output.
  assert.throws(() => optimizeYtd(input.buffer, { maxSize: 12 }), /Ukuran/);
  assert.equal(r.u32(p + 88), 21);
  r.v.setUint32(p + 88, 999, true);
  const body = deflateRaw(r.bytes),
    bad = new Uint8Array(16 + body.length);
  bad.set(r.header);
  bad.set(body, 16);
  const original = hash(bad);
  assert.throws(() => optimizeYtd(bad.buffer), /Format/);
  assert.equal(hash(bad), original);
});
test('ATI1/BC4 grayscale maps decode endpoint modes and resize without treating data as alpha', () => {
  const r = new Resource(createYtd([texture('cloth_mask', 512, 8)]).buffer, 13);
  const p = r.list(48, r.u16(56))[0],
    data = r.ptr(p + 112);
  r.v.setUint32(p + 88, 0x31495441, true);
  r.v.setUint16(p + 86, 256, true);
  r.bytes[p + 93] = 1;
  r.bytes.fill(0, r.sys);
  for (let offset = 0; offset < 2048; offset += 8) r.bytes[data + offset] = 255;
  r.bytes[data] = 0;
  r.bytes[data + 1] = 255;
  const bits = ((1n << 48n) - 1n) & ~1n;
  for (let i = 0; i < 6; i++) r.bytes[data + 2 + i] = Number((bits >> BigInt(i * 8)) & 255n);
  const payload = deflateRaw(r.bytes),
    input = new Uint8Array(16 + payload.length);
  input.set(r.header);
  input.set(payload, 16);
  const decoded = readYtd(input.buffer).textures[0];
  assert.equal(decoded.format, 'BC4');
  assert.deepEqual([...decoded.out.slice(0, 8)], [0, 0, 0, 255, 255, 255, 255, 255]);
  const result = optimizeYtd(input.buffer, { maxSize: 256 }),
    output = readYtd(result.bytes.buffer).textures[0];
  assert.equal(output.w, 256);
  assert.equal(output.h, 4);
  assert.equal(output.format, 'DXT1');
  assert.ok(output.out.every((value, index) => index % 4 !== 3 || value === 255));
});
test('clothing limits grow independently from other exports and collection pairing stays isolated', () => {
  const a = {
      path: 'stream/mp_m_freemode_01_one^jbib_000_u.ydd',
      data: { length: 129 * 1024 ** 2 },
    },
    b = { path: 'stream/mp_m_freemode_01_two^jbib_diff_000_a_uni.ytd', data: new Uint8Array(1) };
  assert.notEqual(clothingInfo(a.path).key, clothingInfo(b.path).key);
  assert.equal(analyzePack([a, b], 'replace').errors.length, 0);
  assert.ok(
    analyzePack([{ ...a, data: { length: 257 * 1024 ** 2 } }], 'replace').errors.some((e) =>
      e.includes('256 MB'),
    ),
  );
  assert.ok(
    analyzePack(
      Array.from({ length: 5001 }, (_, i) => ({
        path: 'stream/mp_m_freemode_01^jbib_' + String(i).padStart(3, '0') + '_u.ydd',
        data: new Uint8Array(1),
      })),
      'replace',
    ).errors.some((e) => e.includes('5.000')),
  );
  assert.throws(() => zipFiles([{ name: 'a', data: new Uint8Array(10) }], { maxBytes: 5 }), /ZIP/);
});
