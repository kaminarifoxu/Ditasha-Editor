import test from 'node:test';
import assert from 'node:assert/strict';
import {makeMorphTarget} from '../src/freemode-morph-generator.js';
import {applyMorphPack} from '../src/freemode-morph-pack.js';
const neutral={name:'head',positions:Float32Array.from([0,0,0,1,0,0,0,1,0]),indices:Uint16Array.from([0,1,2])};
test('generator creates morph deltas that Photo Booth can consume',()=>{
 const sculpt={name:'head',positions:Float32Array.from([0.2,0,0,1,0,0,0,1,0]),indices:Uint16Array.from([0,1,2])};
 const pack=makeMorphTarget(neutral,sculpt,'feature:0');
 const output=applyMorphPack(neutral.positions,pack,{features:[1]},neutral.indices);
 assert.ok(Math.abs(output[0]-0.2)<1e-6);
 assert.equal(output[3],1);
 assert.equal(neutral.positions[0],0);
 assert.throws(()=>applyMorphPack(neutral.positions,pack,{features:[1]},Uint16Array.from([0,2,1])),/triangle topology/);
});
test('generator rejects changed vertex topology and unchanged head',()=>{
 const changed={name:'head',positions:Float32Array.from(neutral.positions),indices:Uint16Array.from([0,2,1])};
 assert.throws(()=>makeMorphTarget(neutral,changed,'feature:0'),/topologi/);
 assert.throws(()=>makeMorphTarget(neutral,neutral,'feature:0'),/perubahan/);
});
