'use strict';
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs/promises'),
  os = require('node:os'),
  path = require('node:path');
app.whenReady().then(async () => {
  let win;
  try {
    const { boothGlbFixture } = await import('../tests/fixtures/booth-glb.mjs');
    const { boothYcdFixture } = await import('../tests/fixtures/booth-ycd.mjs');
    const { viewerModel } = await import('../tests/viewer-format.test.mjs');
    const { testYtd } = await import('../tests/format.test.mjs');
    const { zipFiles } = await import('../src/asset-tools.js');
    const data = {
      ped: [...new Uint8Array(await boothGlbFixture())],
      model: [...new Uint8Array(viewerModel)],
      ytd: [...new Uint8Array(testYtd)],
      zip: [
        ...zipFiles([
          { name: 'stream/test.ycd', data: new Uint8Array(boothYcdFixture()) },
          {
            name: 'client/list.lua',
            data: new TextEncoder().encode('error("must never execute")'),
          },
        ]),
      ],
    };
    const partition = 'persist:character-workshops-' + Date.now();
    const create = () =>
      new BrowserWindow({
        width: 1500,
        height: 950,
        show: true,
        webPreferences: {
          partition,
          contextIsolation: true,
          sandbox: true,
          nodeIntegration: false,
          backgroundThrottling: false,
        },
      });
    await fs.mkdir(path.resolve('release/qa'), { recursive: true });
    win = create();
    const captures = [];
    win.webContents.on('console-message', (_event, ...args) => {
      const text = args
        .map((a) => (typeof a === 'string' ? a : a?.message))
        .find((a) => a?.startsWith('DITASHA_SNAPSHOT:character-'));
      if (text)
        captures.push(
          win.webContents
            .capturePage()
            .then((img) =>
              fs.writeFile(path.resolve('release/qa/' + text.split(':')[1] + '.png'), img.toPNG()),
            ),
        );
    });
    await win.loadFile(path.resolve('ui/index.html'));
    const check = require('./character-workshop-ui-checks.cjs');
    const result = await win.webContents.executeJavaScript(
      '(' + check.toString() + ')(' + JSON.stringify(data) + ')',
    );
    require('../electron/native-build.cjs').validateJob(result.headPayload);
    for (const width of [1500, 1100, 850]) {
      win.setSize(width, 950);
      await new Promise((r) => setTimeout(r, 200));
      await fs.writeFile(
        path.resolve('release/qa/character-workshop-' + width + '.png'),
        (await win.webContents.capturePage()).toPNG(),
      );
    }
    await Promise.all(captures);
    win.destroy();
    win = create();
    await win.loadFile(path.resolve('ui/index.html'));
    const restored = await win.webContents.executeJavaScript(
      '(' + check.toString() + ')(' + JSON.stringify({ ...data, restoreOnly: true }) + ')',
    );
    await fs.writeFile(
      path.resolve('release/qa/character-workshops-result.json'),
      JSON.stringify({ ...result.report, ...restored }),
    );
    console.log('PASS_CHARACTER_WORKSHOPS', result.report, restored);
    win.destroy();
    app.exit(0);
  } catch (error) {
    console.error(error);
    if (win && !win.isDestroyed()) {
      await fs
        .writeFile(
          path.resolve('release/qa/character-workshops-failure.png'),
          (await win.webContents.capturePage()).toPNG(),
        )
        .catch(() => {});
      win.destroy();
    }
    app.exit(1);
  }
});
