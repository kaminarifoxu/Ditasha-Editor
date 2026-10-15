// Real engine and native Electron view test. This is deliberately separate from
// unit tests: missing engines and unsupported hosts must not count as a pass.
const { app, BrowserWindow, WebContentsView } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const { registerEmbeddedIDE } = require('../electron/embedded-ide.cjs');
app.whenReady().then(async () => {
  let win, scratch, embedded;
  const timeout = setTimeout(() => {
    console.error('Embedded IDE smoke test timed out.');
    app.exit(1);
  }, 120000);
  try {
    const runtime = process.env.DITASHA_IDE_RUNTIME;
    assert(runtime, 'DITASHA_IDE_RUNTIME must point to an extracted server-web engine.');
    scratch = await fs.mkdtemp(path.join(os.tmpdir(), 'ditasha-ide-smoke-'));
    const handlers = new Map();
    win = new BrowserWindow({
      width: 1280,
      height: 800,
      webPreferences: { sandbox: true, nodeIntegration: false, contextIsolation: true },
    });
    await win.loadURL(
      'data:text/html,<body style="background:%23181b22;color:white">DITASHA Editor — IDE integration test</body>',
    );
    registerEmbeddedIDE({
      app: { getPath: () => scratch, on: (...args) => app.on(...args) },
      win,
      ipcMain: { handle: (name, fn) => handlers.set(name, fn) },
      dialog: {
        showOpenDialog: async () => ({ canceled: false, filePaths: [path.resolve(runtime)] }),
      },
      trusted: (event) => assert.equal(event, 'trusted'),
      WebContentsView: class {
        constructor(options) {
          embedded = new WebContentsView(options);
          return embedded;
        }
      },
    });
    const call = (name, value) => handlers.get('ditasha:embedded-ide-' + name)('trusted', value);
    assert.equal((await call('choose')).installed, true);
    assert.equal((await call('start')).status, 'ready');
    await call('layout', { x: 180, y: 50, width: 1060, height: 690 });
    assert.deepEqual(embedded.getBounds(), { x: 180, y: 50, width: 1060, height: 690 });
    const contents = embedded.webContents;
    const deadline = Date.now() + 60000;
    let loaded = false;
    while (Date.now() < deadline) {
      loaded = await contents.executeJavaScript(
        "!!document.querySelector('.monaco-workbench .part.editor') && !!document.querySelector('.monaco-workbench .activitybar')",
      );
      if (loaded) break;
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
    assert(loaded, 'The real full Code - OSS workbench did not render.');
    assert.equal(contents.getLastWebPreferences().nodeIntegration, false);
    assert.equal(contents.getLastWebPreferences().sandbox, true);
    assert.equal(await contents.executeJavaScript('typeof window.ditashaIDE'), 'undefined');
    const before = contents.id;
    await call('layout', null);
    await call('layout', { x: 180, y: 50, width: 780, height: 590 });
    assert.equal(contents.id, before, 'Workspace switching recreated the IDE.');
    assert.deepEqual(embedded.getBounds(), { x: 180, y: 50, width: 780, height: 590 });
    await fs.mkdir(path.resolve('release/qa'), { recursive: true });
    await fs.writeFile(
      path.resolve('release/qa/embedded-code-oss.png'),
      (await win.webContents.capturePage()).toPNG(),
    );
    console.log(
      'PASS: real Code - OSS engine, native embedded workbench, isolated privileges, resize and preserved session.',
    );
    clearTimeout(timeout);
    win.destroy();
    app.exit(0);
  } catch (error) {
    console.error('Embedded IDE smoke:', error.message);
    clearTimeout(timeout);
    if (win && !win.isDestroyed()) win.destroy();
    app.exit(1);
  }
});
