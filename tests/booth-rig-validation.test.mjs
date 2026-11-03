import test from 'node:test';
import assert from 'node:assert/strict';
import { selectBoothRig } from '../src/booth-rig.js';
const bone = (name, tag) => ({name, tag});
const own = [bone('root',1),bone('spine',2),bone('head',3)];
const skin = (indices, weights) => ({indices:Uint16Array.from(indices),weights:Float32Array.from(weights)});
test('rigging selects original skeleton when safely indexed', () => {
  const result = selectBoothRig(own, skin([1,2,0,0],[0.8,0.2,0,0]),[],{family:'male'});
  assert.equal(result.rig,own);
  assert.equal(result.indices[0],1);
});
test('rigging remaps by name instead of assuming same index', () => {
  const target = [bone('head',3),bone('root',1),bone('spine',2)];
  const result = selectBoothRig(own,skin([1,2,0,0],[0.8,0.2,0,0]),[{rig:target,label:'Target',referenceOnly:true}],{choice:'reference',family:'male'});
  assert.equal(result.warning,null);
  assert.deepEqual(Array.from(result.indices.slice(0,2)),[2,0]);
});
test('rigging refuses unverified index fallback without source rig', () => {
  const target = [bone('head',3),bone('root',1),bone('spine',2)];
  const result=selectBoothRig([],skin([1,2,0,0],[1,0,0,0]),[{rig:target,label:'Target'}],{family:'male'});
  assert.equal(result.indices,null);
  assert.match(result.warning,/skeleton asli/);
});
test('rigging rejects absent bone and invalid negative indices', () => {
  const target = [bone('root',1)];
  const result = selectBoothRig(own,skin([2,0,0,0],[1,0,0,0]),[{rig:target,label:'Bad'}],{choice:'reference'});
  assert.equal(result.indices,null);
  const negative=selectBoothRig(own,skin([-1,0,0,0],[1,0,0,0]),[],{family:'female'});
  assert.equal(negative.indices,null);
});

test('auto-skeleton provides clearly labeled approximate bind when requested', () => {
  const result = selectBoothRig([], skin([1,2,0,0],[0.8,0.2,0,0]),[],{
    family:'female',choice:'auto',allowApproximate:true
  });
  assert.ok(result.rig.length > 2);
  assert.equal(result.approximate,true);
  assert.equal(result.indices[0],1);
  assert.match(result.warning,/perkiraan/);
});
test('explicit reference mode never silently guesses bone indices', () => {
  const result = selectBoothRig([],skin([1,2,0,0],[1,0,0,0]),[],{
    family:'female',choice:'reference',allowApproximate:true
  });
  assert.equal(result.indices,null);
});

test('skeletonless custom freemode head automatically follows SKEL_Head', () => {
  const original = skin([124, 40, 8, 0], [0.5, 0.3, 0.2, 0]);
  const before = Array.from(original.indices);
  const result = selectBoothRig([], original, [], {
    family: 'male', choice: 'auto', allowApproximate: true,
    modelName: 'mp_m_freemode_01_cpxhead^head_001_u.ydd',
  });
  const headIndex = result.rig.findIndex(b => b.name === 'SKEL_Head');
  assert.ok(headIndex >= 0);
  assert.deepEqual(Array.from(result.indices.slice(0, 3)), [headIndex, headIndex, headIndex]);
  assert.deepEqual(Array.from(original.indices), before, 'original imported YDD data must remain untouched');
  assert.equal(result.approximate, true);
  assert.match(result.source, /Auto Head Skeleton/);
});
test('auto-head binding never overrides a model with a valid original rig', () => {
  const result = selectBoothRig(own, skin([2,0,0,0],[1,0,0,0]), [], {
    family: 'male', choice: 'auto', allowApproximate: true, modelName:'head_001_u.ydd',
  });
  assert.equal(result.rig, own);
  assert.equal(result.indices[0], 2);
  assert.equal(result.approximate, undefined);
});
