'use strict';
const { createRegistry } = require('./registry.cjs');
const { createJobManager } = require('./job-manager.cjs');
function registerCreators({ ipcMain, trusted, app }) {
  if (!ipcMain || typeof ipcMain.handle !== 'function' || typeof trusted !== 'function') throw Error('Creator IPC dependencies missing');
  // M0 is foundation-only. No native creator handlers or UI controls are enabled.
  const registry = createRegistry();
  const jobs = createJobManager();
  ipcMain.handle('ditasha:creators-state', event => {
    trusted(event);
    return registry.describe();
  });
  if (app && typeof app.on === 'function') app.on('before-quit', () => jobs.close());
  return Object.freeze({ registry, jobs });
}
module.exports = { registerCreators };
