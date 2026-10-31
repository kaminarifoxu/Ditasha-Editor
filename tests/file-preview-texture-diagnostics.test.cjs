'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const viewer = fs.readFileSync(path.join(__dirname, '../src/file-preview.js'), 'utf8');

test('missing YTD names are diagnosed instead of silently grey with no explanation', () => {
  assert.match(viewer, /const missingTextures =/);
  assert.match(viewer, /fm-missing-textures/);
  assert.match(viewer, /resolveModelTexture\(/);
  assert.match(viewer, /textureNameMatches\(/);
});

test('external variants are scored independently from embedded textures', () => {
  const score = viewer.match(/const textureScore = textures =>[\s\S]*?\n      }, 0\);/)?.[0] || '';
  assert.match(score, /textures\.some\(/);
  assert.doesNotMatch(score, /embedded/);
});

test('cross-YTD fallback only uses unique matches and keeps user choice intact', () => {
  assert.match(viewer, /if \(!textureId && Array\.isArray\(file\.textures\)/);
  assert.match(viewer, /if \(matches\.length === 1\)/);
  assert.match(viewer, /const setTextureVariant = async \(textureId\)/);
});
