'use strict';
const { app, BrowserWindow, ipcMain } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const { registerFileManager } = require('../electron/file-manager.cjs');
app.whenReady().then(async () => {
  let win, scratch;
  const timeout = setTimeout(() => {
    console.error('File Manager smoke timed out');
    app.exit(1);
  }, 120000);
  try {
    scratch = await fs.mkdtemp(path.join(os.tmpdir(), 'ditasha-files-ui-'));
    const source = path.join(scratch, 'source'),
      output = path.join(scratch, 'output');
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4sOHYfwAIYANmZqFx7wAAAABJRU5ErkJggg==',
      'base64',
    );
    const entries = {
      'images/logo.png': png,
      'images/second/logo.png': png,
      'clothes/mp_f_freemode_01^jbib_001_u.ydd': 'model',
      'clothes/mp_f_freemode_01^jbib_diff_001_a_uni.ytd': 'texture',
      'vehicles/buffalo.yft': 'model',
      'vehicles/buffalo.ytd': 'texture',
    };
    await fs.mkdir(output);
    for (const [relative, data] of Object.entries(entries)) {
      await fs.mkdir(path.dirname(path.join(source, relative)), { recursive: true });
      await fs.writeFile(path.join(source, relative), data);
    }
    win = new BrowserWindow({
      width: 1500,
      height: 950,
      show: true,
      webPreferences: {
        preload: path.resolve('electron/preload.cjs'),
        contextIsolation: true,
        sandbox: true,
        nodeIntegration: false,
        backgroundThrottling: false,
      },
    });
    const picks = [source, output];
    registerFileManager({
      win,
      ipcMain,
      trusted: (event) => assert.equal(event.sender, win.webContents),
      dialog: { showOpenDialog: async () => ({ canceled: false, filePaths: [picks.shift()] }) },
      shell: {},
    });
    ipcMain.handle('gano:update-state', () => ({
      status: 'idle',
      version: 'test',
      message: 'Offline test',
      autoDownload: false,
    }));
    await win.loadFile(path.resolve('ui/index.html'));
    const report = await win.webContents.executeJavaScript(
      '(' + require('./file-manager-ui-checks.cjs').toString() + ')()',
    );
    const directories = await fs.readdir(output);
    assert.equal(directories.length, 1);
    const result = path.join(output, directories[0]);
    const copied = JSON.parse(await fs.readFile(path.join(result, 'ditasha-sort-report.json')));
    assert.equal(copied.copied, 2);
    assert.equal(copied.failed, 0);
    for (const file of copied.files) {
      assert.deepEqual(await fs.readFile(path.join(result, file.destination)), png);
      assert.deepEqual(await fs.readFile(path.join(source, file.source)), png);
    }
    await fs.mkdir(path.resolve('release/qa'), { recursive: true });
    await new Promise((resolve) => setTimeout(resolve, 250));
    await fs.writeFile(
      path.resolve('release/qa/file-manager.png'),
      (await win.webContents.capturePage()).toPNG(),
    );
    await fs.writeFile(path.resolve('release/qa/file-manager-result.json'), JSON.stringify(report));
    console.log('PASS: File Manager UI and real native file copy ' + JSON.stringify(report));
    clearTimeout(timeout);
    await fs.rm(scratch, { recursive: true, force: true });
    win.destroy();
    app.exit(0);
  } catch (e) {
    process.exitCode = 1;
    console.error(e);
    clearTimeout(timeout);
    if (win && !win.isDestroyed()) {
      await fs.mkdir(path.resolve('release/qa'), { recursive: true });
      await fs
        .writeFile(
          path.resolve('release/qa/file-manager-failure.png'),
          (await win.webContents.capturePage()).toPNG(),
        )
        .catch(() => {});
    }
    if (scratch) await fs.rm(scratch, { recursive: true, force: true });
    if (win && !win.isDestroyed()) win.destroy();
    app.exit(1);
  }
});
