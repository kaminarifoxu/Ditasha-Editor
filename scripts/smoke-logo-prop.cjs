'use strict';
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs/promises'),
  path = require('node:path');
app.whenReady().then(async () => {
  let win;
  try {
    win = new BrowserWindow({
      width: 1500,
      height: 950,
      show: true,
      webPreferences: {
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        backgroundThrottling: false,
      },
    });
    await win.loadFile(path.resolve('ui/index.html'));
    const { logoPropFixture } = await import('../tests/fixtures/logo-prop.mjs');
    const result = await win.webContents.executeJavaScript(
      '(' +
        require('./logo-prop-ui-checks.cjs').toString() +
        ')(' +
        JSON.stringify([...logoPropFixture().png]) +
        ')',
    );
    require('../electron/native-build.cjs').validateJob(result.nativePayload);
    await fs.mkdir('release/qa', { recursive: true });
    for (const width of [1500, 1100, 850]) {
      win.setSize(width, 900);
      await new Promise((r) => setTimeout(r, 200));
      await fs.writeFile(
        'release/qa/logo-prop-' + width + '.png',
        (await win.webContents.capturePage()).toPNG(),
      );
    }
    await fs.writeFile('release/qa/logo-prop-result.json', JSON.stringify(result.report, null, 2));
    console.log('PASS_LOGO_UI', JSON.stringify(result.report));
    app.exit(0);
  } catch (e) {
    console.error(e);
    app.exit(1);
  }
});
