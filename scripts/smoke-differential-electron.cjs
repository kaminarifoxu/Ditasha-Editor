'use strict';
const { app, net } = require('electron');
app
  .whenReady()
  .then(async () => {
    // The production updater uses Chromium's network stack, not Node fetch.
    globalThis.fetch = (...args) => net.fetch(...args);
    await require('./smoke-differential-update.cjs').run();
    app.quit();
  })
  .catch((error) => {
    console.error(error);
    app.exit(1);
  });
