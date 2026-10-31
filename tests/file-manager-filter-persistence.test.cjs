'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '..', 'src/file-manager-ui.js'), 'utf8');

test('file manager restores saved gender, slot and folder navigation preferences', () => {
  assert.match(source, /ditasha-file-manager-filters/);
  assert.match(source, /validGenders\.includes\(savedFilters\.gender\)/);
  assert.match(source, /slots\.includes\(savedFilters\.slot\)/);
  assert.match(source, /savedFilters\.showFolders === true/);
  assert.match(source, /syncAssetButtons\(\);\s*filterPanel\.querySelectorAll\('\[data-gender\]'\)/);
});

test('file manager saves filters whenever gender, slot or folder mode changes', () => {
  assert.match(source, /activeGender=b\.dataset\.gender;offset=0;saveLibraryFilters\(\)/);
  assert.match(source, /activeSlot=b\.dataset\.slot;offset=0;saveLibraryFilters\(\)/);
  assert.match(source, /textContent=folderPanelVisible\?'Sembunyikan folder':'Lihat folder';\s*saveLibraryFilters\(\)/);
});
