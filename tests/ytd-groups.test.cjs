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
