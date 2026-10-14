// Optional local QA runner; playwright-core and @sparticuz/chromium are not app dependencies.
const path = require('node:path');
const fs = require('node:fs/promises');
(async () => {
  const chromium = require('@sparticuz/chromium').default;
  let executablePath;
  try {
    executablePath = await chromium.executablePath();
  } catch {
    executablePath = '/tmp/chromium';
  }
  const browser = await require('playwright-core').chromium.launch({
    executablePath,
    args: [...chromium.args, '--allow-file-access-from-files'],
    headless: true,
  });
  const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
  page.on('pageerror', (e) => console.error('PAGE ERROR', e));
  await page.addInitScript(() => {
    window.ditashaDesktop = {};
  });
  await page.goto('file://' + path.resolve('ui/index.html'));
  await page.waitForFunction(() => !!window.ditashaWorkspace);
  const { viewerModel } = await import('../tests/viewer-format.test.mjs');
  const { testYtd } = await import('../tests/format.test.mjs');
  const { writeRpf } = await import('../src/archives.js');
  const model = new Uint8Array(viewerModel).slice();
  const header = new DataView(model.buffer);
  header.setUint32(8, (header.getUint32(8, true) & 0x0fffffff) | 0xa0000000, true);
  header.setUint32(12, (header.getUint32(12, true) & 0x0fffffff) | 0x50000000, true);
  const archive = writeRpf([
    { name: 'car.ydd', data: model },
    { name: 'car.ytd', data: new Uint8Array(testYtd) },
    { name: 'alternate.ytd', data: new Uint8Array(testYtd) },
    { name: 'fxmanifest.lua', data: new TextEncoder().encode('fx_version "cerulean"\r\n') },
  ]);
  await fs.mkdir('release/qa', { recursive: true });
  const captures = [];
  page.on('console', (msg) => {
    if (msg.text().startsWith('DITASHA_SNAPSHOT:'))
      captures.push(page.screenshot({ path: 'release/qa/' + msg.text().split(':')[1] + '.png' }));
  });
  try {
    const report = await page.evaluate(
      '(' +
        require('./explorer-preview-ui-checks.cjs').toString() +
        ')(' +
        JSON.stringify({ archive: [...archive] }) +
        ')',
    );
    const { openArchive } = await import('../src/archives.js');
    const saved = report.saves.find((s) => s.name.endsWith('.rpf'));
    const result = await openArchive(new Blob([new Uint8Array(saved.data)]), saved.name);
    const entry = result.entries.find((e) => e.name === 'fxmanifest.lua');
    if (!new TextDecoder().decode(await result.extract(entry)).includes('-- edited offline'))
      throw Error('RPF round trip lost code edits');
    console.log('PASS inline Explorer + offline Monaco + edited RPF round trip');
  } catch (e) {
    await page.screenshot({ path: 'release/qa/explorer-failure.png' });
    throw e;
  } finally {
    await Promise.all(captures);
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
