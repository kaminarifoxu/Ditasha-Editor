import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mountPropCreatorEntry } from '../src/creators/prop-entry.js';

function fakeNavigation() {
  const members = new Map();
  const modelViewer = { after(child) { members.set(child.dataset.page, child); } };
  members.set('modelviewer', modelViewer);
  const workshop = { querySelector(selector) {
    const name = /data-page="([^"]+)"/.exec(selector)?.[1];
    return members.get(name) || null;
  } };
  const items = [];
  const nav = {
    querySelector(query) { return query === '.workshop-nav' ? workshop : null; },
    querySelectorAll() { return items; },
  };
  return { nav, items, members };
}
test('Prop Creator has its own persistent Asset Workshop button', async () => {
  const { nav, items, members } = fakeNavigation();
  const oldDocument = globalThis.document;
  const label = { textContent: '' };
  const panel = { open: false, scrollIntoView() { this.scrolled = true; } };
  const activated = [];
  let mounted = 0;
  const listeners = {};
  try {
    globalThis.document = {
      createElement(tag) {
        assert.equal(tag, 'button');
        const node = {
          dataset: {},
          classList: { add(name) { node.lastClass = name; }, remove() {} },
          setAttribute() {},
          addEventListener(type, cb) { listeners[type] = cb; },
        };
        items.push(node);
        return node;
      },
      querySelector(selector) {
        assert.equal(selector, '#workspaceLabel');
        return label;
      },
    };
    const config = {
      nav,
      activate: page => activated.push(page),
      mountInspector: async () => { mounted++; return panel; },
    };
    const button = mountPropCreatorEntry(config);
    assert.equal(button.dataset.page, 'propcreator');
    assert.match(button.innerHTML, /Prop & Collision Creator/);
    assert.equal(members.get('propcreator'), button);
    assert.equal(mountPropCreatorEntry(config), button);
    await listeners.click();
    assert.deepEqual(activated, ['editor']);
    assert.equal(mounted, 1);
    assert.equal(panel.open, true);
    assert.equal(panel.scrolled, true);
    assert.equal(label.textContent, 'Prop & Collision Creator');
    assert.equal(button.lastClass, 'active');
  } finally {
    globalThis.document = oldDocument;
  }
});
test('Prop Creator navigation rejects missing existing Model viewer', () => {
  assert.throws(() => mountPropCreatorEntry({
    nav: { querySelector() { return null; } },
    activate() {},
    mountInspector() {},
  }), /navigation not found/);
});
