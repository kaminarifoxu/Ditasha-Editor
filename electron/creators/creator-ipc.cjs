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
  // Explicit developer-only opt-in. Production creator flags remain disabled.
  // A real export is never treated as valid without binary inspection/reimport.
  const experimentalNative = process.env.DITASHA_EXPERIMENTAL_PROP_NATIVE === '1';
  const registry = createRegistry({
    flags: { prop: experimentalNative || process.env.DITASHA_EXPERIMENTAL_PROP_PREVIEW === '1' },
    capabilities: { prop: { ready: experimentalNative } },
  });
  if (experimentalNative) registry.register('prop', buildPropResource);
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
      if (!cap.sollumzLoaded || !cap.importer) throw Error('Managed Blender/Sollumz importer is not ready');
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
