import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const renderer = readFileSync(new URL('../src/native-preview.js', import.meta.url), 'utf8');
const bridge = readFileSync(new URL('../electron/native_bridge.py', import.meta.url), 'utf8');

test('preview has separate cutout and blend rendering', () => {
  assert.match(renderer, /alphaMode === 'cutout' \? 0\.35/);
  assert.match(renderer, /transparent: alphaMode === 'blend'/);
  assert.match(renderer, /depthWrite: alphaMode !== 'blend'/);
});
test('native bridge sends cutout hair classification and explicit missing maps', () => {
  assert.match(bridge, /'hair', 'eyelash', 'eyebrow', 'ped_fur'/);
  assert.match(bridge, /'materialInfo': info/);
  assert.match(bridge, /'unknown' if node is None and role != 'diffuse'/);
  assert.match(bridge, /'present' if indices\[role\] is not None else 'missing'/);
});
test('preview never color-keys black pixels or substitutes a diffuse map', () => {
  assert.doesNotMatch(renderer, /black.*transparent|colorKey/);
  assert.match(renderer, /materialInfo\?\.diffuse === 'missing'/);
});
