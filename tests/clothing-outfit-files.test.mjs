import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveOutfitEntries } from '../src/clothing-outfit-files.js';
const pack={id:'pack-1',files:[
  {name:'mp_f_freemode_01^jbib_001_u.ydd',relativePath:'model',component:'jbib',drawable:1},
  {name:'mp_f_freemode_01^jbib_diff_001_a_uni.ytd',relativePath:'texture-a',component:'jbib',drawable:1,textureVariant:'a'},
  {name:'mp_f_freemode_01^jbib_diff_001_b_uni.ytd',relativePath:'texture-b',component:'jbib',drawable:1,textureVariant:'b'},
  {name:'mp_f_freemode_01^lowr_001_u.ydd',relativePath:'pants',component:'lowr',drawable:1}
]};
test('saved outfits select the chosen YTD variant from the same pack',()=>{
 const result=resolveOutfitEntries([pack],[{packId:'pack-1',relativePath:'model',component:'jbib',textureVariant:'b'}]);
 assert.deepEqual(result.map(x=>x.entry.relativePath),['model','texture-b']);
});
test('saved outfits reject deleted models or references to textures instead of YDD',()=>{
 assert.throws(()=>resolveOutfitEntries([pack],[{packId:'pack-1',relativePath:'missing'}]),/tidak ditemukan/);
 assert.throws(()=>resolveOutfitEntries([pack],[{packId:'pack-1',relativePath:'texture-a'}]),/tidak ditemukan/);
});
test('saved outfits resolve independent components without matching texture of wrong component',()=>{
 const result=resolveOutfitEntries([pack],[{packId:'pack-1',relativePath:'model'},{packId:'pack-1',relativePath:'pants'}]);
 assert.deepEqual(result.map(x=>x.entry.relativePath),['model','texture-a','texture-b','pants']);
});
