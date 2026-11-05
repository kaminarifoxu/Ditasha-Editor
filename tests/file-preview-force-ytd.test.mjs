import test from 'node:test';
import assert from 'node:assert/strict';
import { forcedPreviewDiffuse } from '../src/file-preview-force-ytd.js';
import { readFileSync } from 'node:fs';
const tex = (name) => ({name,w:1,h:1,out:new Uint8Array([10,20,30,255])});
const noMatch = () => null;
test('manual force maps one diffuse without rewriting model sampler',()=>{
 const chosen=tex('head_skin_a_uni');
 assert.equal(forcedPreviewDiffuse('unknown', [chosen], [], 'head.ydd', noMatch, true),chosen);
 assert.equal(forcedPreviewDiffuse('unknown', [chosen], [], 'head.ydd', noMatch, false),null);
});
test('never force normal/specular as diffuse or guess among multiple atlases',()=>{
 assert.equal(forcedPreviewDiffuse('unknown',[tex('head_normal')],[], 'head.ydd',noMatch,true),null);
 assert.equal(forcedPreviewDiffuse('unknown',[tex('face'),tex('hair')],[], 'head.ydd',noMatch,true),null);
});
test('matching shader sampler retains the existing diffuse material',()=>{
 const existing=tex('requested');const fallback=tex('other');
 assert.equal(forcedPreviewDiffuse('requested',[fallback],[], 'head.ydd',()=>existing,true),existing);
});
test('File Manager exposes opt-in override and reset with per-model scope',()=>{
 const ui=readFileSync(new URL('../src/file-manager-ui.js',import.meta.url),'utf8');
 const preview=readFileSync(new URL('../src/file-preview.js',import.meta.url),'utf8');
 assert.match(ui,/fmForceYtd/);
 assert.match(ui,/preview saja/);
 assert.match(ui,/activeTextureVariant, forcedYtd/);
 assert.match(preview,/setTextureVariant = async \(textureId, force = false\)/);
 assert.match(preview,/forcedPreviewDiffuse\(/);
});

test('forced YTD can replace embedded placeholder when only one valid diffuse is supplied',()=>{
 const embedded=tex('original-grey');const external=tex('female_face_diff_a_uni');
 const resolver=(name, textures, local) => local.find(t=>t.name===name)||textures.find(t=>t.name===name)||null;
 assert.equal(forcedPreviewDiffuse('original-grey',[external],[embedded],'head.ydd',resolver,true),external);
});
test('manual YTD selection reads only same-folder candidates through trusted IPC',()=>{
 const backend=readFileSync(new URL('../electron/file-manager.cjs',import.meta.url),'utf8');
 const preload=readFileSync(new URL('../electron/preload.cjs',import.meta.url),'utf8');
 const ui=readFileSync(new URL('../src/file-manager-ui.js',import.meta.url),'utf8');
 assert.match(backend,/texturesFor\(id\)/);
 assert.match(backend,/path\.posix\.dirname\(f\.relative\) === folder/);
 assert.match(preload,/ditasha:files-texturesFor/);
 assert.match(ui,/api\(\)\.texturesFor\(file\.id\)/);
 assert.match(ui,/forcePick\.onchange/);
});
