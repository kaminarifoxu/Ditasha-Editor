import test from 'node:test';
import assert from 'node:assert/strict';
import { Resource, readYft } from '../src/resource.js';
import { analyzeDebadge } from '../src/vehicle-debadge.js';
import { viewerModel } from './viewer-format.test.mjs';
import { wheelYftFixture } from './fixtures/wheel-yft.mjs';

test('Complete vehicle includes six wheel instances, placeholder donors and separate damaged choices', () => {
  const input = wheelYftFixture(viewerModel),
    before = new Uint8Array(input).slice();
  const ds = readYft(input),
    full = ds[0];
  assert.equal(full.assembledVehicle, true);
  assert.equal(full.geometries.length, 14);
  const pristine = ds.filter((d) => d.fragmentState === 'Pristine');
  assert.equal(pristine.length, 6);
  assert.equal(ds.filter((d) => d.fragmentState === 'Damaged').length, 1);
  assert.deepEqual([...pristine[0].geometries[0].positions.slice(0, 3)], [-1.75, 0.75, -3.5]);
  assert.deepEqual(
    [...pristine[1].geometries[0].positions.slice(0, 6)],
    [2.25, 0.75, -3.5, 1.25, 0.75, -3.5],
  );
  assert.deepEqual([...pristine[3].geometries[0].positions.slice(0, 3)], [2.25, 0.75, 2.5]);
  assert.equal(pristine[4].sourceDrawable, pristine[0].sourceDrawable);
  assert.notDeepEqual(pristine[4].geometries[0].positions, pristine[0].geometries[0].positions);
  assert.equal(new Set(full.geometries.map((g) => g.part)).size, 14);
  assert.ok(full.geometries.every((g) => g.diffuseTexture === 'cloth_diffuse'));
  assert.deepEqual(new Uint8Array(input), before, 'Preview must not rewrite the native resource');
  const selectable = analyzeDebadge(input)[0];
  assert.notDeepEqual(
    selectable.geometries[2].parts[0].min,
    selectable.geometries[4].parts[0].min,
    'Shared geometry instances need placement-specific selection bounds',
  );
});

test('Fragment default pose takes precedence over local bind translations', () => {
  const full = readYft(wheelYftFixture(viewerModel, { pose: true }))[0];
  assert.equal(full.geometries[0].positions[0], 4);
  assert.notEqual(full.geometries[0].positions[0], 99);
});
