'use strict';
const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  vm = require('node:vm'),
  fs = require('node:fs');
function fixture() {
  const ids = [...fs.readFileSync('ui/index.html', 'utf8').matchAll(/id="([^"]+)"/g)].map(
    (m) => m[1],
  );
  const elements = new Map(
    ids.map((id) => [
      id,
      {
        hidden: false,
        disabled: false,
        textContent: '',
        open: false,
        classList: { toggle() {} },
        replaceChildren() {},
        append() {},
        showModal() {
          this.open = true;
        },
        close() {
          this.open = false;
        },
      },
    ]),
  );
  let send,
    resolve,
    calls = 0;
  const api = {
    getState: async () => ({
      status: 'available',
      version: '1.3.3',
      availableVersion: '1.3.4',
      progress: 0,
      message: 'Update tersedia',
    }),
    subscribe: (f) => (send = f),
    updateNow: () => {
      calls++;
      return new Promise((r) => (resolve = r));
    },
  };
  vm.runInNewContext(fs.readFileSync('ui/updates.js', 'utf8'), {
    window: { ganoUpdates: api },
    document: {
      getElementById: (id) => {
        assert(elements.has(id), id);
        return elements.get(id);
      },
      createElement: () => ({}),
    },
  });
  return { elements, send: (s) => send(s), finish: (value) => resolve(value), calls: () => calls };
}
const tick = () => new Promise((r) => setImmediate(r));
test('Update sekarang runs once, shows progress and restores controls after cancellation', async () => {
  const f = fixture();
  await tick();
  const primary = f.elements.get('updateInstall'),
    dialog = f.elements.get('updateDialog');
  assert.equal(primary.textContent, 'Update sekarang');
  assert.equal(primary.hidden, false);
  assert.equal(dialog.open, true);
  const pending = primary.onclick();
  await primary.onclick();
  assert.equal(f.calls(), 1);
  assert.equal(primary.disabled, true);
  f.send({
    status: 'downloading',
    version: '1.3.3',
    availableVersion: '1.3.4',
    progress: 50,
    downloadedBytes: 1048576,
    totalBytes: 2097152,
    message: 'Mengunduh 50%',
  });
  assert.match(f.elements.get('updateTransfer').textContent, /1.0 \/ 2.0 MB/);
  assert.equal(f.elements.get('updateProgress').value, 50);
  let prevented = false;
  dialog.oncancel({
    preventDefault() {
      prevented = true;
    },
  });
  assert(prevented);
  f.send({
    status: 'ready',
    version: '1.3.3',
    availableVersion: '1.3.4',
    progress: 100,
    message: 'Siap',
  });
  f.finish(false);
  await pending;
  assert.equal(primary.disabled, false);
  assert.equal(f.elements.get('closeUpdates').disabled, false);
});
