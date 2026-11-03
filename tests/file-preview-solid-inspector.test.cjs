'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const preview = fs.readFileSync(path.join(__dirname, '../src/file-preview.js'), 'utf8');
const material = fs.readFileSync(path.join(__dirname, '../src/preview-texture-material.js'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '../ui/files-workspace.css'), 'utf8');

test('opaque garment uses frontface depth writing and hair cutouts retain transparency', () => {
  assert.match(preview, /previewMaterialAlpha\(g, t, file\.name, modelPreviewAlpha\(g\)\)/);
  assert.match(preview, /side: alpha\.side === 'double' \? THREE\.DoubleSide : THREE\.FrontSide/);
  assert.match(preview, /transparent: alpha\.transparent/);
  assert.match(preview, /depthWrite: alpha\.depthWrite/);
  assert.match(material, /if \(fabric && shaderAlpha\?\.mode !== 'cutout'\)/);
  assert.match(material, /if \(shaderAlpha\?\.mode === 'cutout' \|\| \(detail && hasCutout\)\)/);
});

test('expanded YTD inspector uses larger atlas viewport', () => {
  assert.match(css, /minmax\(0, 64fr\) minmax\(320px, 36fr\)/);
  assert.match(css, /max-height:310px!important/);
});
