'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { ciFetcher } = require('../electron/update-probe.cjs');

test('CI release probe authenticates metadata only and preserves request options', async () => {
  const calls = [];
  const fetcher = ciFetcher(async (url, options) => {
    calls.push({ url, options });
    return 'ok';
  }, 'test-only-token');
  const signal = AbortSignal.timeout(1000);
  assert.equal(
    await fetcher('https://api.github.com/repos/kaminarifoxu/Ditasha-Editor/releases/latest', {
      headers: { Accept: 'application/vnd.github+json' },
      signal,
    }),
    'ok',
  );
  assert.equal(calls[0].options.headers.Authorization, 'Bearer test-only-token');
  assert.equal(calls[0].options.headers.Accept, 'application/vnd.github+json');
  assert.equal(calls[0].options.signal, signal);
  for (const url of [
    'https://github.com/kaminarifoxu/Ditasha-Editor/releases/download/v1.0.0/app.exe',
    'https://release-assets.githubusercontent.com/asset.exe',
    'https://api.github.com/repos/someone/other/releases/latest',
    'https://api.github.com.evil.example/repos/kaminarifoxu/Ditasha-Editor/releases/latest',
    'http://api.github.com/repos/kaminarifoxu/Ditasha-Editor/releases/latest',
  ]) {
    await fetcher(url);
    assert.equal(calls.at(-1).options.headers.Authorization, undefined, url);
  }
});
test('CI release probe works without a token outside the CI environment', async () => {
  const fetcher = ciFetcher(async (_url, options) => options.headers);
  assert.deepEqual(
    await fetcher('https://api.github.com/repos/kaminarifoxu/Ditasha-Editor/releases/latest'),
    {},
  );
});
