import test from 'node:test';
import assert from 'node:assert/strict';
import { previewAlpha } from '../src/material-preview.js';

test('Ped cutout uses texture alpha and writes depth; blend and opaque remain explicit choices', () => {
  assert.deepEqual(previewAlpha({ mode: 'cutout', cutoff: 0.25 }, true), {
    transparent: false,
    alphaTest: 0.25,
    depthWrite: true,
  });
  assert.deepEqual(previewAlpha({ mode: 'blend', cutoff: 0.05 }, true), {
    transparent: true,
    alphaTest: 0.05,
    depthWrite: false,
  });
  assert.deepEqual(previewAlpha({ mode: 'opaque', cutoff: 0.9 }, true), {
    transparent: false,
    alphaTest: 0,
    depthWrite: true,
  });
  assert.deepEqual(previewAlpha({ mode: 'blend', cutoff: 0.9 }, false), {
    transparent: false,
    alphaTest: 0,
    depthWrite: true,
  });
});
