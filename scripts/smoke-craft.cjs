'use strict';
const {
  app,
  BrowserWindow,
  WebContentsView,
  ipcMain,
  protocol,
  session,
  net,
} = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'ditasha-craft',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
app.whenReady().then(async () => {
  let win, temp, savePath, engines;
  const report = [];
  const timeout = setTimeout(() => {
    console.error('Creative engines timed out');
    app.exit(1);
  }, 540000);
  try {
    temp = await fs.mkdtemp(path.join(os.tmpdir(), 'ditasha-craft-smoke-'));
    // Test data belongs to this smoke run, not the normal application profile.
    app.setPath('userData', temp);
    win = new BrowserWindow({
      width: 1500,
      height: 950,
      show: true,
      webPreferences: {
        sandbox: true,
        contextIsolation: true,
        preload: path.resolve('electron/preload.cjs'),
        backgroundThrottling: false,
      },
    });
    const { registerCraftEngines } = require('../electron/craft-engines.cjs');
    const runtime = process.env.DITASHA_CRAFT_RUNTIME || path.resolve('craft-runtime');
    engines = registerCraftEngines({
      app,
      ipcMain,
      protocol,
      session,
      net,
      win,
      WebContentsView,
      root: runtime,
      trusted: (e) => assert.equal(e.sender, win.webContents),
      dialog: {
        showSaveDialogSync: () => savePath,
        showMessageBox: async () => ({ response: 1 }),
      },
    });
    // Other desktop services have their own smoke checks. Keep them quiet in this focused engine test.
    ipcMain.handle('ditasha:embedded-ide-state', () => ({
      installed: false,
      status: 'idle',
      message: 'IDE is tested separately.',
    }));
    ipcMain.handle('ditasha:embedded-ide-layout', () => null);
    ipcMain.handle('ditasha:discord-workspace', () => null);
    ipcMain.handle('ditasha:discord-project', () => null);
    ipcMain.handle('gano:update-state', () => ({ status: 'idle', autoDownload: false }));
    await win.loadFile(path.resolve('ui/index.html'));
    await fs.mkdir(path.resolve('release/qa'), { recursive: true });
    async function capture(name) {
      await sleep(400);
      await fs.writeFile(
        path.resolve('release/qa/' + name + '.png'),
        (await win.webContents.capturePage()).toPNG(),
      );
    }
    await capture('creative-home');
    const sizes = [
      [1500, 950],
      [1024, 768],
      [800, 600],
    ];
    for (const [w, h] of sizes) {
      win.setSize(w, h);
      await sleep(150);
      await win.webContents.executeJavaScript(
        `(()=>{document.getElementById('openHome').click();const h=document.querySelector('.home-workspace');if(h.scrollWidth>h.clientWidth+1)throw Error('Home overflow');if(document.querySelectorAll('.home-suite-card').length!==9)throw Error('Missing creative studios');return true;})()`,
      );
      await capture('creative-home-' + w);
    }
    win.setSize(1500, 950);
    const records = await engines.state();
    assert.equal(records.length, 9);
    assert.ok(records.every((r) => r.installed));
    for (const item of records) {
      await win.webContents.executeJavaScript(
        `document.querySelector('[data-page="craft-${item.id}"]').click()`,
      );
      const end = Date.now() + 60000;
      while (!engines.views.has(item.id) && Date.now() < end) await sleep(100);
      assert.ok(engines.views.has(item.id), 'No view for ' + item.id);
      const entry = engines.views.get(item.id),
        contents = entry.view.webContents;
      const logs = [];
      contents.on('console-message', (_event, ...args) =>
        logs.push(
          args
            .map((a) => (typeof a === 'string' ? a : a?.message))
            .filter(Boolean)
            .join(' '),
        ),
      );
      let boot;
      while (Date.now() < end) {
        try {
          boot = await contents.executeJavaScript(
            `(()=>{const c=document.querySelector('canvas');const l=document.querySelector('[id$="_loading"],#loading');return {secure:isSecureContext,isolated:crossOriginIsolated,canvas:!!c&&c.width>0&&c.height>0,loading:!!l&&getComputedStyle(l).display!=='none'&&getComputedStyle(l).visibility!=='hidden',message:l?.textContent,film:window.filmcraftLoad,effect:window.effectcraftLoad};})()`,
          );
          if (boot.canvas && !boot.loading) break;
        } catch {}
        await sleep(250);
      }
      assert.ok(
        boot?.canvas && !boot.loading,
        item.id + ' failed to boot: ' + JSON.stringify({ boot, logs: logs.slice(-12) }),
      );
      assert.ok(boot.secure, item.id + ' is not a secure context');
      assert.ok(boot.isolated, item.id + ' lacks cross-origin isolation');
      assert.equal(entry.error, '');
      assert.ok(
        entry.view.getBounds().width > 300,
        item.id + ' child view is not laid out inside the host',
      );
      const blocked = await contents.executeJavaScript(
        `fetch('https://example.com/ditasha-network-probe').then(()=>false,()=>true)`,
      );
      assert.ok(blocked, 'Engine can access external services');
      await contents.executeJavaScript(`localStorage.setItem('ditasha.smoke','${item.id}')`);
      // The editor canvas must actually render pixels, rather than only remove a loader.
      await sleep(700);
      const image = await contents.capturePage();
      const pixels = image.toBitmap(),
        colors = new Set();
      for (let i = 0; i < pixels.length; i += 4 * 41)
        colors.add(pixels.subarray(i, i + 3).toString('hex'));
      assert.ok(
        colors.size > 15,
        item.id + ' rendered a blank canvas (' + colors.size + ' colors)',
      );
      let imageRoundTrip;
      if (item.id === 'photocraft')
        imageRoundTrip = await require('./craft-photo-check.cjs')({
          contents,
          host: win.webContents,
          temp,
          setSavePath: (value) => {
            savePath = value;
          },
        });
      await fs.writeFile(path.resolve('release/qa/engine-' + item.id + '.png'), image.toPNG());
      await capture('creative-' + item.id);
      // Returning to the hub must retain the live document and hide the child view.
      await win.webContents.executeJavaScript(`document.getElementById('openHome').click()`);
      await sleep(100);
      assert.ok(engines.views.get(item.id).view === entry.view);
      await win.webContents.executeJavaScript(
        `document.querySelector('[data-page="craft-${item.id}"]').click()`,
      );
      await sleep(200);
      assert.equal(
        await contents.executeJavaScript(`localStorage.getItem('ditasha.smoke')`),
        item.id,
      );
      report.push({
        id: item.id,
        version: item.version,
        boot: true,
        secure: boot.secure,
        isolated: boot.isolated,
        colors: colors.size,
        offline: true,
        retained: true,
        ...(imageRoundTrip ? { imageRoundTrip } : {}),
      });
      console.log('PASS engine: ' + JSON.stringify(report.at(-1)));
      // Release memory between engine checks, like an explicit user Close engine action.
      await win.webContents.executeJavaScript(
        `document.querySelector('[data-craft="close"]').click()`,
      );
      while (engines.views.has(item.id) && Date.now() < end) await sleep(100);
      assert.ok(!engines.views.has(item.id), 'Close engine failed');
    }
    await fs.writeFile(
      path.resolve('release/qa/creative-engines-result.json'),
      JSON.stringify(report, null, 2),
    );
    console.log('PASS: all nine local creative engines');
    clearTimeout(timeout);
    win.destroy();
    await fs.rm(temp, { recursive: true, force: true }).catch(() => {});
    app.exit(0);
  } catch (e) {
    console.error(e);
    for (const [id, entry] of engines?.views || []) {
      await fs
        .writeFile(
          path.resolve('release/qa/engine-failure-' + id + '.png'),
          (await entry.view.webContents.capturePage()).toPNG(),
        )
        .catch(() => {});
    }
    clearTimeout(timeout);
    if (win && !win.isDestroyed()) {
      await fs
        .writeFile(
          path.resolve('release/qa/creative-failure.png'),
          (await win.webContents.capturePage()).toPNG(),
        )
        .catch(() => {});
      win.destroy();
    }
    app.exit(1);
  }
});
