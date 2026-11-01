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
  assert.match(js, /else header\?\.append\(button\)/);
});

test('panel toggles preserve expanded state and work with buttons', () => {
  const js = read('src/workspace-polish.js');
  assert.match(js, /toggle\.type = 'button'/);
  assert.match(js, /toggle\.setAttribute\('aria-expanded'/);
  assert.match(js, /toggle\.onclick =/);
});
