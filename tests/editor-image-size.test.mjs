import test from 'node:test';
import assert from 'node:assert/strict';
import { validSize } from '../src/editor.js';

test('texture editor accepts large square images up to 8192x8192', () => {
  assert.equal(validSize(4096, 4096), true);
  assert.equal(validSize(8192, 8192), true);
  assert.equal(validSize(8192, 4096), true);
});

test('texture editor rejects dimensions beyond the supported canvas edge', () => {
  assert.equal(validSize(8193, 4096), false);
  assert.equal(validSize(4096, 8193), false);
  assert.equal(validSize(0, 1024), false);
  assert.equal(validSize(1024, 0), false);
  assert.equal(validSize(1.5, 1024), false);
});
