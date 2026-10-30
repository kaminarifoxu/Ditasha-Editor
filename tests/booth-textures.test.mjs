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

test('Vehicle texture import pairs high/base dictionaries without using the selected ped and leaves shared/ambiguous maps global', async () => {
  const { vehicleTextureTarget } = await import('../src/booth-textures.js');
  const ped = { id: 1, name: 'ped.ydd', kind: 'ped' },
    car = {
      id: 2,
      name: 'gs_hi.yft',
      kind: 'vehicle',
      file: { name: 'gs_hi.yft', webkitRelativePath: 'pack/gs_hi.yft' },
    },
    bike = {
      id: 3,
      name: 'bike.yft',
      kind: 'vehicle',
      file: { name: 'bike.yft', webkitRelativePath: 'other/bike.yft' },
    };
  assert.equal(vehicleTextureTarget({ name: 'gs.ytd' }, [ped, car, bike]), car);
  assert.equal(vehicleTextureTarget({ name: 'vehshare.ytd' }, [ped, car, bike]), null);
  assert.equal(
    vehicleTextureTarget({ name: 'random.ytd', webkitRelativePath: 'pack/random.ytd' }, [
      ped,
      car,
      bike,
    ]),
    car,
  );
  assert.equal(vehicleTextureTarget({ name: 'random.ytd' }, [ped, car, bike]), null);
  assert.equal(
    vehicleTextureTarget(
      { name: 'shared_parent.ytd' },
      [ped, car, bike],
      [],
      [{ child: 'gs', parent: 'shared_parent' }],
    ),
    car,
  );
});
test('Vehicle diffuse matching prefers exact maps and resolves a unique separator alias without guessing ambiguous maps', async () => {
  const { resolveModelTexture } = await import('../src/model-material.js');
  const base = { name: 'detail_base', dictionary: 'gs.ytd' },
    wheel = { name: 'wheel_diff', dictionary: 'gs.ytd' },
    exact = { name: 'Detail Base', dictionary: 'shared.ytd' };
  assert.equal(resolveModelTexture('Detail Base', [base, wheel], [], 'gs_hi.yft'), base);
  assert.equal(resolveModelTexture('wheel_diff', [base, wheel], [], 'gs.yft'), wheel);
  assert.equal(resolveModelTexture('Detail Base', [base, exact], [], 'gs.yft'), exact);
  assert.equal(
    resolveModelTexture('Detail Base', [base, { ...base, name: 'detail-base' }], [], 'gs.yft'),
    null,
  );
});

test('Vehicle parts prefer their owner maps over identically named global dictionaries and retain parent relationships', () => {
  const ownerMap = { name: 'black', dictionary: 'car.ytd', boothOwner: 4 },
    otherCar = { name: 'black', dictionary: 'other.ytd', boothOwner: 9 },
    globalMap = { name: 'black', dictionary: 'shared.ytd' },
    inherited = { name: 'detail', dictionary: 'parent.ytd' },
    ambiguous = { name: 'detail', dictionary: 'unrelated.ytd' };
  assert.equal(
    resolveBoothTexture('black', [ownerMap, otherCar, globalMap], [], 5, 4, 'car_spoiler.yft'),
    ownerMap,
  );
  assert.equal(
    resolveBoothTexture('detail', [inherited, ambiguous], [], 5, 4, 'car_spoiler.yft', [
      { child: 'car_spoiler', parent: 'parent' },
    ]),
    inherited,
  );
});
