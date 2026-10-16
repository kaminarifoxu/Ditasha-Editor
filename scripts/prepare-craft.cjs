'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { createHash } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const specs = require('../config/craft-engines.json');
const root = path.resolve(__dirname, '../craft-runtime');
async function prepare(spec) {
  const target = path.join(root, spec.id);
  try {
    const receipt = JSON.parse(await fs.readFile(path.join(target, 'DITASHA-ENGINE.json')));
    if (receipt.sha256 === spec.sha256) {
      await fs.access(path.join(target, 'index.html'));
      console.log('Ready: ' + spec.id + ' ' + spec.version);
      return;
    }
  } catch {}
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'ditasha-craft-'));
  try {
    console.log('Preparing ' + spec.id + ' ' + spec.version);
    const response = await fetch(spec.url, { signal: AbortSignal.timeout(300000) });
    if (!response.ok || !response.body) throw Error(spec.id + ': HTTP ' + response.status);
    const hash = createHash('sha256');
    const archive = path.join(temp, 'engine.zip');
    const handle = await fs.open(archive, 'wx');
    let bytes = 0;
    try {
      for await (const chunk of response.body) {
        bytes += chunk.length;
        if (bytes > spec.bytes) throw Error('Engine exceeds pinned size');
        hash.update(chunk);
        await handle.writeFile(chunk);
      }
    } finally {
      await handle.close();
    }
    if (bytes !== spec.bytes || hash.digest('hex') !== spec.sha256)
      throw Error(spec.id + ': invalid checksum');
    const listing = spawnSync('tar', ['-tf', archive], {
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
    });
    if (listing.status !== 0) throw Error('Cannot inspect ' + spec.id);
    const entries = listing.stdout.split(/\r?\n/).filter(Boolean);
    if (
      entries.some(
        (p) =>
          p.startsWith('/') ||
          p.includes('\\') ||
          /^[a-z]:/i.test(p) ||
          p.split('/').includes('..'),
      )
    )
      throw Error('Unsafe engine archive');
    const staged = path.join(temp, 'files');
    await fs.mkdir(staged);
    const extraction = spawnSync('tar', ['-xf', archive, '-C', staged], {
      encoding: 'utf8',
      maxBuffer: 1024 * 1024,
    });
    if (extraction.status !== 0)
      throw Error('Cannot extract ' + spec.id + ': ' + extraction.stderr);
    const indexes = entries
      .filter((p) => /(^|\/)index.html$/.test(p))
      .sort((a, b) => a.split('/').length - b.split('/').length);
    if (!indexes.length) throw Error(spec.id + ': no entry page');
    const web = path.dirname(path.join(staged, indexes[0]));
    await fs.copyFile(
      path.resolve('assets/licenses/craft', spec.id + '.md'),
      path.join(web, 'DITASHA-NOTICES.md'),
    );
    await fs.writeFile(path.join(web, 'DITASHA-ENGINE.json'), JSON.stringify(spec, null, 2));
    await fs.mkdir(root, { recursive: true });
    await fs.rm(target, { recursive: true, force: true });
    await fs.cp(web, target, { recursive: true });
    console.log('Verified: ' + spec.id + ' (' + entries.length + ' entries)');
  } finally {
    await fs.rm(temp, { recursive: true, force: true });
  }
}
(async () => {
  // Keep peak download and decompression memory bounded.
  for (let i = 0; i < specs.length; i += 3) await Promise.all(specs.slice(i, i + 3).map(prepare));
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
