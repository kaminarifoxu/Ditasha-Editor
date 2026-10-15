import test from 'node:test';
import assert from 'node:assert/strict';
import { companionTextures } from '../src/explorer-textures.js';
import { resolveModelTexture } from '../src/model-material.js';
import { hashName } from '../src/asset-tools.js';
test('Explorer finds differently named sibling YTDs without unbounded or encrypted extraction', () => {
  const entries = [
    { name: 'ped/other.ytd', size: 20 },
    { name: 'ped/model.ytd', size: 30 },
    { name: 'ped/secret.ytd', size: 10, encrypted: true },
    { name: 'ped/huge.ytd', size: 70 * 1024 * 1024 },
    { name: 'elsewhere/unrelated.ytd', size: 20 },
  ];
  assert.deepEqual(
    companionTextures('ped/model.ydd', entries).map((e) => e.name),
    ['ped/model.ytd', 'ped/other.ytd'],
  );
  assert.deepEqual(
    companionTextures('ped/model.ydd', entries, 'ped/other.ytd').map((e) => e.name),
    ['ped/other.ytd'],
  );
  const many = Array.from({ length: 20 }, (_, i) => ({
    name: `ped/${i}.ytd`,
    size: 20 * 1024 * 1024,
  }));
  assert(
    companionTextures('ped/model.ydd', many).reduce((n, e) => n + e.size, 0) <= 96 * 1024 * 1024,
  );
});
test('Texture references normalize folders/extensions and resolve hashed names', () => {
  const texture = { name: 'ped_default_Base_color', dictionary: 'different.ytd' };
  assert.equal(
    resolveModelTexture('textures/ped_default_Base_color.dds', [texture], [], 'ped.ydd'),
    texture,
  );
  assert.equal(
    resolveModelTexture(
      'hash_' + hashName(texture.name.toLowerCase()).toString(16).padStart(8, '0'),
      [texture],
      [],
      'ped.ydd',
    ),
    texture,
  );
});
