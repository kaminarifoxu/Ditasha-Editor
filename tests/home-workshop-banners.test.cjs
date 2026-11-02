'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
test('all thirteen legacy workshop destinations remain wired to illustrated cards',()=>{
  const ui=read('src/home-ui.js');
  const art=read('src/home-workshop-art.js');
  const expected=['logoprop','moddrop','weapons','photobooth','fivemtools','compressor','files','editor','archives','vehicles','code','converter','pack'];
  for(const page of expected){
    assert.match(ui,new RegExp("'"+page+"'"));
    assert.match(art,new RegExp('  '+page+':'));
  }
  assert.match(ui,/card\.onclick = \(\) => activate\(page\)/);
  assert.match(ui,/homeWorkshopIllustration\(page\)/);
  assert.match(ui,/home-banner-cta/);
  assert.match(art,/homeWorkshopCount=Object\.keys\(subjects\)\.length/);
});
test('illustrated cards support keyboard focus and reduced motion',()=>{
  const css=read('ui/workspace.css');
  assert.match(css,/\.home-workspace-grid\{display:grid/);
  assert.match(css,/\.home-workspace-card:focus-visible/);
  assert.match(css,/prefers-reduced-motion:reduce/);
});
