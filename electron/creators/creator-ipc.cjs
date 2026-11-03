'use strict';
const { createRegistry } = require('./registry.cjs');
const { createJobManager } = require('./job-manager.cjs');
const { createAssetTokens } = require('./asset-tokens.cjs');
function registerCreators({ ipcMain, trusted, app, dialog, win }) {
  if (!ipcMain || typeof ipcMain.handle !== 'function' || typeof trusted !== 'function') throw Error('Creator IPC dependencies missing');
  // M0 is foundation-only. No native creator handlers or UI controls are enabled.
  const registry = createRegistry();
  const jobs = createJobManager();
  const grants = createAssetTokens();
  ipcMain.handle('ditasha:creators-state', event => {
    trusted(event);
    return registry.describe();
  });
  async function pick(event, kind) {
    trusted(event);
    if (!registry.available('prop')) throw Error('Prop creator disabled');
    if (kind !== 'input' && kind !== 'output') throw Error('Invalid asset selection');
    if (!dialog || !win) throw Error('Asset picker unavailable');
    const chosen = await dialog.showOpenDialog(win, {
      title: kind === 'input' ? 'Select prop source' : 'Select prop export directory',
      properties: kind === 'input' ? ['openFile'] : ['openDirectory'],
      ...(kind === 'input' ? { filters: [{ name: 'Prop models', extensions: ['glb','obj','fbx'] }] } : {}),
    });
    if (chosen?.canceled || chosen?.filePaths?.length !== 1) return null;
    return grants.issue({ kind, selectedPath: chosen.filePaths[0] });
  }
  ipcMain.handle('ditasha:prop-pick', pick);
  ipcMain.handle('ditasha:prop-revoke', (event, token) => {
    trusted(event);
    if (!registry.available('prop')) throw Error('Prop creator disabled');
    return grants.revoke(token);
  });
  if (app && typeof app.on === 'function') app.on('before-quit', () => { jobs.close(); grants.clear(); });
  return Object.freeze({ registry, jobs, grants });
}
module.exports = { registerCreators };
