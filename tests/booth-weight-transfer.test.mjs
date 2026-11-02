import test from 'node:test';
import assert from 'node:assert/strict';
import { transferSkinWeights } from '../src/booth-weight-transfer.js';
const rig=[{name:'root'},{name:'head'}];
const source={
  positions:Float32Array.from([0,0,0, 0.1,0,0, 0.2,0,0]),
  skin:{
    indices:Uint16Array.from([0,1,0,0, 1,0,0,0, 1,0,0,0]),
    weights:Float32Array.from([0.25,0.75,0,0, 1,0,0,0, 1,0,0,0])
  },rig
};
test('transfers and normalizes source bone weights from aligned nearby freemode geometry',()=>{
  const result=transferSkinWeights(Float32Array.from([0.01,0,0, 0.11,0,0]),source);
  assert.ok(result);
  assert.equal(result.rig,rig);
  assert.deepEqual(Array.from(result.indices.slice(0,2)),[0,1]);
  assert.ok(Math.abs(result.weights[0]+result.weights[1]-1)<1e-6);
  assert.equal(result.indices[4],1);
});
test('does not invent weights for geometries outside reference or mismatched positions',()=>{
  assert.equal(transferSkinWeights(Float32Array.from([50,50,50]),source),null);
  assert.equal(transferSkinWeights(Float32Array.from([0,0,0, 50,50,50]),source),null);
});
test('rejects damaged source skin and impossible bone indices',()=>{
  const invalid={...source,skin:{...source.skin,indices:source.skin.indices.slice()}};
  invalid.skin.indices[0]=99;
  assert.equal(transferSkinWeights(Float32Array.from([0,0,0]),invalid),null);
  assert.equal(transferSkinWeights(Float32Array.from([NaN,0,0]),source),null);
});
test('keeps user input unchanged',()=>{
  const before=source.skin.indices.slice(),positions=source.positions.slice();
  transferSkinWeights(Float32Array.from([0,0,0]),source);
  assert.deepEqual(source.skin.indices,before);
  assert.deepEqual(source.positions,positions);
});
