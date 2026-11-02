'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ui = fs.readFileSync(path.join(__dirname, '../src/photo-booth-ui.js'), 'utf8');
const manager = fs.readFileSync(path.join(__dirname, '../electron/file-manager.cjs'), 'utf8');
const managerUi = fs.readFileSync(path.join(__dirname, '../src/file-manager-ui.js'), 'utf8');

test('restored Photo Booth presets reapply emote pose after hydration and detect unbound clips', () => {
  const start = ui.indexOf('async function restoreScene(record)');
  const end = ui.indexOf("'pbLibrarySave').onclick", start);
  const section = ui.slice(start, end);
  assert.match(section, /await settleEmotes\(\)/);
  assert.match(section, /missingPresetEmotes/);
  assert.match(section, /a\.motion\.pose = 'relaxed'/);
  assert.match(section, /applyPose\(\);\s*render\(\)/);
});

test('manual File Manager YTD and GTA model preview limits match in UI and backend', () => {
  assert.match(manager, /\.ytd\$\/i\.test\(entry\.name\) \? 512/);
  assert.match(manager, /\.\(ydd\|ydr\|yft\)\$\/i\.test\(entry\.name\) \? 256/);
  assert.match(managerUi, /\.ytd\$\/i\.test\(picked\.name\) \? 512/);
  assert.match(managerUi, /\.\(ydd\|ydr\|yft\)\$\/i\.test\(picked\.name\) \? 256/);
});
