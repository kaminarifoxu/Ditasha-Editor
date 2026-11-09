import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const backend = readFileSync(new URL('../electron/native-build.cjs', import.meta.url),'utf8');
const review = readFileSync(new URL('../electron/ped_review.py', import.meta.url),'utf8');
const ui = readFileSync(new URL('../src/native-build-ui.js', import.meta.url),'utf8');

test('15-minute rigging timeout remains distinguishable from Blender exit code 1',()=>{
  assert.match(backend,/let timeoutReason = null/);
  assert.match(backend,/timeoutReason \|\| \(job\.mode === 'ped'/);
  assert.match(backend,/DITASHA_TIMEOUT /);
  assert.match(backend,/state\.message = timeoutReason \|\| \(state\.cancelled/);
});
test('preflight reports mesh count and complexity before Muto mesh join',()=>{
  assert.match(review,/original_import\(source\)/);
  assert.match(review,/DITASHA_PED_STAGE Imported model:/);
  assert.match(review,/preparing mesh join and auto markers/);
  assert.match(review,/vertices\s*>\s*2000000 or faces\s*>\s*2000000/);
});
test('diagnostic download exists even when the Blender report is absent',()=>{
  assert.match(ui,/id = 'nbSaveEngineLog'/);
  assert.match(ui,/ditasha-blender-diagnostics\.json/);
  assert.match(ui,/\blog: state\.log/);
  assert.match(ui,/\breport: state\.report/);
});
