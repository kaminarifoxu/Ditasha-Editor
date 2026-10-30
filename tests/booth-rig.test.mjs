import test from 'node:test';
import assert from 'node:assert/strict';
import { selectBoothRig, freemodeFamily } from '../src/booth-rig.js';
import { boothHeight, setBoothHeight, setBoothElevation } from '../src/booth-transform.js';
const matrix = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const skin = (i) => ({
  indices: new Uint16Array([i, 0, 0, 0]),
  weights: new Float32Array([1, 0, 0, 0]),
});
test('Freemode geometry missing its skeleton receives a complete reference, while unsupported custom indices stay diagnosed', () => {
  const original = skin(124),
    before = original.indices.slice(),
    result = selectBoothRig([], original, [], {
      family: freemodeFamily('mp_m_freemode_01^head_002_r.ydd'),
    });
  assert.equal(result.rig.length, 128);
  assert.equal(result.indices[0], 124);
  assert.deepEqual(original.indices, before);
  assert.ok(result.rig.some((b) => b.name === 'SKEL_Head'));
  assert.equal(selectBoothRig([], skin(900), [], { family: 'male' }).rig.length, 0);
  assert.ok(selectBoothRig([], skin(900), [], { family: 'male' }).warning.includes('901'));
  assert.equal(selectBoothRig([], skin(124), [], {}).rig.length, 0);
});
test('Skeleton reference mapping matches bone identity without mutating native palette indices', () => {
  const own = [{ name: 'SKEL_Head', tag: 31086, parent: -1, matrix }],
    full = [
      { name: 'SKEL_Root', tag: 0, parent: -1, matrix },
      { name: 'SKEL_Head', tag: 31086, parent: 0, matrix },
    ];
  const original = skin(0),
    result = selectBoothRig(own, original, [{ rig: full, referenceOnly: true }], {
      choice: 'reference',
    });
  assert.equal(result.indices[0], 1);
  assert.equal(original.indices[0], 0);
  const partial = selectBoothRig(own, skin(1), [{ rig: full, referenceOnly: true }], {});
  assert.equal(partial.rig.length, 2);
});
test('Height and elevation edit actor transforms explicitly; source meshes and other actors are unchanged', () => {
  assert.equal(boothHeight([0, -0.8, 0, 0, 1, 0]), 1.8);
  const a = { baseHeight: 1.8, scale: 1, offset: [0, 0, 0] },
    b = { baseHeight: 1.7, scale: 1, offset: [1.5, 0, 0] };
  setBoothHeight(a, 144);
  assert.equal(a.scale, 0.8);
  assert.equal(a.targetHeightCm, 144);
  setBoothElevation(a, 25);
  assert.equal(a.offset[1], 0.25);
  assert.equal(b.scale, 1);
  assert.equal(b.offset[1], 0);
  assert.throws(() => setBoothHeight(a, 0), /Tinggi/);
  assert.throws(() => setBoothElevation(a, Infinity), /turun/);
});
