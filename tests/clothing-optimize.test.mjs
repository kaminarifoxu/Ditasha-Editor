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
test('transparent borders use alpha-weighted filtering without bleeding hidden black pixels', () => {
  const t = { w: 2, h: 1, out: new Uint8Array([255, 0, 0, 255, 0, 0, 0, 0]) },
    out = resizeTexture(t, 1, 1);
  assert.deepEqual([...out.out], [255, 0, 0, 128]);
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
