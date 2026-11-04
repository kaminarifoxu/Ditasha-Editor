'use strict';
const { createRegistry } = require('./registry.cjs');
const { createJobManager } = require('./job-manager.cjs');
const { createAssetTokens } = require('./asset-tokens.cjs');
const { buildPropResource } = require('./prop-build.cjs');
const { probeInstalledPropProvider } = require('./prop-provider.cjs');
const { validatePropRequest } = require('./prop-schema.cjs');
const path = require('node:path');
function registerCreators({ ipcMain, trusted, app, dialog, win }) {
  if (!ipcMain || typeof ipcMain.handle !== 'function' || typeof trusted !== 'function') throw Error('Creator IPC dependencies missing');
  // The button and export request are available without a launch flag.
  // This only enables the guarded *attempt*; real provider checks and native
  // round trips still gate creation of any output files.
  const registry = createRegistry({
    flags: { prop: true },
    capabilities: { prop: { ready: true } },
  });
  registry.register('prop', buildPropResource);
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
  ipcMain.handle('ditasha:prop-deps', async event => {
    trusted(event);
    const root = path.join(app.getPath('userData'), 'native-tools');
    try {
      const { managedExecutable } = require('./prop-build.cjs');
      await managedExecutable(root);
      const cap = await probeInstalledPropProvider({ root });
      return { installed: true, usable: Boolean(cap.importer && cap.sollumzLoaded && cap.nativeProviderAvailable),
        reason: cap.importer && cap.sollumzLoaded && cap.nativeProviderAvailable
          ? 'Blender and Sollumz detected. Native export is experimental; in-game validation is still required.'
          : 'Sollumz importer is missing or incomplete. Install the managed native tools.',
        blenderVersion: cap.blenderVersion };
    } catch (error) {
      return { installed: false, usable: false,
        reason: 'Managed Blender/Sollumz unavailable: ' + String(error.message || error).slice(0, 240) };
    }
  });
  ipcMain.handle('ditasha:prop-pick', pick);
  ipcMain.handle('ditasha:prop-revoke', (event, token) => {
    trusted(event);
    if (!registry.available('prop')) throw Error('Prop creator disabled');
    return grants.revoke(token);
  });
  ipcMain.handle('ditasha:prop-start', async (event, request) => {
    trusted(event);
    if (!registry.available('prop')) throw Error('Prop native export disabled');
    const validated = validatePropRequest(request);
    // Resolve both scopes before accepting the job, then again after conversion.
    await grants.resolve(validated.sourceToken, 'input');
    await grants.resolve(validated.outputToken, 'output');
    const root = path.join(app.getPath('userData'), 'native-tools');
    const job = jobs.submit('prop', async ({ signal }) => {
      const cap = await probeInstalledPropProvider({ root, signal });
      if (!cap.sollumzLoaded || !cap.importer || !cap.nativeProviderAvailable)
        throw Error('Managed Blender/Sollumz/PyMateria native provider is not ready');
      return registry.get('prop')({ request: validated, tokens: grants, providerRoot: root, signal });
    });
    return { jobId: job.id };
  });
  ipcMain.handle('ditasha:prop-job', (event, id) => {
    trusted(event);
    if (!registry.available('prop')) throw Error('Prop native export disabled');
    const current = jobs.snapshot(id);
    return current ? { ...current, result: jobs.result(id) } : null;
  });
  ipcMain.handle('ditasha:prop-cancel', (event, id) => {
    trusted(event);
    if (!registry.available('prop')) throw Error('Prop native export disabled');
    return jobs.cancel(id);
  });
  if (app && typeof app.on === 'function') app.on('before-quit', () => { jobs.close(); grants.clear(); });
  return Object.freeze({ registry, jobs, grants });
}
module.exports = { registerCreators };
