import test from 'node:test';
import assert from 'node:assert/strict';
import {
  vehicleModManifest,
  groupBoothVehicles,
  vehiclePreviewIndices,
} from '../src/booth-vehicles.js';
import { actorForAsset, createActorMotion } from '../src/booth-actors.js';
import { validateBoothScene } from '../src/booth-library.js';
const cols =
  '<CVehicleModelInfoVarGlobal><Kits><Item><kitName>test_kit</kitName><visibleMods><Item><modelName>bike_seat_a</modelName><bone>chassis</bone><type>VMT_CHASSIS</type><turnOffBones><Item>seat</Item></turnOffBones></Item></visibleMods></Item></Kits></CVehicleModelInfoVarGlobal>';
const vars =
  '<CVehicleModelInfoVariation><variationData><Item><modelName>bike</modelName><kits><Item>test_kit</Item></kits></Item></variationData></CVehicleModelInfoVariation>';
const sources = () =>
  ['bike_hi.yft', 'bike_seat_a.yft', 'bike.yft', 'other.yft'].map((name, i) => ({
    id: i + 1,
    name,
    kind: 'vehicle',
    visible: true,
    owner: null,
    category: 'vehicle',
    offset: [0, 0, 0],
  }));
test('Vehicle metadata binds explicit kit parts, pairs HI alternatives and keeps other cars independent', () => {
  const m = vehicleModManifest([cols, vars, cols, vars]);
  assert.equal(m.length, 1);
  const a = sources();
  groupBoothVehicles(a, [], m);
  assert.equal(a[0].kind, 'vehicle-part');
  assert.equal(a[0].owner, a[2].id);
  assert.equal(a[0].visible, false);
  assert.equal(a[1].owner, a[2].id);
  assert.equal(a[1].visible, true);
  assert.deepEqual(a[1].vehicleOffBones, ['seat']);
  assert.equal(actorForAsset(a, a[1]), a[2]);
  assert.equal(a[3].kind, 'vehicle');
  assert.equal(a[3].offset[0], 1.5);
  const unknown = sources();
  groupBoothVehicles(unknown, [], []);
  assert.equal(unknown[1].kind, 'vehicle');
  assert.throws(() => vehicleModManifest(['<!DOCTYPE x><x/>']), /Metadata/);
});
test('Vehicle stock masking removes only fully weighted replacement faces without mutating native indices', () => {
  const g = {
    indices: new Uint16Array([0, 1, 2, 1, 2, 3]),
    skin: { indices: new Uint16Array(16), weights: new Float32Array(16) },
  };
  for (let i = 0; i < 4; i++) g.skin.weights[i * 4] = 1;
  g.skin.indices[12] = 1;
  const out = vehiclePreviewIndices(g, [{ name: 'seat' }, { name: 'wheel' }], new Set(['seat']));
  assert.deepEqual([...out], [1, 2, 3]);
  assert.equal(g.indices.length, 6);
  assert.equal(vehiclePreviewIndices(g, [], new Set(['seat'])), g.indices);
});
test('Vehicle part ownership and source metadata survive preset validation', () => {
  const a = sources();
  groupBoothVehicles(a, [], vehicleModManifest([cols, vars]));
  const s = {
    version: 1,
    textureFiles: [],
    clipFiles: [],
    assets: a.map((x, i) => ({
      ...x,
      file: Object.assign(new Blob(['fixture']), { name: x.name }),
      oldId: x.id,
      ownerIndex: x.owner === null ? null : a.findIndex((b) => b.id === x.owner),
      yaw: 0,
      scale: 1,
      motion: createActorMotion(),
      hiddenSlots: [],
    })),
  };
  assert.equal(validateBoothScene(s), s);
  s.assets[1].ownerIndex = 0;
  assert.throws(() => validateBoothScene(s), /Pemilik/);
});

test('Vehicle resource placement leaves room for existing peds rather than overlapping them', () => {
  const a = sources();
  groupBoothVehicles(
    a,
    [{ id: 99, name: 'ped.glb', kind: 'ped' }],
    vehicleModManifest([cols, vars]),
  );
  assert.equal(a[2].offset[0], 1.5);
  assert.equal(a[3].offset[0], 3);
  assert.deepEqual(a[1].offset, [0, 0, 0]);
});
