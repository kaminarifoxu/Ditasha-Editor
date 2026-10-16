'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const specs = require('../config/craft-engines.json');
const { enginePath } = require('../electron/craft-paths.cjs');
test('Pinned creative engines have unique IDs, exact releases and checksums', () => {
  assert.equal(specs.length, 9);
  assert.equal(new Set(specs.map((s) => s.id)).size, 9);
  for (const s of specs) {
    assert.match(s.sha256, /^[a-f0-9]{64}$/);
    assert.match(s.version, /^v\d+\.\d+\.\d+$/);
    assert.equal(new URL(s.url).hostname, 'github.com');
    assert.ok(
      s.url.startsWith(`https://github.com/storytold/${s.id}/releases/download/${s.version}/`),
    );
    assert.ok(s.bytes > 1e6 && s.bytes < 100e6);
  }
});
test('Engine resources are confined to the selected packaged workspace', () => {
  const root = path.resolve('craft-runtime');
  assert.equal(
    enginePath(root, 'ditasha-craft://photocraft/index.html').file,
    path.join(root, 'photocraft', 'index.html'),
  );
  assert.equal(
    enginePath(root, 'ditasha-craft://photocraft/a.js?v=1').file,
    path.join(root, 'photocraft', 'a.js'),
  );
  for (const url of [
    'https://photocraft/index.html',
    'ditasha-craft://unknown/index.html',
    'ditasha-craft://photocraft/%2f..%2fsecret',
    'ditasha-craft://photocraft/a%5cb',
    'ditasha-craft://photocraft/%00',
    'ditasha-craft://photocraft/c%3asecret',
  ])
    assert.throws(() => enginePath(root, url));
});
