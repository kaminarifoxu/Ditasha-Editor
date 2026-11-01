'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../src/file-manager-ui.js'), 'utf8');
test('main layout is retained and Clothing Library is read-only companion fallback', () => {
  assert.match(source, /const assetPreview = createFilePreview\(\$\('fmImage'\)\)/);
  assert.match(source, /const previewApi = \(\) =>/);
  assert.match(source, /await assetPreview\.show\(file, previewApi\(\)\)/);
  assert.match(source, /if \(data\.companion \|\|/);
  assert.match(source, /candidates\.length !== 1/);
  assert.match(source, /if \(!gender\) return data/);
});
test('Clothing Library data bytes are mapped to File Manager preview shape', () => {
  assert.match(source, /return \{name: result\.name, data: result\.bytes\}/);
  assert.match(source, /const paired = await readWithClothingCompanion\(data\.companion\.id\)/);
});
