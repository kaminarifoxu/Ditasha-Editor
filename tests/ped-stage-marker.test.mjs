import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
const native = readFileSync(new URL('../electron/native-build.cjs', import.meta.url), 'utf8');
const bridge = readFileSync(new URL('../electron/native_bridge.py', import.meta.url), 'utf8');
test('Muto stage writes atomically and keeps source batch worker unmodified', () => {
 const out=execFileSync(process.platform==='win32'?'python':'python3',
   ['tests/ped-stage-marker-checks.py'], {encoding:'utf8'});
 assert.match(out,/PASS_PED_STAGE_SIDECAR_AND_WORKER_RESTORE/);
});
test('Electron retrieves last Blender stage from sidecar on stop and failure', () => {
 assert.match(native,/path\.join\(job\.output, 'ped-stage\.json'\)/);
 assert.match(native,/await updateStageFromFile\(\)/);
 assert.match(native,/clearInterval\(stagePoll\)/);
 assert.match(native,/state\.step = stage\.step/);
 assert.match(bridge,/faulthandler\.dump_traceback_later\(75, repeat=True/);
});
