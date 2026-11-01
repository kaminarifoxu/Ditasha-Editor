import test from 'node:test';
import assert from 'node:assert/strict';
import {validateMorphPack,applyMorphPack} from '../src/freemode-morph-pack.js';
test('morph pack blends exact vertex deltas for face and parents',()=>{
 const base=Float32Array.from([0,0,0,1,0,0,0,1,0]);
 const delta=(x)=>Array.from({length:9},(_,i)=>i%3===0?x:0);
 const pack={version:1,vertexCount:3,targets:[
  {key:'feature:0',deltas:delta(.5)},
  {key:'parent:first',deltas:delta(.2)},
  {key:'parent:second',deltas:delta(-.2)}
 ]};
 const result=applyMorphPack(base,pack,{features:[1],shapeMix:.5});
 assert.equal(result[0],.5);assert.equal(result[3],1.5);
 assert.deepEqual(Array.from(base),[0,0,0,1,0,0,0,1,0]);
 const first=applyMorphPack(base,pack,{features:[0],shapeMix:0});
 assert.ok(Math.abs(first[0]-.2)<1e-6);
});
test('morph pack rejects topology mismatch, invalid channels and nonfinite deltas',()=>{
 assert.throws(()=>validateMorphPack({version:1,vertexCount:99,targets:[]},3),/topology/);
 assert.throws(()=>validateMorphPack({version:1,vertexCount:3,targets:[{key:'feature:20',deltas:Array(9).fill(0)}]},3),/Unsupported/);
 assert.throws(()=>validateMorphPack({version:1,vertexCount:3,targets:[{key:'feature:0',deltas:[Infinity,...Array(8).fill(0)]}]},3),/Invalid morph delta/);
});
