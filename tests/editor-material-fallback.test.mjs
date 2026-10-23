import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveEditorDiffuse } from '../src/editor-material.js';

const binding = {
  diffuseTexture: 'body_diffuse',
  previewDiffuseOverride: { name: 'custom', dictionary: 'selected.ytd' },
};
const original = { name: 'body_diffuse', dictionary: 'vehicle.ytd' };
const manual = { name: 'custom', dictionary: 'selected.ytd' };

test('preview override wins while its texture is loaded', () => {
  assert.equal(resolveEditorDiffuse(binding, [original, manual], [], 'vehicle.yft'), manual);
});

test('missing preview override falls back to original diffuse sampler', () => {
  assert.equal(resolveEditorDiffuse(binding, [original], [], 'vehicle.yft'), original);
});

test('missing override without any diffuse texture remains unresolved', () => {
  assert.equal(resolveEditorDiffuse(binding, [], [], 'vehicle.yft'), null);
});

test('no override resolves the original sampler normally', () => {
  assert.equal(
    resolveEditorDiffuse({ diffuseTexture: 'body_diffuse' }, [original], [], 'vehicle.yft'),
    original,
  );
});
