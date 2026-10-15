const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { FileMatcher } = require('app-builder-lib/out/fileMatcher');
const config = require('../package.json').build;
test('IDE resource mappings include dependency files that the main runtime mapping skips', () => {
  const identity = (v) => v;
  const root = path.resolve('ide-runtime');
  const mappings = config.extraResources.map(
    (s) => new FileMatcher(path.resolve(s.from), path.resolve('target', s.to), identity, s.filter),
  );
  const dependency = path.join(root, 'node_modules/cookie');
  const stat = { isDirectory: () => true };
  const rootMatch = mappings.find((m) => m.from === root);
  assert.equal(rootMatch.createFilter()(path.join(root, 'node_modules'), stat), false);
  const dependencyMatch = mappings.find((m) => m.from === path.join(root, 'node_modules'));
  assert(dependencyMatch, 'Runtime needs an explicit node_modules resource mapping.');
  assert.equal(dependencyMatch.createFilter()(dependency, stat), true);
  assert.equal(
    dependencyMatch.createFilter()(path.join(dependency, 'index.js'), { isDirectory: () => false }),
    true,
  );
});
