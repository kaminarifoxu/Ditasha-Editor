'use strict';
// Same packaged workspace, isolated lifecycle for Windows installer CI.
exports.run = async function (app) {
  const fs = require('node:fs/promises'),
    path = require('node:path');
  const { BrowserWindow } = require('electron');
  const root = process.env.DITASHA_SETUP_SMOKE_ROOT;
  const win = new BrowserWindow({
    show: false,
    webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false },
  });
  try {
    await win.loadFile(path.join(__dirname, '..', 'ui', 'index.html'));
    const ready = await win.webContents.executeJavaScript(
      'Boolean(window.ditashaWorkspace && document.getElementById("restoreWorkspacePanels"))',
    );
    if (!ready) throw Error('Installed workspace did not initialize');
    await fs.writeFile(
      path.join(root, 'installed-ready.json'),
      JSON.stringify({ version: app.getVersion(), executable: process.execPath, ready }),
    );
  } catch (e) {
    await fs.writeFile(path.join(root, 'installed-error.txt'), String(e.stack || e));
    process.exitCode = 1;
  } finally {
    win.destroy();
    app.quit();
  }
};
