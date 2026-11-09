import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const bridge=readFileSync(new URL('../electron/native_bridge.py',import.meta.url),'utf8');
const backend=readFileSync(new URL('../electron/native-build.cjs',import.meta.url),'utf8');
const ui=readFileSync(new URL('../src/native-build-ui.js',import.meta.url),'utf8');

test('Muto full-ped emits flushable stage milestones before and after long rigging',()=>{
 assert.match(bridge,/print\('DITASHA_PED_STAGE ' \+ label, flush=True\)/);
 for(const phrase of ['Preparing the Muto rigging engine','Muto is importing, fitting and skinning',
 'Generating 3D preview and rigging test poses','Verifying native YDD, YFT, YTD and skeleton round-trip'])
   assert.ok(bridge.includes(phrase),phrase);
});
test('electron streams stages across split stdout buffers without unrelated parsing',()=>{
 assert.match(backend,/let stageBuffer = ''/);
 assert.match(backend,/stageBuffer\.split\(\/\\r\?\\n\/\)/);
 assert.match(backend,/job\.mode !== 'ped' \|\| !isStdout/);
 assert.match(backend,/state\.step = match\[1\]/);
 assert.match(backend,/state\.message = match\[1\]/);
});
test('rigging UI describes why 3D result is not yet available and shows elapsed time',()=>{
 assert.match(ui,/Full ped rigging sedang berlangsung/);
 assert.match(ui,/state\.startedAt/);
 assert.match(ui,/Batalkan build menghentikan proses/);
});
test('full ped retains fifteen-minute cancellation and never indicates success before report',()=>{
 assert.match(backend,/15 \* 60 \* 1000/);
 assert.match(backend,/state\.status = rep\.ok && !error && !state\.cancelled \? 'success' : 'error'/);
});
