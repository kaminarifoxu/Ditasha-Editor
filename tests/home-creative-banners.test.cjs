'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
test('all 10 creative workspace artworks remain offline with existing navigation',()=>{
 const art=read('src/home-creative-art.js'),ui=read('src/home-ui.js');
 const ids=['photocraft','vectorcraft','lightcraft','filmcraft','opencut','effectcraft','pdfcraft','wordcraft','gridcraft','deckcraft'];
 for(const id of ids)assert.match(art,new RegExp(' '+id+':'));
 assert.match(ui,/creativeArtwork\(id\)/);
 assert.match(ui,/card\.onclick = \(\) => activate\('craft-' \+ id\)/);
 assert.match(art,/creativeArtworkIds=Object\.keys\(items\)/);
});
test('creative banners responsive and reduced-motion safe',()=>{
 const css=read('ui/workspace.css');
 assert.match(css,/\.home-suite-grid\{display:grid/);
 assert.match(css,/\.home-suite-card:focus-visible/);
 assert.match(css,/prefers-reduced-motion:reduce/);
});
