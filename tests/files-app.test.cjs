'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createFilesApp } = require('../electron/files-app.cjs');
test('Native Files uses its registered command protocol with an encoded directory, never a shell', async () => {
  const urls = [];
  const files = createFilesApp({
    platform: 'win32',
    app: { getApplicationNameForProtocol: (p) => (p === 'files-stable:' ? 'Files' : '') },
    shell: { openExternal: async (url) => urls.push(url) },
  });
  assert.equal(files.state().available, true);
  await files.open('C:\\Assets & photos\\neck = 2K');
  const url = new URL(urls[0]);
  assert.equal(url.protocol, 'files-stable:');
  assert.equal(
    url.searchParams.get('cmd'),
    'files-stable.exe -Directory "C:\\Assets & photos\\neck = 2K"',
  );
  await assert.rejects(files.open('C:\\bad" -Select x'), /tidak valid/);
});
test('Files absence does not start a protocol chooser or download until explicitly requested', async () => {
  const urls = [];
  const files = createFilesApp({
    platform: 'win32',
    app: { getApplicationNameForProtocol: () => '' },
    shell: { openExternal: async (url) => urls.push(url) },
  });
  assert.equal(files.state().available, false);
  await assert.rejects(files.open('C:\\Assets'), /belum terpasang/);
  assert.equal(urls.length, 0);
  await files.download();
  assert.deepEqual(urls, ['https://files.community/download']);
  assert.equal(
    createFilesApp({
      platform: 'linux',
      app: {
        getApplicationNameForProtocol: () => {
          throw Error('wrong platform');
        },
      },
    }).state().supported,
    false,
  );
});
