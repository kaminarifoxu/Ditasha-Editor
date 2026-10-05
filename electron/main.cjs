const { app, BrowserWindow, Menu, dialog, ipcMain, net, shell } = require('electron');
const path = require('node:path');
const { isTrustedUpdateEvent } = require('./ipc-trust.cjs');
const { startReplacement } = require('./installer.cjs');
const { completeUpdateStartup } = require('./update-startup.cjs');
const fs = require('node:fs/promises');
const { createPortableUpdater } = require('./updater.cjs');
let win,
  splash,
  updater,
  allowQuit = false,
  closingPrompt = false;
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) app.quit();
else {
  app.on('second-instance', () => {
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });
  app.whenReady().then(async () => {
    if (process.env.DITASHA_UPDATE_SMOKE_ROOT) {
      await require('./update-probe.cjs').run(app, net);
      return;
    }
    // Preserve updater preferences when upgrading from GANOMABI Asset Studio.
    app.setPath('userData', path.join(app.getPath('appData'), 'GANOMABI Asset Studio'));
    app.setAppUserModelId('com.ganomabi.assetstudio');
    splash = new BrowserWindow({
      width: 520,
      height: 380,
      frame: false,
      resizable: false,
      show: false,
      backgroundColor: '#101113',
      icon: path.join(__dirname, '..', 'assets', 'icon.ico'),
      webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true },
    });
    splash.setMenu(null);
    splash.once('ready-to-show', () => splash?.show());
    splash.on('closed', () => (splash = null));
    splash.loadFile(path.join(__dirname, '..', 'ui', 'splash.html'));
    win = new BrowserWindow({
      width: 1500,
      height: 950,
      minWidth: 800,
      minHeight: 600,
      title: 'DITASHA Editor',
      backgroundColor: '#101113',
      icon: path.join(__dirname, '..', 'assets', 'icon.ico'),
      show: false,
      autoHideMenuBar: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        webSecurity: true,
        preload: path.join(__dirname, 'preload.cjs'),
      },
    });
    Menu.setApplicationMenu(null);
    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    win.webContents.on('will-navigate', (e) => e.preventDefault());
    win.webContents.on('will-prevent-unload', (e) => {
      if (allowQuit) e.preventDefault();
    });
    win.on('close', async (e) => {
      if (allowQuit) return;
      e.preventDefault();
      if (closingPrompt) return;
      closingPrompt = true;
      try {
        const choice = await win.webContents.executeJavaScript(
          "window.ditashaWorkspace ? (window.ditashaWorkspace.unsavedItems().length ? window.ditashaWorkspace.confirmDiscard('close') : 'discard') : 'discard'",
        );
        if (choice === 'discard') {
          allowQuit = true;
          win.close();
        }
      } catch {
        dialog.showMessageBox(win, {
          type: 'error',
          message: 'Tidak dapat memeriksa desain. Coba tutup kembali setelah editor siap.',
        });
      } finally {
        closingPrompt = false;
      }
    });
    win.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) =>
      callback(false),
    );
    win.webContents.session.on('will-download', (_event, item) => {
      const result = dialog.showSaveDialogSync(win, {
        title: 'Simpan hasil ekspor',
        defaultPath: path.join(app.getPath('downloads'), item.getFilename()),
      });
      if (!result) item.cancel();
      else item.setSavePath(result);
    });
    let revealed = false;
    const reveal = () => {
      if (revealed) return;
      revealed = true;
      win.maximize();
      win.show();
      if (splash && !splash.isDestroyed()) splash.close();
    };
    let startupConfirmed = false;
    ipcMain.on('ditasha:ready', (event) => {
      if (isTrustedUpdateEvent(event, win, path.join(__dirname, '..', 'ui', 'index.html')))
        setTimeout(async () => {
          reveal();
          if (startupConfirmed) return;
          startupConfirmed = true;
          try {
            await completeUpdateStartup({
              target: process.env.PORTABLE_EXECUTABLE_FILE,
              version: app.getVersion(),
            });
          } catch (error) {
            console.error('Update startup confirmation:', error.message);
          }
        }, 350);
    });
    win.webContents.on('did-fail-load', (_event, code, message) => {
      if (code !== -3) {
        reveal();
        dialog.showMessageBox(win, {
          type: 'error',
          message: 'Editor gagal dimuat.',
          detail: message,
        });
      }
    });
    updater = createPortableUpdater({
      version: app.getVersion(),
      directory: path.join(app.getPath('userData'), 'updates'),
      fetcher: (...args) => net.fetch(...args),
      onState: (state) => {
        if (win && !win.isDestroyed()) win.webContents.send('gano:update-state', state);
      },
    });
    const trusted = (event) => {
      if (!isTrustedUpdateEvent(event, win, path.join(__dirname, '..', 'ui', 'index.html')))
        throw Error('Untrusted update request');
    };
    ipcMain.handle('ditasha:open-icon-credits', async (event) => {
      trusted(event);
      await shell.openExternal('https://www.flaticon.com/uicons');
      return true;
    });
    ipcMain.handle('ditasha:open-donation', async (event) => {
      trusted(event);
      await shell.openExternal('https://saweria.co/itsaminarii');
      return true;
    });
    ipcMain.handle('ditasha:save-export', async (event, payload) => {
      trusted(event);
      const name = payload?.name,
        data = payload?.data;
      if (
        typeof name !== 'string' ||
        path.basename(name) !== name ||
        name.length > 240 ||
        /[\x00-\x1f<>:"\\|?*]/.test(name) ||
        /[. ]$/.test(name) ||
        /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name) ||
        !name ||
        name === '.' ||
        name === '..' ||
        !(data instanceof Uint8Array) ||
        data.byteLength > 128 * 1024 * 1024
      )
        throw Error('Data ekspor tidak valid.');
      const result = await dialog.showSaveDialog(win, {
        title: 'Simpan hasil desain',
        defaultPath: path.join(app.getPath('downloads'), name),
        filters: [
          {
            name: 'DITASHA ' + name.split('.').pop().toUpperCase(),
            extensions: [name.includes('.') ? name.split('.').pop().toLowerCase() : '*'],
          },
        ],
      });
      if (result.canceled || !result.filePath) return { saved: false };
      await fs.writeFile(result.filePath, data);
      return { saved: true };
    });
    ipcMain.handle('gano:update-state', async (event) => {
      trusted(event);
      const state = updater.getState();
      try {
        const report = JSON.parse(
          (
            await fs.readFile(path.join(app.getPath('userData'), 'updates', 'install.json'), 'utf8')
          ).replace(/^\uFEFF/, ''),
        );
        if (report.status === 'error') state.installError = report.message;
      } catch {}
      return state;
    });
    ipcMain.handle('gano:update-check', (event) => {
      trusted(event);
      return updater.check();
    });
    ipcMain.handle('gano:update-download', (event) => {
      trusted(event);
      return updater.download();
    });
    ipcMain.handle('gano:update-auto', (event, enabled) => {
      trusted(event);
      return updater.setAutoDownload(enabled);
    });
    const installUpdate = async (event, downloadFirst = false) => {
      trusted(event);
      const target = process.env.PORTABLE_EXECUTABLE_FILE;
      if (process.platform !== 'win32' || !target)
        throw Error('Gunakan EXE portable Windows untuk memasang update.');
      const choice = await win.webContents.executeJavaScript(
        "window.ditashaWorkspace.confirmDiscard('update')",
      );
      if (choice !== 'discard') return false;
      if (downloadFirst) {
        const state = await updater.download();
        if (state.status !== 'ready') throw Error(state.message);
      }
      const staged = updater.getReadyPath();
      if (!staged) throw Error('Unduh update terlebih dahulu.');
      await startReplacement({
        target,
        staged,
        parentPid: process.pid,
        bootloaderPid: process.ppid,
        directory: path.join(app.getPath('userData'), 'updates'),
        expectedVersion: updater.getState().availableVersion,
      });
      allowQuit = true;
      setTimeout(() => app.quit(), 150);
      return true;
    };
    ipcMain.handle('gano:update-install', (event) => installUpdate(event));
    ipcMain.handle('gano:update-now', (event) => installUpdate(event, true));
    win.webContents.once('did-finish-load', () => {
      setTimeout(reveal, 350);
      setTimeout(() => updater.check(), 2500);
    });
    win.loadFile(path.join(__dirname, '..', 'ui', 'index.html'));
    win.on('closed', () => {
      win = null;
    });
  });
  app.on('window-all-closed', () => app.quit());
}
