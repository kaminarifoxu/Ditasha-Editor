import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveEditorDiffuse, editorTextureMatches } from '../src/editor-material.js';

test('a partially matching ped atlas does not silently replace a different head sampler', () => {
  const atlas = { name: 'odeliaped_diffuse', dictionary: 'ls_odel^decl_diff_000_a_uni.ytd' };
  const head = { diffuseTexture: 'headnew' };
  assert.equal(resolveEditorDiffuse(head, [atlas], [], 'ls_odel^decl_000_u.ydd'), null);
  assert.equal(editorTextureMatches(head, atlas), false);
  head.previewDiffuseOverride = { name: atlas.name, dictionary: atlas.dictionary };
  assert.equal(resolveEditorDiffuse(head, [atlas], [], 'ls_odel^decl_000_u.ydd'), atlas);
  assert.equal(editorTextureMatches(head, atlas), true);
  assert.equal(head.diffuseTexture, 'headnew');
  const hair = { ...atlas, dictionary: 'ls_odel^hair_diff_000_a_uni.ytd' };
  assert.equal(resolveEditorDiffuse(head, [hair, atlas], [], ''), atlas);
  assert.equal(editorTextureMatches(head, hair), false);
  assert.equal(resolveEditorDiffuse(head, [hair], [], ''), null);
  delete head.previewDiffuseOverride;
  assert.equal(resolveEditorDiffuse(head, [atlas], [], ''), null);
});

test('embedded hair diffuse resolves without an external YTD and external replacement wins', () => {
  const hair = { diffuseTexture: 'odeliaped_diffuse' };
  const embedded = { name: 'odeliaped_diffuse' };
  const external = { name: 'odeliaped_diffuse', dictionary: 'ls_odel^hair_diff_000_a_uni.ytd' };
  assert.equal(resolveEditorDiffuse(hair, [], [embedded], ''), embedded);
  assert.equal(resolveEditorDiffuse(hair, [external], [embedded], ''), external);
});
