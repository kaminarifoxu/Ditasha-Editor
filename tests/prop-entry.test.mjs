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
  const activated = [];
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
    };
    const config = {
      nav,
      activate: page => activated.push(page),
      openWorkspace: () => activated.push('propcreator'),
    };
    const button = mountPropCreatorEntry(config);
    assert.equal(button.dataset.page, 'propcreator');
    assert.match(button.innerHTML, /Prop & Collision Creator/);
    assert.equal(members.get('propcreator'), button);
    assert.equal(mountPropCreatorEntry(config), button);
    listeners.click();
    assert.deepEqual(activated, ['propcreator']);
  } finally {
    globalThis.document = oldDocument;
  }
});
test('Prop Creator navigation rejects missing existing Model viewer', () => {
  assert.throws(() => mountPropCreatorEntry({
    nav: { querySelector() { return null; } },
    activate() {},
    openWorkspace() {},
  }), /navigation not found/);
});
