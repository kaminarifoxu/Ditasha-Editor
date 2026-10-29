import test from 'node:test';
import assert from 'node:assert/strict';
import { readYtd, writeYtd, decodeTexture } from '../src/resource.js';
import { bc5YtdFixture } from './fixtures/bc5-ytd.mjs';
test('ATI2/BC5 decodes independent RG tables and opaque alpha, preserving unmodified native blocks', () => {
  const r = readYtd(bc5YtdFixture()),
    t = r.textures[0];
  assert.equal(t.format, 'BC5');
  const red = [210, 0, 180, 150, 120, 90, 60, 30],
    green = [10, 110, 30, 50, 70, 90, 0, 255];
  for (let i = 0; i < 16; i++)
    assert.deepEqual([...t.out.slice(i * 4, i * 4 + 4)], [red[i % 8], green[i % 8], 0, 255]);
  const saved = readYtd(writeYtd(r, r.textures).buffer);
  assert.equal(saved.textures[0].format, 'BC5');
  assert.deepEqual(saved.textures[0].out, t.out);
});
test('BC5 edge blocks clip to dimensions and reject truncated storage; mixed dictionaries keep readable maps', () => {
  const r = readYtd(bc5YtdFixture({ w: 3, h: 2 }));
  assert.equal(r.textures[0].out.length, 24);
  const p = r.textures[0].p,
    data = r.ptr(p + 112);
  r.bytes = r.bytes.slice(0, data + 15);
  assert.throws(() => decodeTexture(r, p), /truncated/);
  const mixed = readYtd(bc5YtdFixture({ broken: true }), { tolerateErrors: true });
  assert.equal(mixed.textures.length, 1);
  assert.equal(mixed.warnings.length, 1);
  assert.match(mixed.warnings[0], /broken_unused/);
});
