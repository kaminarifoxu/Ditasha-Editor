import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveBoothTexture, replaceBoothTextureScope } from '../src/booth-textures.js';
test('Local ped YTD replacement wins over a shared dictionary regardless of its filename and stays isolated from other peds', () => {
  const shared = { name: 'skin', dictionary: 'head.ytd', boothOwner: 1 },
    local = { name: 'skin', dictionary: 'random-new.ytd', boothOwner: 2 },
    other = { name: 'skin', dictionary: 'head.ytd', boothOwner: 3 };
  assert.equal(resolveBoothTexture('skin', [shared, other, local], [], 2, 1, 'head.ydd'), local);
  assert.equal(resolveBoothTexture('skin', [shared, other, local], [], 3, 3, 'head.ydd'), other);
  assert.equal(resolveBoothTexture('skin', [shared, other, local], [], 4, 1, 'head.ydd'), shared);
});
test('YTD replacement atomically replaces one model source and leaves other owners and failed inputs untouched', () => {
  const old = { name: 'old.ytd' },
    other = { name: 'old.ytd' },
    fresh = { name: 'fresh.ytd' },
    tex = { name: 'skin', boothOwner: 1 },
    untouched = { name: 'skin', boothOwner: 2 };
  const state = { textures: [tex, untouched], textureFiles: [old, other], textureOwners: [1, 2] };
  assert.throws(() => replaceBoothTextureScope(state, 1, fresh, []), /tidak berisi/);
  assert.equal(state.textures[0], tex);
  const next = replaceBoothTextureScope(state, 1, fresh, [{ name: 'skin' }]);
  assert.deepEqual(next.textureFiles, [other, fresh]);
  assert.deepEqual(next.textureOwners, [2, 1]);
  assert.equal(next.textures[0], untouched);
  assert.equal(next.textures[1].boothOwner, 1);
  assert.deepEqual(state.textureFiles, [old, other]);
});
