import test from 'node:test';
import assert from 'node:assert/strict';
import { indexYtd, readYtd } from '../src/resource.js';
import { performResourceJob } from '../src/resource-jobs.js';
import { resolveModelTexture } from '../src/model-material.js';
import { hashName, createYtd } from '../src/asset-tools.js';
import { loadVehicleTextures, mergeVehicleTextures } from '../src/vehicle-textures.js';
import { indexTextureFiles, planTextureSearch, loadSearchTextures } from '../src/texture-search.js';
import { keyedVehicleDictionary } from './fixtures/vehicle-dictionary.mjs';
import { largeYtdFixture } from './fixtures/large-ytd.mjs';
import { MAX_DECODED_TEXTURE_BYTES, MAX_YTD_INPUT_BYTES } from '../src/texture-memory.js';

const file = (name, buffer) => ({
  name,
  size: buffer.byteLength,
  arrayBuffer: async () => buffer.slice(0),
});
const decode = async (...args) => performResourceJob(...args);
test('Adding shared YTD preserves model-owned maps with identical names and refreshes only its own dictionary', async () => {
  const dictionary = (color) =>
    createYtd([{ name: 'black', w: 1, h: 1, out: new Uint8Array(color) }]).buffer;
  const own = file('car.ytd', dictionary([15, 15, 15, 255]));
  const shared = file('vehshare.ytd', dictionary([180, 180, 180, 255]));
  const result = await loadVehicleTextures([own, shared], ['black'], { decode });
  assert.equal(result.textures.length, 2);
  assert.deepEqual(
    [...resolveModelTexture('black', result.textures, [], 'car.yft').out],
    [15, 15, 15, 255],
  );
  const update = await loadVehicleTextures(
    [file('vehshare.ytd', dictionary([200, 200, 200, 255]))],
    ['black'],
    { decode, existing: result.textures },
  );
  const merged = mergeVehicleTextures(result.textures, update.textures);
  assert.equal(merged.length, 2);
  assert.equal(resolveModelTexture('black', merged, [], 'car_hi.yft').out[0], 15);
  assert.equal(merged.find((t) => t.dictionary === 'vehshare.ytd').out[0], 200);
  assert.deepEqual(mergeVehicleTextures(merged, []), merged);
});
test('Dictionary lookup keys resolve renamed labels and a broken entry does not discard readable vehicle maps', async () => {
  const buffer = keyedVehicleDictionary(),
    snapshot = new Uint8Array(buffer).slice();
  assert.throws(() => readYtd(buffer), /format|Format/);
  const metadata = indexYtd(buffer),
    body = metadata.find((t) => t.name === 'editor_body_label');
  assert.equal(body.nameHash, hashName('cloth_diffuse'));
  const result = await loadVehicleTextures(
    [file('bike.ytd', buffer)],
    ['cloth_diffuse', 'vehicle_sign_1'],
    { decode },
  );
  assert.equal(result.textures.length, 2);
  assert.match(result.warnings.join(' '), /broken_unused/);
  const resolved = resolveModelTexture('cloth_diffuse', result.textures, [], 'bike_hi.yft');
  assert.equal(resolved.name, 'editor_body_label');
  assert.deepEqual([...resolved.out], [0, 255, 0, 255]);
  assert.equal(
    resolveModelTexture(
      'hash_' + hashName('cloth_diffuse').toString(16).padStart(8, '0'),
      result.textures,
      [],
      'bike.yft',
    ),
    resolved,
  );
  assert.deepEqual(new Uint8Array(buffer), snapshot);
});

test('Automatic folder search uses dictionary lookup keys as well as visible labels', async () => {
  const library = await indexTextureFiles([file('different.ytd', keyedVehicleDictionary())], {
    decode,
  });
  const plan = planTextureSearch([{ name: 'cloth_diffuse', source: 'bike.yft' }], library.entries);
  assert.equal(plan.selected[0].name, 'editor_body_label');
  const result = await loadSearchTextures(plan.selected, { decode });
  assert.equal(result.textures.length, 1);
  assert.equal(result.errors.length, 0, 'Unselected corrupt maps must not be decoded');
});

test('Larger-than-budget YTD falls back to referenced maps at source resolution instead of rejecting the whole dictionary', async () => {
  assert.equal(MAX_DECODED_TEXTURE_BYTES, 1024 * 1024 ** 2);
  assert.equal(MAX_YTD_INPUT_BYTES, 256 * 1024 ** 2);
  const buffer = largeYtdFixture(17); // 1088 MB decoded, above the new 1 GB budget.
  const result = await loadVehicleTextures([file('large.ytd', buffer)], ['vehicle_diff_0'], {
    decode,
  });
  assert.equal(result.textures.length, 1);
  assert.equal(result.textures[0].w, 4096);
  assert.equal(result.textures[0].out.length, 64 * 1024 ** 2);
  assert.match(result.warnings.join(' '), /1\/17/);
});
