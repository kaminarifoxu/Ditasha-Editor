'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
test('model-only filter accepts genuine GTA model extensions',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../electron/file-manager.cjs'),'utf8');
 assert.ok(source.includes(String.raw`/\.(ydd|ydr|yft)$/i.test(f.name)`));
 assert.ok(!source.includes(String.raw`/\\.(ydd|ydr|yft)$/i.test(f.name)`));
 for(const name of ['mp_f_freemode_01^uppr_003_r.ydd','jacket.YDD','car.yft','prop.ydr'])
   assert.match(name,/\.(ydd|ydr|yft)$/i);
 assert.doesNotMatch('jbib_diff_003_a_uni.ytd',/\.(ydd|ydr|yft)$/i);
});
