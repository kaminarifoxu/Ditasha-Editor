const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const root = join(__dirname, '..');
const read = (file) => readFileSync(join(root, file), 'utf8');

test('Editor 2.0 theme loads after all component stylesheets', () => {
  const html = read('ui/index.html');
  const styles = [...html.matchAll(/<link\s+href="([^"]+\.css)"\s+rel="stylesheet"\s*\/>/g)]
    .map((match) => match[1]);
  assert.ok(styles.length > 5, 'expected workspace stylesheet entries');
  assert.equal(styles.at(-1), 'ditasha-v2.css');
  assert.equal(styles.filter((name) => name === 'ditasha-v2.css').length, 1);
  assert.ok(styles.includes('character-workshops.css'));
});

test('Editor 2.0 styles are not imported twice', () => {
  const css = read('ui/workspace-polish.css');
  assert.doesNotMatch(css, /@import\s+url\(["']?\.\/ditasha-v2\.css/);
});

test('Editor 2.0 retains explicit theme and accessibility rules', () => {
  const css = read('ui/ditasha-v2.css');
  assert.match(css, /data-theme="midnight"/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /\.home-workspace-card/);
  assert.match(css, /\.workspace-nav/);
});

test('Editor 2.0 primary button styling does not target unrelated elements', () => {
  const css = read('ui/ditasha-v2.css');
  assert.doesNotMatch(css, /data-theme="midnight"\]\s+\.primary\s*\{/);
  assert.match(css, /data-theme="midnight"\]\s+button\.primary\s*\{/);
});

test('Editor 2.0 dark browser controls only apply to midnight theme', () => {
  const css = read('ui/ditasha-v2.css');
  assert.doesNotMatch(css, /body\.workspace-shell\s*\{\s*color-scheme:\s*dark/);
  assert.match(css, /data-theme="midnight"\]\s*\{\s*color-scheme:\s*dark/);
});

test('workspace panel controls mount once and retain a header fallback', () => {
  const js = read('src/workspace-polish.js');
  assert.match(js, /getElementById\('workspacePanelsDialog'\)\) return/);
  assert.match(js, /if \(triggerAnchor\) triggerAnchor\.after\(button\)/);
  assert.match(js, /else if \(header\) header\.append\(button\)/);
  assert.match(js, /document\.body\.prepend\(button\)/);
});

test('panel toggles preserve expanded state and work with buttons', () => {
  const js = read('src/workspace-polish.js');
  assert.match(js, /toggle\.type = 'button'/);
  assert.match(js, /toggle\.setAttribute\('aria-expanded'/);
  assert.match(js, /toggle\.onclick =/);
});

test('panel key generation tolerates parentless elements', () => {
  const js = read('src/workspace-polish.js');
  assert.match(js, /panel\.parentElement\?\.id/);
});

test('choice buttons retain native selection and support teardown', () => {
  const js = read('src/workspace-choices.js');
  assert.match(js, /select\.selectedIndex = index/);
  assert.match(js, /select\.dispatchEvent\(new Event\('change'/);
  assert.match(js, /select\.closest\('\[hidden\]'\)/);
  assert.match(js, /sync\.destroy = \(\) =>/);
  assert.match(js, /select\.removeEventListener\('change', sync\)/);
  assert.match(js, /delete select\.dataset\.workspaceChoices/);
});

test('detached choice controls do not receive stale updates', () => {
  const js = read('src/workspace-choices.js');
  assert.match(js, /if \(!box\.isConnected \|\| !select\.isConnected\) return/);
});

test('base HTML contains no duplicate static element IDs', () => {
  const html = read('ui/index.html');
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
  assert.ok(ids.length > 20, 'expected editor controls to have stable IDs');
  assert.equal(new Set(ids).size, ids.length, 'duplicate IDs can break event binding');
});

test('every stylesheet linked by the editor entry exists', () => {
  const { existsSync } = require('node:fs');
  const html = read('ui/index.html');
  const styles = [...html.matchAll(/<link\s+href="([^"]+\.css)"\s+rel="stylesheet"\s*\/>/g)]
    .map((match) => match[1]);
  for (const style of styles) {
    assert.ok(existsSync(join(root, 'ui', style)), `Missing stylesheet: ${style}`);
  }
});

test('choice synchronization timer is stopped when the shell is removed', () => {
  const js = read('src/workspace-polish.js');
  assert.match(js, /const choiceRefresh = setInterval/);
  assert.match(js, /clearInterval\(choiceRefresh\)/);
  assert.match(js, /sync\.destroy\?\.\(\)/);
});
