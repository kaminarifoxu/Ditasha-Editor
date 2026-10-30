import test from 'node:test';
import assert from 'node:assert/strict';
import { Resource, readYtd, writeYtd, decodeTexture } from '../src/resource.js';
import { performResourceJob } from '../src/resource-jobs.js';
import { textureThumbnail, MAX_DECODED_TEXTURE_BYTES } from '../src/texture-memory.js';
import { largeYtdFixture } from './fixtures/large-ytd.mjs';

test('A 192 MB decoded vehicle dictionary opens, edits and saves without expanding untouched DXT/mips', () => {
  const input = largeYtdFixture();
  assert.throws(
    () => performResourceJob('ytd', input, { maxDecodedBytes: 128 * 1024 * 1024 }),
    /Decoded texture limit/,
  );
  const r = performResourceJob('ytd', input);
  assert.equal(
    r.textures.reduce((n, t) => n + t.out.byteLength, 0),
    192 * 1024 * 1024,
  );
  const thumb = textureThumbnail(r.textures[0]);
  assert.equal(thumb.out.byteLength, 96 * 96 * 4);
  assert.deepEqual([...thumb.out.slice(0, 4)], [255, 0, 0, 255]);
  r.textures[0].out.set([23, 45, 67, 89]);
  const saved = writeYtd(r, r.textures),
    reopened = new Resource(saved.buffer, 13, 384 * 1024 * 1024);
  assert.deepEqual([...decodeTexture(reopened, r.textures[0].p).out.slice(0, 4)], [23, 45, 67, 89]);
  for (const t of r.textures.slice(1)) {
    assert.equal(reopened.u32(t.p + 88), 0x31545844);
    assert.equal(reopened.bytes[t.p + 93], 2);
    const start = r.ptr(t.p + 112),
      next = reopened.ptr(t.p + 112);
    assert.deepEqual(
      reopened.bytes.subarray(next, next + 10 * 1024 * 1024),
      r.bytes.subarray(start, start + 10 * 1024 * 1024),
    );
  }
  assert.ok(reopened.bytes.length < 192 * 1024 * 1024, 'Untouched textures must stay compressed');
});

test('Decoded YTD limits still reject oversized or invalid budgets before allocating texture pixels', () => {
  const input = largeYtdFixture(17);
  assert.throws(() => readYtd(input), /Decoded texture limit: 1024 MB/);
  assert.throws(
    () => readYtd(input, { maxDecodedBytes: MAX_DECODED_TEXTURE_BYTES * 2 }),
    /Decoded texture limit/,
  );
  assert.throws(() => readYtd(input, { maxDecodedBytes: NaN }), /Decoded texture limit/);
});
