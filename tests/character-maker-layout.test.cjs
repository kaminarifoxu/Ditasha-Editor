'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'..','src','character-maker-ui.js'),'utf8');
test('Character Maker advanced panel closes before viewport but not the main layout',()=>{
 assert.ok(source.includes('</div></details><div data-preview'));
 assert.ok(!source.includes('</div></div></details><div data-preview'));
 const open=source.indexOf('<details class="cm-advanced">');
 const close=source.indexOf('</details>',open);
 const preview=source.indexOf('<div data-preview',close);
 const slider=source.indexOf('<div class="cm-sliders"',preview);
 assert.ok(open>=0&&close>open&&preview>close&&slider>preview);
});
