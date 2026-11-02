import test from 'node:test';
import assert from 'node:assert/strict';
import { selectBoothRig, validateBoothSkeleton } from '../src/booth-rig.js';
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

test('rigging rejects non-finite or negative skin weights before binding', () => {
  const invalid = selectBoothRig(own,skin([1,2,0,0],[NaN,0.2,0,0]),[],{family:'male'});
  assert.equal(invalid.indices,null);
  assert.match(invalid.warning,/tidak valid/);
  const negative = selectBoothRig(own,skin([1,2,0,0],[-0.3,0.2,0,0]),[],{family:'male'});
  assert.equal(negative.rig.length,0);
});

test('invalid bone parent cycles and nonfinite bind matrices are rejected', () => {
  const matrix = [1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
  assert.match(validateBoothSkeleton([{name:'a',parent:1,matrix},{name:'b',parent:0,matrix}]), /siklus/);
  assert.match(validateBoothSkeleton([{name:'bad',parent:-1,matrix:[...matrix.slice(0,15),NaN]}]), /Transform/);
  assert.equal(validateBoothSkeleton([{name:'root',parent:-1,matrix}]),null);
});
