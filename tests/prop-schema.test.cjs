'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  INPUT_FORMATS, COLLISION_MODES, validatePropRequest,
  probePropCapabilities, resolvePropInput,
} = require('../electron/creators/prop-schema.cjs');
const baseline = {
  schemaVersion: 1,
  sourceToken: '123e4567-e89b-12d3-a456-426614174000',
  outputToken: '223e4567-e89b-12d3-a456-426614174000',
  projectName: 'ditasha_chair',
  sourceName: 'chair.glb',
  edition: 'legacy',
  collision: 'box',
  drawDistance: 120,
  lodDistances: [20, 60],
};
test('M1a allows bounded Legacy GLB/FBX/OBJ and collision options', () => {
  assert.deepEqual(INPUT_FORMATS, ['glb', 'obj', 'fbx']);
  assert.deepEqual(COLLISION_MODES, ['none', 'box', 'convex', 'authored']);
  for (const sourceName of ['a.glb','b.OBJ','c.FBX']) {
    const req = validatePropRequest({ ...baseline, sourceName });
    assert.equal(req.format, sourceName.split('.').at(-1).toLowerCase());
  }
  assert.equal(validatePropRequest(baseline).drawDistance, 120);
});
test('M1a rejects invalid project settings and unsupported formats/editions', () => {
  for (const request of [
    { sourceName: 'ped.ydd' }, { sourceName: 'prop.ydr' }, { sourceName: '../chair.glb' },
    { sourceToken: '../root' }, { outputToken: 'C:\\\\secret' },
    { projectName: 'CON' }, { projectName: '../../x' },
    { edition: 'enhanced' }, { collision: 'mesh' }, { drawDistance: Infinity },
    { drawDistance: 0 }, { lodDistances: [100, 60] },
    { lodDistances: [20, 20] }, { lodDistances: [200] }, { lodDistances: [1,2,3,4,5] },
    { arbitraryCommand: 'powershell' }, { schemaVersion: 2 },
  ]) assert.throws(() => validatePropRequest({ ...baseline, ...request }));
});
test('M1a requires explicit native writer capabilities instead of guessing provider support', () => {
  assert.equal(probePropCapabilities(null).ready, false);
  assert.equal(probePropCapabilities({ drawableWriter: true, collisionWriter: true }).ready, false);
  assert.equal(probePropCapabilities({
    drawableWriter: true, collisionWriter: true, archetypeWriter: true,
    importers: ['glb','obj','fbx'],
  }).ready, true);
  assert.equal(probePropCapabilities({
    drawableWriter: true, collisionWriter: true, archetypeWriter: true,
    importers: ['glb','obj'],
  }).ready, false);
});
test('M1a resolves only approved input/output capability tokens', () => {
  const paths = new Map([
    [baseline.sourceToken, { kind: 'input', path: '/assets/chair.glb' }],
    [baseline.outputToken, { kind: 'output', path: '/exports' }],
  ]);
  const result = resolvePropInput(baseline, token => paths.get(token));
  assert.equal(result.request.format, 'glb');
  assert.throws(() => resolvePropInput(baseline, token => token === baseline.sourceToken ? { kind: 'output', path: '/assets/chair.glb' } : paths.get(token)), /scope/);
  assert.throws(() => resolvePropInput(baseline, () => null), /token/);
});
