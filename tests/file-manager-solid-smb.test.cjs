'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('nested folder view, safe SMB paths, and current alpha-aware clothing renderer are wired', () => {
  const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  const ui = read('src/file-manager-ui.js');
  const manager = read('electron/file-manager.cjs');
  const preview = read('src/file-preview.js');
  const material = read('src/preview-texture-material.js');
  assert.match(ui, /id="fmRecursive" type="checkbox" checked/);
  assert.match(ui, /smbButton\.id = 'fmSmb'/);
  assert.match(ui, /choose\(\{networkPath:saved\.networkPath\}\)/);
  assert.match(manager, /networkPath\.includes\('\.\.'\)/);
  assert.match(manager, /No passwords or SMB credentials/);
  assert.match(preview, /previewMaterialAlpha\(g, t, file\.name, modelPreviewAlpha\(g\)\)/);
  assert.match(preview, /depthWrite: alpha\.depthWrite/);
  assert.match(material, /if \(fabric && shaderAlpha\?\.mode !== 'cutout'\)/);
  assert.match(material, /transparent: false, alphaTest: 0, depthWrite: true/);
});
