import test from 'node:test';
import assert from 'node:assert/strict';
import { parseTextureParents } from '../src/texture-parents.js';
import { textureParentChain, resolveModelTexture } from '../src/model-material.js';
import { indexTextureFiles, planTextureSearch } from '../src/texture-search.js';
const xml =
  '<CVehicleModelInfo__InitDataList><txdRelationships><Item><parent>shared</parent><child>car</child></Item><item><parent>base</parent><child>shared</child></item></txdRelationships></CVehicleModelInfo__InitDataList>';
test('Selected vehicles metadata resolves nearest parent maps without guessing ambiguous unrelated sources', async () => {
  const file = {
    name: 'vehicles.meta',
    size: xml.length,
    arrayBuffer: async () => new TextEncoder().encode(xml).buffer,
  };
  const library = await indexTextureFiles([file], {
    decode: () => {
      throw Error('XML must not go to resource decoder');
    },
  });
  assert.equal(library.parents.length, 2);
  assert.equal(library.errors.length, 0);
  assert.deepEqual(textureParentChain('car_hi.yft', library.parents), ['shared', 'base']);
  const near = { name: 'black', dictionary: 'shared.ytd' },
    far = { name: 'black', dictionary: 'base.ytd' },
    other = { name: 'black', dictionary: 'wrong.ytd' };
  const entries = [other, far, near];
  assert.equal(resolveModelTexture('black', entries, [], 'car.yft'), null);
  assert.equal(resolveModelTexture('black', entries, [], 'car.yft', library.parents), near);
  assert.deepEqual(
    planTextureSearch([{ name: 'black', source: 'car.yft' }], entries, library.parents).selected,
    [near],
  );
  assert.equal(resolveModelTexture('black', [other, far], [], 'car.yft', library.parents), far);
});
test('Metadata parent cycles/conflicts are bounded, entity input rejected, commented relationships ignored', () => {
  assert.deepEqual(
    textureParentChain('car', [
      { child: 'car', parent: 'shared' },
      { child: 'shared', parent: 'car' },
    ]),
    ['shared'],
  );
  assert.deepEqual(
    textureParentChain('car', [
      { child: 'car', parent: 'a' },
      { child: 'car', parent: 'b' },
    ]),
    [],
  );
  assert.throws(() => parseTextureParents('<!DOCTYPE a SYSTEM "file:///private">' + xml), /entity/);
  assert.deepEqual(
    parseTextureParents(
      xml.replace('<Item>', '<!-- <Item><parent>bad</parent><child>car</child></Item> --><Item>'),
    ),
    parseTextureParents(xml),
  );
});
