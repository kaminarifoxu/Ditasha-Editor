'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const { createGtaTools, digest } = require('../electron/gta-tools.cjs');
(async () => {
  if (process.platform !== 'win32') throw Error('This real engine check runs on Windows.');
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'ditasha-gta-real-'));
  try {
    const tools = createGtaTools({
      root: path.join(temp, 'tools'),
      notify: (s) => {
        if (s.log) process.stdout.write(s.log.slice(-400).split('\n').at(-2) + '\n');
      },
    });
    await tools.install('weapons', null, { download: true });
    const { testYdr, testYtd } = await import('../tests/format.test.mjs');
    const source = path.join(temp, 'source'),
      output = path.join(temp, 'output');
    await fs.mkdir(source);
    await fs.mkdir(output);
    const model = path.join(source, 'w_pi_pistol.ydr'),
      texture = path.join(source, 'w_pi_pistol.ytd');
    await fs.writeFile(model, new Uint8Array(testYdr));
    await fs.writeFile(texture, new Uint8Array(testYtd));
    const hashes = [await digest(model), await digest(texture)];
    await tools.run('weapons', 'scan', {}, source, null);
    assert((await tools.state()).log.includes('PISTOL'));
    await tools.run('weapons', 'plan', { name: 'Ditasha native test', price: 4500 }, source, null);
    const built = await tools.run(
      'weapons',
      'build',
      { name: 'Ditasha native test', model: 'ditasha_test_pistol', price: 4500, edition: 'legacy' },
      source,
      output,
    );
    assert.equal(built.success, true);
    const found = [];
    async function walk(dir) {
      for (const e of await fs.readdir(dir, { withFileTypes: true })) {
        const f = path.join(dir, e.name);
        if (e.isDirectory()) await walk(f);
        else found.push(f);
      }
    }
    await walk(built.output);
    const dlc = found.find((f) => path.basename(f).toLowerCase() === 'dlc.rpf');
    assert(dlc, 'Native weapon engine did not produce dlc.rpf');
    const bytes = await fs.readFile(dlc);
    assert.equal(bytes.readUInt32LE(0), 0x52504637);
    const { openArchive } = await import('../src/archives.js');
    const archive = await openArchive(new Blob([bytes]), 'dlc.rpf');
    assert(
      archive.entries.some((e) => /content.xml$/i.test(e.path || e.name)),
      'DLC content.xml missing',
    );
    assert.deepEqual([await digest(model), await digest(texture)], hashes);
    const report = {
      officialPackageDownload: true,
      checksum: true,
      realCliScan: true,
      realCliPlan: true,
      realCliBuild: true,
      dlcRpfBytes: bytes.length,
      dlcEntries: archive.entries.length,
      sourceUnchanged: true,
    };
    await fs.mkdir('release/qa', { recursive: true });
    await fs.writeFile('release/qa/gta-tools-native-result.json', JSON.stringify(report, null, 2));
    console.log('PASS real AddonWeaponsBuilder: ' + JSON.stringify(report));
  } finally {
    await fs.rm(temp, { recursive: true, force: true });
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
