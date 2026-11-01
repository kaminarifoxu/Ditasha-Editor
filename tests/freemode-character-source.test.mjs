import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveCharacterBodyEntries } from '../src/freemode-character-source.js';
const pack={id:'p',files:[
 {relativePath:'head',name:'head_000_r.ydd',component:'head',drawable:0,gender:'female'},
 {relativePath:'head-tex',name:'head_diff_000_a_uni.ytd',component:'head',drawable:0,textureVariant:'a',gender:'female'},
 {relativePath:'shirt',name:'uppr_000_u.ydd',component:'uppr',drawable:0,gender:'female'},
 {relativePath:'arms',name:'hand_000_u.ydd',component:'hand',drawable:0,gender:'female'},
 {relativePath:'pants',name:'lowr_000_u.ydd',component:'lowr',drawable:0,gender:'female'},
 {relativePath:'shoes',name:'feet_000_u.ydd',component:'feet',drawable:0,gender:'female'},
 {relativePath:'male',name:'head_000_r.ydd',component:'head',drawable:0,gender:'male'}
]};
test('complete freemode starter actor uses head, upper body, hands, pants and feet',()=>{
 const records=resolveCharacterBodyEntries([pack],{packId:'p',relativePath:'head'},'female');
 assert.deepEqual(records.map(r=>r.entry.relativePath),['head','head-tex','shirt','arms','pants','shoes']);
});
test('freemode body rejects mixed gender and missing base model',()=>{
 assert.throws(()=>resolveCharacterBodyEntries([pack],{packId:'p',relativePath:'male'},'female'),/gender/);
 assert.throws(()=>resolveCharacterBodyEntries([pack],{packId:'p',relativePath:'missing'},'female'),/tidak ditemukan/);
});
