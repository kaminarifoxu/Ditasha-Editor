'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const { randomBytes } = require('node:crypto');
const { spawn } = require('node:child_process');
const http = require('node:http');

async function inspectRuntime(root, platform = process.platform) {
  if (typeof root !== 'string' || !path.isAbsolute(root))
    throw Error('Choose an absolute Code - OSS runtime folder.');
  root = await fs.realpath(root);
  const executable = path.join(root, platform === 'win32' ? 'node.exe' : 'node');
  const entry = path.join(root, 'out', 'server-main.js');
  for (const file of [executable, entry]) {
    if (!(await fs.stat(file)).isFile()) throw Error('Incomplete Code - OSS server-web runtime.');
  }
  const product = JSON.parse(await fs.readFile(path.join(root, 'product.json'), 'utf8'));
  if (product.licenseName !== 'MIT')
    throw Error('Use a Code - OSS MIT server-web build, not Microsoft VS Code Server.');
  const web = path.join(root, 'out', 'vs', 'code', 'browser', 'workbench', 'workbench.html');
  if (!(await fs.stat(web)).isFile()) throw Error('Runtime is missing the full web workbench.');
  return { root, executable, entry };
}

function agentPort(output) {
  const value = /Extension host agent listening on (\d+)/i.exec(output)?.[1];
  const port = Number(value);
  return Number.isInteger(port) && port > 0 && port < 65536 ? port : null;
}

function clampBounds(value, size) {
  if (!value || !['x', 'y', 'width', 'height'].every((k) => Number.isFinite(value[k]))) return null;
  const x = Math.max(0, Math.min(size[0], Math.floor(value.x)));
  const y = Math.max(0, Math.min(size[1], Math.floor(value.y)));
  const width = Math.max(0, Math.min(size[0] - x, Math.floor(value.width)));
  const height = Math.max(0, Math.min(size[1] - y, Math.floor(value.height)));
  return width > 0 && height > 0 ? { x, y, width, height } : null;
}

function probe(url, cookie = '', redirects = 0) {
  return new Promise((resolve) => {
    const req = http.get(
      url,
      { timeout: 1500, headers: cookie ? { Cookie: cookie } : {} },
      (res) => {
        res.resume();
        if (
          [301, 302, 303, 307, 308].includes(res.statusCode) &&
          res.headers.location &&
          redirects < 3
        ) {
          const target = new URL(res.headers.location, url);
          if (target.origin !== url.origin) return resolve(false);
          const nextCookie =
            res.headers['set-cookie']?.map((value) => value.split(';')[0]).join('; ') || cookie;
          return resolve(probe(target, nextCookie, redirects + 1));
        }
        resolve(res.statusCode === 200);
      },
    );
    req.on('timeout', () => req.destroy());
    req.on('error', () => resolve(false));
  });
}

function registerEmbeddedIDE({
  app,
  ipcMain,
  dialog,
  win,
  trusted,
  WebContentsView,
  resourcesPath = process.resourcesPath,
}) {
  const directory = path.join(app.getPath('userData'), 'embedded-ide');
  const config = path.join(directory, 'runtime.json');
  let runtime,
    child,
    view,
    startPromise,
    baseURL,
    disposed = false;
  let state = {
    status: 'setup',
    message: 'Install a Code - OSS server-web engine to enable the integrated IDE.',
  };
  let generation = 0;
  async function detect() {
    if (runtime) return runtime;
    const roots = [path.join(resourcesPath, 'ide-runtime')];
    if (typeof app.getAppPath === 'function')
      roots.push(path.join(app.getAppPath(), 'ide-runtime'));
    try {
      roots.unshift(JSON.parse(await fs.readFile(config, 'utf8')).root);
    } catch {}
    for (const root of roots) {
      try {
        runtime = await inspectRuntime(root);
        break;
      } catch {}
    }
    return runtime;
  }
  const hide = () => view?.setVisible(false);
  function closeView() {
    if (!view) return;
    win.contentView.removeChildView(view);
    if (!view.webContents.isDestroyed()) view.webContents.close();
    view = null;
  }
  function terminateEngine() {
    if (!child) return;
    if (process.platform === 'win32' && child.pid) {
      const cleanup = spawn('taskkill.exe', ['/pid', String(child.pid), '/t', '/f'], {
        shell: false,
        windowsHide: true,
        stdio: 'ignore',
      });
      cleanup.on('error', () => {});
    } else {
      try {
        process.kill(-child.pid, 'SIGTERM');
      } catch {
        child.kill();
      }
    }
    child = null;
  }
  function stop() {
    generation++;
    closeView();
    terminateEngine();
    baseURL = null;
  }
  async function start() {
    if (disposed) throw Error('IDE has closed.');
    if (view && !view.webContents.isDestroyed() && baseURL && state.status === 'ready')
      return { ...state };
    if (startPromise) return startPromise;
    if (view || child) stop();
    startPromise = (async () => {
      const engine = await detect();
      if (!engine)
        throw Error(
          'Code - OSS engine is not installed. Choose the extracted server-web runtime folder.',
        );
      const current = ++generation;
      state = { status: 'starting', message: 'Starting local Code - OSS engine…' };
      await fs.mkdir(directory, { recursive: true });
      const token = randomBytes(32).toString('hex');
      const tokenFile = path.join(directory, 'connection-token');
      await fs.writeFile(tokenFile, token, { mode: 0o600 });
      const env = { ...process.env };
      delete env.ELECTRON_RUN_AS_NODE;
      delete env.NODE_OPTIONS;
      const processChild = spawn(
        engine.executable,
        [
          engine.entry,
          '--start-server',
          '--host=127.0.0.1',
          '--port=0',
          '--connection-token-file',
          tokenFile,
          '--server-data-dir',
          path.join(directory, 'data'),
          '--extensions-dir',
          path.join(directory, 'extensions'),
          '--telemetry-level=off',
        ],
        {
          cwd: engine.root,
          env,
          shell: false,
          windowsHide: true,
          detached: process.platform !== 'win32',
          stdio: ['ignore', 'pipe', 'pipe'],
        },
      );
      child = processChild;
      let output = '',
        failure;
      processChild.once('error', (e) => {
        failure = e.message;
      });
      processChild.once('exit', () => {
        failure ||= 'Code - OSS engine stopped.';
        if (current !== generation) return;
        baseURL = null;
        hide();
        state = { status: 'error', message: failure };
      });
      const capture = (data) => {
        output = (output + data.toString()).slice(-16384);
      };
      processChild.stdout.on('data', capture);
      processChild.stderr.on('data', capture);
      const deadline = Date.now() + 45000;
      let url;
      while (Date.now() < deadline && !failure && current === generation) {
        const port = agentPort(output);
        if (port) {
          url = new URL('http://127.0.0.1:' + port + '/');
          url.searchParams.set('tkn', token);
          if (await probe(url)) break;
          url = null;
        }
        await new Promise((resolve) => setTimeout(resolve, 150));
      }
      if (!url || failure || current !== generation)
        throw Error(failure || 'Code - OSS did not start within 45 seconds.');
      const ideView = new WebContentsView({
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          sandbox: true,
          webSecurity: true,
          partition: 'persist:ditasha-code-oss',
        },
      });
      view = ideView;
      view.setVisible(false);
      view.setBackgroundColor('#1e1e1e');
      const contents = view.webContents;
      contents.setWindowOpenHandler(() => ({ action: 'deny' }));
      const restrict = (event, target) => {
        try {
          if (new URL(target).origin === url.origin) return;
        } catch {}
        event.preventDefault();
      };
      contents.on('will-navigate', restrict);
      contents.on('will-redirect', restrict);
      contents.session.setPermissionRequestHandler((_c, _p, done) => done(false));
      contents.on('render-process-gone', () => {
        if (current !== generation) return;
        hide();
        state = { status: 'error', message: 'IDE renderer stopped. Restart DITASHA to recover.' };
      });
      win.contentView.addChildView(view);
      await contents.loadURL(url.href);
      if (current !== generation || failure) throw Error(failure || 'IDE startup canceled.');
      baseURL = url;
      state = { status: 'ready', message: 'Code - OSS is running locally inside DITASHA.' };
      return { ...state };
    })()
      .catch((error) => {
        stop();
        state = { status: 'error', message: error.message };
        throw error;
      })
      .finally(() => {
        startPromise = null;
      });
    return startPromise;
  }
  const actions = {
    async state() {
      await detect();
      return {
        ...state,
        message:
          runtime && state.status === 'setup' ? 'Local Code - OSS engine is ready.' : state.message,
        installed: !!runtime,
        runtime: runtime?.root || '',
      };
    },
    async choose() {
      if (child || startPromise) throw Error('Restart DITASHA before changing the IDE engine.');
      const choice = await dialog.showOpenDialog(win, {
        title: 'Choose Code - OSS server-web runtime',
        properties: ['openDirectory'],
      });
      if (choice.canceled || !choice.filePaths[0]) return actions.state();
      const selected = await inspectRuntime(choice.filePaths[0]);
      await fs.mkdir(directory, { recursive: true });
      await fs.writeFile(config, JSON.stringify({ root: selected.root }));
      runtime = selected;
      state = { status: 'setup', message: 'Engine ready. Start the integrated IDE.' };
      return actions.state();
    },
    start,
    layout(value) {
      if (!view || view.webContents.isDestroyed()) return;
      const factor = win.webContents.getZoomFactor();
      const scaled =
        value && Object.fromEntries(Object.entries(value).map(([key, val]) => [key, val * factor]));
      const bounds = clampBounds(scaled, win.getContentSize());
      if (!bounds) return hide();
      view.setBounds(bounds);
      view.setVisible(true);
    },
  };
  for (const [name, action] of Object.entries(actions))
    ipcMain.handle('ditasha:embedded-ide-' + name, async (event, value) => {
      trusted(event);
      return action(value);
    });
  win.on('resize', hide);
  win.on('closed', () => {
    disposed = true;
    stop();
  });
  app.on('will-quit', () => {
    disposed = true;
    stop();
  });
  async function requestClose() {
    if (!view || view.webContents.isDestroyed()) return true;
    const contents = view.webContents;
    return new Promise((resolve) => {
      const blocked = (event) => {
        const choice = dialog.showMessageBoxSync(win, {
          type: 'warning',
          buttons: ['Keep editing', 'Discard changes and close'],
          defaultId: 0,
          cancelId: 0,
          message: 'The IDE has unsaved changes.',
          detail:
            'Save your code in the IDE before closing DITASHA, or discard the unsaved changes.',
        });
        if (choice === 1) event.preventDefault();
        else {
          contents.removeListener('destroyed', done);
          resolve(false);
        }
      };
      const done = () => {
        contents.removeListener('will-prevent-unload', blocked);
        resolve(true);
      };
      contents.once('will-prevent-unload', blocked);
      contents.once('destroyed', done);
      contents.close({ waitForBeforeUnload: true });
    });
  }
  return { hide, requestClose };
}
module.exports = { registerEmbeddedIDE, inspectRuntime, agentPort, clampBounds };
