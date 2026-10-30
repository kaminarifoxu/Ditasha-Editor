import test from 'node:test';
import assert from 'node:assert/strict';
import { composeProjectionLayers } from '../src/projection-composite.js';
import { makeLayer } from '../src/editor.js';
import { createYtd } from '../src/asset-tools.js';
import { readYtd, writeYtd } from '../src/resource.js';

test('Tattoo compositing preserves every untouched source byte, including hidden RGB and low alpha', () => {
  const raw = new Uint8ClampedArray([
    199, 123, 71, 0, 201, 129, 77, 1, 203, 131, 79, 128, 205, 133, 81, 255,
  ]);
  const base = {
    ...makeLayer({ width: 4, height: 1 }, 'Skin'),
    originalPixels: { w: 4, h: 1, data: raw },
  };
  const art = new Uint8ClampedArray(16);
  art.set([0, 0, 0, 128], 8);
  const layer = {
    ...makeLayer({ width: 4, height: 1 }, 'Tattoo'),
    projectionPixels: art,
    preserveSourceAlpha: true,
  };
  const out = composeProjectionLayers([base, layer], 4, 1);
  assert.deepEqual([...out.slice(0, 8)], [...raw.slice(0, 8)]);
  assert.deepEqual([...out.slice(12)], [...raw.slice(12)]);
  assert.equal(out[11], 128, 'Tattoo destroyed the shader alpha channel');
  assert(Math.abs(out[8] - 101) < 2, 'Ink was not blended over the original skin RGB');
  const resource = readYtd(createYtd([{ name: 'sbase', w: 4, h: 1, out: raw }]).buffer);
  resource.textures[0].out = out;
  const saved = readYtd(writeYtd(resource, resource.textures).buffer).textures[0];
  assert.deepEqual([...saved.out], [...out]);
});
test('Original pixels survive projection removal and manual edits fall back to the canvas pipeline', () => {
  const raw = new Uint8ClampedArray([77, 88, 99, 0]);
  const base = {
    ...makeLayer({ width: 1, height: 1 }, 'Skin'),
    originalPixels: { w: 1, h: 1, data: raw },
  };
  assert.deepEqual(composeProjectionLayers([base], 1, 1), raw);
  assert.equal(
    composeProjectionLayers([base, makeLayer({ width: 1, height: 1 }, 'Manual paint')], 1, 1),
    null,
  );
  assert.equal(composeProjectionLayers([{ ...base, originalPixels: null }], 1, 1), null);
});
