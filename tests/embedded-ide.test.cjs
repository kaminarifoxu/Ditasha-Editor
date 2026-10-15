const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { EventEmitter } = require('node:events');
const {
  inspectRuntime,
  agentPort,
  clampBounds,
  registerEmbeddedIDE,
} = require('../electron/embedded-ide.cjs');

test('IDE bounds stay within the content area and hide invalid or empty rectangles', () => {
  assert.deepEqual(clampBounds({ x: -5, y: 20, width: 1600, height: 900 }, [1000, 700]), {
    x: 0,
    y: 20,
    width: 1000,
    height: 680,
  });
  for (const value of [
    null,
    {},
    { x: NaN, y: 0, width: 50, height: 50 },
    { x: 1001, y: 0, width: 50, height: 50 },
  ])
    assert.equal(clampBounds(value, [1000, 700]), null);
  assert.equal(agentPort('Extension host agent listening on 42515\n'), 42515);
  assert.equal(agentPort('Extension host agent listening on 99999'), null);
  assert.equal(agentPort('http://example.invalid:1234/'), null);
});

test('IDE runtime needs the full MIT workbench, not a desktop executable or proprietary server', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ditasha-ide-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await assert.rejects(inspectRuntime('relative'), /absolute/);
  await fs.mkdir(path.join(root, 'out/vs/code/browser/workbench'), { recursive: true });
  await fs.writeFile(path.join(root, 'node'), '');
  await fs.writeFile(path.join(root, 'out/server-main.js'), '');
  await fs.writeFile(
    path.join(root, 'product.json'),
    JSON.stringify({ licenseName: 'Microsoft Software License Terms' }),
  );
  await assert.rejects(inspectRuntime(root, 'linux'), /MIT/);
  await fs.writeFile(path.join(root, 'product.json'), JSON.stringify({ licenseName: 'MIT' }));
  await assert.rejects(inspectRuntime(root, 'linux'), /ENOENT/);
  await fs.writeFile(
    path.join(root, 'out/vs/code/browser/workbench/workbench.html'),
    '<html></html>',
  );
  assert.equal((await inspectRuntime(root, 'linux')).root, await fs.realpath(root));
});

test('IDE IPC validates callers and reports a missing engine instead of claiming the IDE is installed', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ditasha-ide-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const handlers = new Map();
  const app = new EventEmitter();
  app.getPath = () => root;
  const win = new EventEmitter();
  registerEmbeddedIDE({
    app,
    win,
    resourcesPath: root,
    ipcMain: { handle: (key, value) => handlers.set(key, value) },
    dialog: {},
    trusted: (event) => {
      if (event !== 'trusted') throw Error('Untrusted');
    },
    WebContentsView: class {},
  });
  await assert.rejects(handlers.get('ditasha:embedded-ide-state')('untrusted'), /Untrusted/);
  assert.equal((await handlers.get('ditasha:embedded-ide-state')('trusted')).installed, false);
  await assert.rejects(handlers.get('ditasha:embedded-ide-start')('trusted'), /not installed/);
  assert.equal((await handlers.get('ditasha:embedded-ide-state')('trusted')).status, 'error');
  win.emit('closed');
});
