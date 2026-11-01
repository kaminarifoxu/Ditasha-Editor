import test from 'node:test';
import assert from 'node:assert/strict';
import { deformFacePositions } from '../src/offline-face-deform.js';
const coords=[];
for(let z=0;z<5;z++)for(let y=0;y<5;y++)for(let x=0;x<5;x++)coords.push((x/4),y/4,z/4);
test('neutral input preserves the source mesh exactly and does not mutate it',()=>{
 const source=Float32Array.from(coords);
 const result=deformFacePositions(source,new Array(20).fill(0),.5);
 assert.deepEqual(result,source);
 assert.notStrictEqual(result,source);
});
test('nose, jaw and lips sliders deform vertices smoothly without changing source',()=>{
 const original=Float32Array.from(coords);
 const features=new Array(20).fill(0);
 features[0]=1; features[2]=1; features[12]=1; features[13]=1;
 const result=deformFacePositions(original,features,.5);
 assert.equal(original.every((value,i)=>value===coords[i]),true);
 assert.ok(result.some((v,i)=>v!==original[i]));
 assert.ok(result.every(Number.isFinite));
 assert.equal(result.length,original.length);
});
test('refuses invalid and degenerate mesh geometry',()=>{
 assert.equal(deformFacePositions(new Float32Array([0,0,0]),[],.5),null);
 assert.equal(deformFacePositions(new Float32Array(9),[],.5),null);
 assert.equal(deformFacePositions(new Float32Array([0,0,0,1,1,1,NaN,1,1]),[],.5),null);
});
