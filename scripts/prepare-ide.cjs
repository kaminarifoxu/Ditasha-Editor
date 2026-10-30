'use strict';
const fs = require('node:fs/promises');
const { createReadStream } = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { createHash } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const spec = require('./ide-runtime.json');
const { inspectRuntime } = require('../electron/embedded-ide.cjs');
async function notices(destination) {
  for (const name of ['CODE-OSS-LICENSE.txt', 'VSCODIUM-LICENSE.txt'])
    await fs.copyFile(
      path.resolve(__dirname, '../assets/licenses', name),
      path.join(destination, name),
    );
}
async function main() {
  const destination = path.resolve(__dirname, '../ide-runtime');
  const receipt = path.join(destination, 'DITASHA-RUNTIME.json');
  try {
    const installed = JSON.parse(await fs.readFile(receipt, 'utf8'));
    if (installed.sha256 === spec.sha256) {
      await inspectRuntime(destination, 'win32');
      await notices(destination);
      console.log('Pinned IDE runtime is ready: ' + spec.version);
      return;
    }
  } catch {}
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'ditasha-runtime-'));
  try {
    const archive = path.join(temporary, 'engine.tar.gz');
    console.log('Downloading verified MIT Code - OSS engine ' + spec.version + '…');
    let source;
    if (process.env.DITASHA_IDE_ARCHIVE)
      source = createReadStream(path.resolve(process.env.DITASHA_IDE_ARCHIVE));
    else {
      const response = await fetch(spec.url, { signal: AbortSignal.timeout(300000) });
      if (!response.ok || !response.body)
        throw Error('Engine download failed: HTTP ' + response.status);
      source = response.body;
    }
    const hash = createHash('sha256');
    const handle = await fs.open(archive, 'wx');
    let total = 0;
    try {
      for await (const chunk of source) {
        total += chunk.length;
        if (total > spec.size) throw Error('IDE engine exceeded its pinned size.');
        hash.update(chunk);
        await handle.writeFile(chunk);
      }
    } finally {
      await handle.close();
    }
    if (total !== spec.size || hash.digest('hex') !== spec.sha256)
      throw Error('IDE engine checksum does not match the pinned release.');
    const listing = spawnSync('tar', ['-tzf', archive], {
      encoding: 'utf8',
      windowsHide: true,
      maxBuffer: 16 * 1024 * 1024,
    });
    if (listing.status !== 0) throw Error('Could not inspect the IDE archive.');
    for (const entry of listing.stdout.split(/\r?\n/).filter(Boolean)) {
      if (
        entry.startsWith('/') ||
        entry.includes('\\') ||
        /^[a-z]:/i.test(entry) ||
        entry.split('/').includes('..')
      )
        throw Error('Unsafe IDE archive path.');
    }
    const staged = path.join(temporary, 'unpacked');
    await fs.mkdir(staged);
    const result = spawnSync('tar', ['-xzf', archive, '-C', staged, '--no-same-owner'], {
      windowsHide: true,
      encoding: 'utf8',
      maxBuffer: 1024 * 1024,
    });
    if (result.status !== 0)
      throw Error(
        'Could not extract the verified IDE archive: ' + (result.stderr || '').slice(-300),
      );
    await inspectRuntime(staged, 'win32');
    await fs.writeFile(path.join(staged, 'DITASHA-RUNTIME.json'), JSON.stringify(spec, null, 2));
    await fs.rm(destination, { recursive: true, force: true });
    await fs.cp(staged, destination, { recursive: true });
    await notices(destination);
    console.log('Verified IDE engine prepared, with its original licenses.');
  } finally {
    await fs.rm(temporary, { recursive: true, force: true });
  }
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
