'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const script = fs.readFileSync(path.join(__dirname, '../electron/native_bridge.py'), 'utf8');
test('Muto rig bridge accepts supported Blender 4.2 and newer', () => {
  assert.match(script, /bpy\.app\.version < \(4, 2, 0\)/);
  assert.doesNotMatch(script, /bpy\.app\.version < \(5, 0, 0\)/);
});
test('female reference is passed to Muto batch export', () => {
  assert.match(script, /'rig': 'mp_f' if options\.get\('reference'\) == 'mp_f' else 'mp_m'/);
});
test('ped native worker validates batch return before using it', () => {
  assert.match(script, /if not isinstance\(result, dict\):/);
});
