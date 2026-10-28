import test from 'node:test';
import assert from 'node:assert/strict';
import {
  outfitCategory,
  outfitLabel,
  boothVertexCount,
  MAX_BOOTH_MODELS,
} from '../src/booth-outfits.js';
import { validateBoothScene } from '../src/booth-library.js';
import { createActorMotion } from '../src/booth-actors.js';
test('GTA outfit slots, random-name overrides and ped bodies classify without changing files', () => {
  for (const [slot, expected] of [
    ['jbib', 'tops'],
    ['lowr', 'pants'],
    ['hand', 'bags'],
    ['task', 'vest'],
    ['feet', 'shoes'],
    ['teef', 'undershirt'],
    ['p_head', 'hat'],
    ['p_eyes', 'glasses'],
  ])
    assert.equal(outfitCategory('author^' + slot + '_009_u.ydd'), expected);
  assert.equal(outfitCategory('random134.glb', 'vest'), 'vest');
  assert.equal(outfitCategory('random134.glb'), 'other');
  assert.equal(outfitCategory('lowr_000_u.ydd', 'auto', 'ped'), 'ped');
  assert.equal(outfitLabel('bags'), 'Tas / backpack');
  assert.throws(() => outfitCategory('anything', 'invalid'), /tidak valid/);
  assert.equal(
    boothVertexCount({ drawables: [{ geometries: [{ positions: new Float32Array(12) }] }] }),
    4,
  );
});
test('Library supports 100-model category presets and rejects the 101st model or corrupt categories', () => {
  const file = Object.assign(new Blob(['small']), { name: 'item.ydd' });
  const assets = Array.from({ length: MAX_BOOTH_MODELS }, (_, i) => ({
    file,
    kind: 'clothing',
    category: 'shoes',
    oldId: i + 1,
    ownerIndex: null,
    offset: [0, 0, 0],
    scale: 1,
    yaw: 0,
    motion: createActorMotion(),
    hiddenSlots: [],
  }));
  const record = { version: 1, assets, textureFiles: [], clipFiles: [] };
  assert.equal(validateBoothScene(record), record);
  assets.push({ ...assets[0], oldId: 101 });
  assert.throws(() => validateBoothScene(record), /tidak valid/);
  assets.pop();
  assets[0].category = 'broken';
  assert.throws(() => validateBoothScene(record), /Kategori/);
});
