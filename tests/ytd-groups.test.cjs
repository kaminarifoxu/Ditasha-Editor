'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {pairTextureGroups}=require('../electron/ytd-groups.cjs');
test('YDD collects multiple YTD texture variants while hiding matching YTD from grid',()=>{
 const files=[
  {id:'m',name:'jbib_000_u.ydd',relative:'clothes/jbib_000_u.ydd',group:'Male/unprefixed/jbib_000',category:'clothing'},
  {id:'a',name:'jbib_diff_000_a_uni.ytd',relative:'clothes/jbib_diff_000_a_uni.ytd',group:'Male/unprefixed/jbib_000',category:'clothing'},
  {id:'b',name:'jbib_diff_000_b_uni.ytd',relative:'clothes/jbib_diff_000_b_uni.ytd',group:'Male/unprefixed/jbib_000',category:'clothing'},
  {id:'orphan',name:'uppr_diff_089_a_uni.ytd',relative:'clothes/uppr_diff_089_a_uni.ytd',group:'Male/unprefixed/uppr_089',category:'clothing'},
 ];
 const result=pairTextureGroups(files);
 assert.deepEqual(result.visible.map(f=>f.id),['m','orphan']);
 assert.deepEqual(result.groups.get('m').map(t=>t.id),['a','b']);
});
test('same filename in different folder does not group',()=>{
 const files=[
  {id:'m',name:'head_000_r.ydd',relative:'a/head_000_r.ydd',group:'g',category:'clothing'},
  {id:'t',name:'head_000_r.ytd',relative:'b/head_000_r.ytd',group:'g',category:'clothing'}
 ];
 assert.equal(pairTextureGroups(files).visible.length,2);
});

test('freemode head and hair YTDs pair automatically only within matching named collection',()=>{
 const files=[
  {id:'head',name:'mp_f_freemode_01_cpxhead^head_000_u.ydd',relative:'stream/mp_f_freemode_01_cpxhead^head_000_u.ydd'},
  {id:'head-ytd',name:'mp_f_freemode_01_cpxhead^head_diff_000_a_uni.ytd',relative:'stream/mp_f_freemode_01_cpxhead^head_diff_000_a_uni.ytd'},
  {id:'hair',name:'mp_f_freemode_01_cpxhead^hair_001_u.ydd',relative:'stream/mp_f_freemode_01_cpxhead^hair_001_u.ydd'},
  {id:'hair-ytd',name:'mp_f_freemode_01_cpxhead^hair_diff_001_b_uni.ytd',relative:'stream/mp_f_freemode_01_cpxhead^hair_diff_001_b_uni.ytd'},
  {id:'other',name:'mp_f_freemode_01_other^head_diff_000_a_uni.ytd',relative:'stream/mp_f_freemode_01_other^head_diff_000_a_uni.ytd'},
  {id:'male',name:'mp_m_freemode_01_cpxhead^head_diff_000_a_uni.ytd',relative:'stream/mp_m_freemode_01_cpxhead^head_diff_000_a_uni.ytd'},
 ];
 const grouped=pairTextureGroups(files);
 assert.deepEqual(grouped.groups.get('head').map(t=>t.id),['head-ytd']);
 assert.deepEqual(grouped.groups.get('hair').map(t=>t.id),['hair-ytd']);
 assert.equal(grouped.hidden.has('other'),false);
 assert.equal(grouped.hidden.has('male'),false);
});
test('same folder and same base-name vehicle YFT/YTD pairing still works',()=>{
 const files=[
  {id:'model',name:'buffalo_hi.yft',relative:'cars/buffalo_hi.yft'},
  {id:'dict',name:'buffalo.ytd',relative:'cars/buffalo.ytd'},
 ];
 assert.deepEqual(pairTextureGroups(files).groups.get('model').map(f=>f.id),['dict']);
});
