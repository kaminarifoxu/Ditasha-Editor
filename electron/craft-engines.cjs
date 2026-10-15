'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { enginePath } = require('./craft-paths.cjs');
const { clampBounds, disposeIDEView } = require('./embedded-ide.cjs');
const specs = require('../config/craft-engines.json');
function registerCraftEngines({
  app,
  ipcMain,
  protocol,
  net,
  session,
  win,
  trusted,
  WebContentsView,
  dialog,
  root = app.isPackaged
    ? path.join(process.resourcesPath, 'craft-runtime')
    : path.resolve(__dirname, '../craft-runtime'),
}) {
  const views = new Map();
  const configuredSessions = new Set();
  let active = '',
    bounds;
  async function installProtocol(partition) {
    const ses = session.fromPartition(partition);
    if (configuredSessions.has(partition)) return ses;
    if (
      !ses.protocol.isProtocolHandled ||
      !(await ses.protocol.isProtocolHandled('ditasha-craft'))
    ) {
      ses.protocol.handle('ditasha-craft', async (request) => {
        try {
          const { file, base } = enginePath(root, request.url);
          const real = await fs.realpath(file);
          if (!real.startsWith((await fs.realpath(base)) + path.sep))
            return new Response('', { status: 403 });
          const result = await net.fetch(pathToFileURL(real).href);
          const headers = new Headers(result.headers);
          if (file.endsWith('.wasm')) headers.set('Content-Type', 'application/wasm');
          if (file.endsWith('.js')) headers.set('Content-Type', 'text/javascript');
          headers.set('Cross-Origin-Opener-Policy', 'same-origin');
          headers.set('Cross-Origin-Embedder-Policy', 'require-corp');
          headers.set('Cross-Origin-Resource-Policy', 'same-origin');
          return new Response(result.body, { status: result.status, headers });
        } catch {
          return new Response('Engine file unavailable', { status: 404 });
        }
      });
    }
    // No external APIs, model downloads, telemetry, AI or remote code in embedded engines.
    ses.webRequest.onBeforeRequest((details, done) => {
      done({ cancel: !/^(ditasha-craft:|blob:|data:)/.test(details.url) });
    });
    const allowed = new Set(['clipboard-read', 'clipboard-sanitized-write', 'fullscreen']);
    ses.setPermissionRequestHandler((_c, permission, callback) =>
      callback(allowed.has(permission)),
    );
    ses.setPermissionCheckHandler((_c, permission) => allowed.has(permission));
    ses.on('will-download', (_e, item) => {
      const target = dialog.showSaveDialogSync(win, {
        title: 'Save creative work',
        defaultPath: path.join(app.getPath('downloads'), path.basename(item.getFilename())),
      });
      if (target) item.setSavePath(target);
      else item.cancel();
    });
    configuredSessions.add(partition);
    return ses;
  }
  function layout() {
    for (const [id, entry] of views) {
      if (entry.view.webContents.isDestroyed()) continue;
      const rect = id === active && clampBounds(bounds, win.getContentSize());
      entry.view.setVisible(!!rect);
      if (rect) entry.view.setBounds(rect);
    }
  }
  async function state() {
    return Promise.all(
      specs.map(async (s) => {
        let installed = false;
        try {
          const r = JSON.parse(await fs.readFile(path.join(root, s.id, 'DITASHA-ENGINE.json')));
          await fs.access(path.join(root, s.id, 'index.html'));
          installed = r.sha256 === s.sha256;
        } catch {}
        return {
          id: s.id,
          version: s.version,
          installed,
          running: views.has(s.id),
          error: views.get(s.id)?.error || '',
        };
      }),
    );
  }
  async function start(id) {
    if (!specs.some((s) => s.id === id)) throw Error('Unknown creative workspace');
    if (!(await state()).find((s) => s.id === id)?.installed)
      throw Error(
        'This build is missing the creative engine. Install the complete DITASHA preview.',
      );
    if (!views.has(id)) {
      const ses = await installProtocol('persist:ditasha-craft-' + id);
      const view = new WebContentsView({
        webPreferences: {
          session: ses,
          nodeIntegration: false,
          contextIsolation: true,
          sandbox: true,
          webSecurity: true,
          backgroundThrottling: true,
        },
      });
      const entry = { view, error: '' };
      views.set(id, entry);
      win.contentView.addChildView(view);
      view.setVisible(false);
      view.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
      view.webContents.on('will-navigate', (event, url) => {
        if (!url.startsWith('ditasha-craft://' + id + '/')) event.preventDefault();
      });
      view.webContents.on('render-process-gone', (_event, details) => {
        entry.error =
          'Engine stopped: ' +
          details.reason +
          '. Close the engine and reopen it; exported files are safe.';
      });
      view.webContents.on('did-fail-load', (_event, code, message) => {
        if (code !== -3) entry.error = message;
      });
      // Web builds offer manual editing; no automation/MCP server is started.
      await view.webContents.loadURL('ditasha-craft://' + id + '/index.html');
    }
    active = id;
    layout();
    return state();
  }
  async function close(id) {
    const entry = views.get(id);
    if (!entry) return false;
    const answer = await dialog.showMessageBox(win, {
      type: 'question',
      buttons: ['Keep editing', 'Close engine'],
      defaultId: 0,
      cancelId: 0,
      message: 'Have you saved your work?',
      detail: 'Save or export inside this workspace before closing. Unsaved edits may be lost.',
    });
    if (answer.response !== 1) return false;
    views.delete(id);
    disposeIDEView(win, entry.view);
    if (active === id) active = '';
    return true;
  }
  ipcMain.handle('ditasha:craft-state', (e) => {
    trusted(e);
    return state();
  });
  ipcMain.handle('ditasha:craft-start', (e, id) => {
    trusted(e);
    return start(id);
  });
  ipcMain.handle('ditasha:craft-layout', (e, value) => {
    trusted(e);
    bounds = value;
    if (!value) active = '';
    else if (specs.some((s) => s.id === value.id)) active = value.id;
    layout();
  });
  ipcMain.handle('ditasha:craft-close', (e, id) => {
    trusted(e);
    return close(id);
  });
  win.on('resize', layout);
  return {
    state,
    start,
    views,
    requestClose: async () => {
      if (!views.size) return true;
      const answer = await dialog.showMessageBox(win, {
        type: 'question',
        buttons: ['Keep editing', 'Close DITASHA'],
        defaultId: 0,
        cancelId: 0,
        message: 'Save your creative work before closing',
        detail:
          'Creative engines manage their own documents. Save or export open Photo, Vector, Video, Motion and Office documents first.',
      });
      return answer.response === 1;
    },
  };
}
module.exports = { registerCraftEngines };
