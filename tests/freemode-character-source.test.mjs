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

test('starter head cannot borrow a same-slot male or addon-collection YTD',()=>{
 const original={relativePath:'head-f',name:'mp_f_freemode_01_mp_f_a^head_000_r.ydd',component:'head',drawable:0,gender:'female'};
 const right={relativePath:'right',name:'mp_f_freemode_01_mp_f_a^head_diff_000_a_uni.ytd',component:'head',drawable:0,gender:'female',textureVariant:'a'};
 const other={relativePath:'other',name:'mp_f_freemode_01_mp_f_b^head_diff_000_a_uni.ytd',component:'head',drawable:0,gender:'female',textureVariant:'a'};
 const male={relativePath:'male-tex',name:'mp_m_freemode_01_mp_m_a^head_diff_000_a_uni.ytd',component:'head',drawable:0,gender:'male',textureVariant:'a'};
 const p={id:'p2',files:[original,other,male,right]};
 assert.deepEqual(resolveCharacterBodyEntries([p],{packId:'p2',relativePath:'head-f'},'female').map(x=>x.entry.relativePath),['head-f','right']);
});

test('starter freemode components favor original head collection over unrelated addon collection', () => {
 const original={relativePath:'head-custom',name:'mp_f_freemode_01_mp_f_ourpack^head_000_r.ydd',component:'head',drawable:0,gender:'female'};
 const wrong={relativePath:'wrong-body',name:'mp_f_freemode_01_mp_f_other^uppr_000_u.ydd',component:'uppr',drawable:0,gender:'female'};
 const correct={relativePath:'our-body',name:'mp_f_freemode_01_mp_f_ourpack^uppr_001_u.ydd',component:'uppr',drawable:1,gender:'female'};
 const pack={id:'p3',files:[original,wrong,correct]};
 assert.deepEqual(resolveCharacterBodyEntries([pack],{packId:'p3',relativePath:original.relativePath},'female')
   .map(r=>r.entry.relativePath),['head-custom','our-body']);
});
test('starter freemode falls back to vanilla body, not unrelated addon when source collection lacks one', () => {
 const original={relativePath:'head-custom',name:'mp_m_freemode_01_mp_m_pack^head_000_r.ydd',component:'head',drawable:0,gender:'male'};
 const unrelated={relativePath:'wrong',name:'mp_m_freemode_01_mp_m_other^lowr_000_u.ydd',component:'lowr',drawable:0,gender:'male'};
 const vanilla={relativePath:'vanilla',name:'mp_m_freemode_01^lowr_000_u.ydd',component:'lowr',drawable:0,gender:'male'};
 const pack={id:'p4',files:[original,unrelated,vanilla]};
 assert.deepEqual(resolveCharacterBodyEntries([pack],{packId:'p4',relativePath:'head-custom'},'male')
   .map(r=>r.entry.relativePath),['head-custom','vanilla']);
});
