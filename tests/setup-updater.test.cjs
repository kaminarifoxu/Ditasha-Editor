const { test } = require('node:test');
const assert = require('node:assert/strict');
const { releaseInfo, createPortableUpdater } = require('../electron/updater.cjs');
const { setupScript } = require('../electron/setup-updater.cjs');
const fs = require('node:fs/promises'),
  os = require('node:os'),
  path = require('node:path'),
  crypto = require('node:crypto');
test('installed and portable clients never select each other’s payload; Setup is verified', async (t) => {
  const bytes = Buffer.concat([Buffer.from('MZ'), Buffer.alloc(2048, 3)]);
  const hash = crypto.createHash('sha256').update(bytes).digest('hex');
  const asset = (name) => ({
    name,
    state: 'uploaded',
    size: bytes.length,
    digest: 'sha256:' + hash,
    browser_download_url:
      'https://github.com/kaminarifoxu/Ditasha-Editor/releases/download/v9.0.0/' + name,
  });
  const meta = {
    tag_name: 'v9.0.0',
    assets: [asset('DITASHA-Editor.exe'), asset('DITASHA-Setup.exe')],
  };
  assert.equal(releaseInfo(meta, '1.0.0').name, 'DITASHA-Editor.exe');
  assert.equal(releaseInfo(meta, '1.0.0', { installed: true }).name, 'DITASHA-Setup.exe');
  assert.throws(() =>
    releaseInfo({ ...meta, assets: [meta.assets[0]] }, '1.0.0', { installed: true }),
  );
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'ditasha-setup-unit-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const urls = [];
  const updater = createPortableUpdater({
    version: '1.0.0',
    installed: true,
    directory,
    fetcher: async (url) => {
      urls.push(url);
      return url.endsWith('/latest') ? new Response(JSON.stringify(meta)) : new Response(bytes);
    },
  });
  await updater.setAutoDownload(true);
  assert.equal((await updater.check()).status, 'ready');
  assert.equal(updater.getState().installed, true);
  assert(urls.at(-1).endsWith('/DITASHA-Setup.exe'));
  assert.deepEqual(await fs.readFile(updater.getReadyPath()), bytes);
});
test('Setup helper waits for editor, quotes paths, reports installer failure and uses force-run', () => {
  const script = setupScript({
    target: "C:\\User's Editor\\DITASHA-Editor.exe",
    staged: 'C:\\Cache\\update.exe',
    parentPid: 123,
    logPath: 'C:\\Cache\\install.json',
  });
  assert(script.includes("C:\\User''s Editor"));
  assert(script.indexOf('while (Get-Process -Id 123') < script.indexOf('$setup = Start-Process'));
  assert(script.includes("'/S','--force-run'"));
  assert(script.includes('$setup.ExitCode -ne 0'));
  assert.throws(() => setupScript({ parentPid: NaN }));
});
