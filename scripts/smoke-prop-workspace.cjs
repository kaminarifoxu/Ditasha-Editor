'use strict';
const { app, BrowserWindow } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');
async function verify() {
  for (let i = 0; i < 100; i++) {
    if (document.querySelector('[data-page="propcreator"]') &&
        document.querySelector('.prop-creator-workspace')) break;
    await new Promise(resolve => setTimeout(resolve, 80));
  }
  const button = document.querySelector('[data-page="propcreator"]');
  if (!button) throw Error('Prop Creator sidebar button is missing');
  button.click();
  await new Promise(resolve => setTimeout(resolve, 900));
  const root = document.querySelector('.prop-creator-workspace');
  const editor = document.querySelector('main');
  if (!root || root.hidden || !editor.hidden ||
      document.body.dataset.workspace !== 'propcreator')
    throw Error('Prop Creator did not switch to an isolated workspace');
  const canvas = root.querySelector('[data-prop-viewport] canvas');
  if (!canvas || canvas.clientWidth < 100 || canvas.clientHeight < 100)
    throw Error('Dedicated large 3D viewport missing');
  const input = root.querySelector('[data-prop-file]');
  if (!input) throw Error('Prop model importer missing');
  const obj = [
    'o testcrate', 'v 0 0 0', 'v 1 0 0', 'v 0 1 0',
    'vt 0 0', 'vt 1 0', 'vt 0 1', 'f 1/1 2/2 3/3',
  ].join('\n');
  const file = new File([obj], 'testcrate.obj', { type: 'text/plain' });
  const transfer = new DataTransfer();
  transfer.items.add(file);
  input.files = transfer.files;
  input.dispatchEvent(new Event('change', { bubbles: true }));
  for (let i = 0; i < 80; i++) {
    if (root.querySelector('[data-prop-meshes]')?.textContent === '1') break;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  if (root.querySelector('[data-prop-meshes]').textContent !== '1')
    throw Error('Dedicated OBJ model importer did not load the mesh');
  document.querySelector('[data-page="editor"]').click();
  if (!root.hidden || editor.hidden || document.body.dataset.workspace !== 'editor')
    throw Error('Texture & Model workspace did not restore correctly');
  button.click();
  if (root.hidden || !editor.hidden)
    throw Error('Prop Creator workspace did not reopen');
  return { passed: true, viewport: [canvas.clientWidth, canvas.clientHeight], objMeshes: 1, switching: true };
}
async function main() {
  await app.whenReady();
  const win = new BrowserWindow({
    width: 1440, height: 900, show: true,
    webPreferences: {
      partition: 'persist:prop-creator-smoke-' + Date.now(),
      contextIsolation: true, sandbox: true, nodeIntegration: false,
      backgroundThrottling: false,
    },
  });
  try {
    await win.loadFile(path.resolve('ui/index.html'));
    const outcome = await win.webContents.executeJavaScript('(' + verify.toString() + ')()');
    await fs.mkdir(path.resolve('release/qa'), { recursive: true });
    await fs.writeFile(path.resolve('release/qa/prop-creator-workspace.png'), (await win.webContents.capturePage()).toPNG());
    console.log(JSON.stringify(outcome));
  } finally {
    win.destroy();
    app.quit();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; app.quit(); });
