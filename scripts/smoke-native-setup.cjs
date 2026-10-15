// Exercise the same automatic installer and persisted profile used by the app.
const { app } = require('electron');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const { registerNativeBuild } = require('../electron/native-build.cjs');
app.whenReady().then(async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ditasha-setup-smoke-'));
  const handlers = new Map();
  const register = () =>
    registerNativeBuild({
      app: { getPath: () => root, on: () => {} },
      ipcMain: { handle: (name, fn) => handlers.set(name, fn) },
      trusted: (event) => assert.equal(event, 'trusted'),
      dialog: {},
      shell: {},
    });
  const call = (name, value) => handlers.get('ditasha:native-' + name)('trusted', value);
  const wait = async () => {
    const deadline = Date.now() + 25 * 60 * 1000;
    let state;
    let previous = '';
    do {
      state = await call('state');
      if (state.message !== previous) {
        console.log(state.message);
        previous = state.message;
      }
      if (!state.running) return state;
      if (Date.now() > deadline) {
        await call('cancel');
        throw Error('Native setup timed out.');
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } while (true);
  };
  try {
    register();
    await call('setup');
    let state = await wait();
    if (state.status !== 'success') throw Error(state.message + '\n' + state.log);
    // Register a fresh instance to verify the saved path and enabled add-ons survive restart.
    register();
    await call('start', { mode: 'probe' });
    state = await wait();
    if (state.status !== 'success') throw Error(state.message + '\n' + state.log);
    assert(state.report.engine.sollumz, 'Sollumz is not enabled.');
    assert(state.report.engine.native, 'Native szio/PyMateria is unavailable.');
    assert(state.report.engine.muto, 'Muto is not enabled.');
    console.log(
      'PASS: automatic download, checksum, isolated Blender profile, native dependencies, enabled Muto and persistent setup.',
    );
    app.exit(0);
  } catch (error) {
    console.error(error.stack);
    app.exit(1);
  }
});
