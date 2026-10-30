'use strict';
// Exercise production updater code through real HTTP Range transfers. A tiny
// synthetic header edit proves reconstruction, not typical release savings.
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const assert = require('node:assert/strict');
const { buildBlockMap } = require('app-builder-lib/out/targets/blockmap/blockmap');
const { createPortableUpdater } = require('../electron/updater.cjs');
const { fileHash } = require('../electron/differential-update.cjs');
const rootURL = 'https://github.com/kaminarifoxu/Ditasha-Editor/releases/download/';
async function check({ root, target, base, name, requireSavings }) {
  const [oldHash, nextHash] = await Promise.all([fileHash(base), fileHash(target)]);
  const oldSize = (await fsp.stat(base)).size,
    nextSize = (await fsp.stat(target)).size;
  const oldMap = base + '.blockmap',
    nextMap = target + '.blockmap';
  await buildBlockMap(base, 'gzip', oldMap);
  const files = new Map([
    ['/v100.0.0/' + name, base],
    ['/v100.0.1/' + name, target],
    ['/v100.0.0/' + name + '.blockmap', oldMap],
    ['/v100.0.1/' + name + '.blockmap', nextMap],
  ]);
  const meta = (version, size, hash) => ({
    tag_name: 'v' + version,
    assets: [
      {
        name,
        state: 'uploaded',
        size,
        digest: 'sha256:' + hash,
        browser_download_url: rootURL + 'v' + version + '/' + name,
      },
      {
        name: name + '.blockmap',
        state: 'uploaded',
        browser_download_url: rootURL + 'v' + version + '/' + name + '.blockmap',
      },
    ],
  });
  let rangedBytes = 0,
    ranges = 0,
    fullTransfers = 0;
  const server = http.createServer(async (request, response) => {
    try {
      const file = files.get(request.url);
      if (!file) {
        response.writeHead(404).end();
        return;
      }
      const { size } = await fsp.stat(file);
      const range = /^bytes=(\d+)-(\d+)$/.exec(request.headers.range || '');
      if (range) {
        const start = Number(range[1]),
          end = Number(range[2]);
        if (end >= size || start > end) {
          response.writeHead(416).end();
          return;
        }
        ranges++;
        rangedBytes += end - start + 1;
        response.writeHead(206, {
          'Content-Range': `bytes ${start}-${end}/${size}`,
          'Content-Length': end - start + 1,
        });
        fs.createReadStream(file, { start, end }).pipe(response);
      } else {
        if (file === target) fullTransfers++;
        response.writeHead(200, { 'Content-Length': size });
        fs.createReadStream(file).pipe(response);
      }
    } catch {
      response.writeHead(500).end();
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const updater = createPortableUpdater({
    version: '100.0.0',
    installed: name === 'DITASHA-Setup.exe',
    baseFile: base,
    directory: path.join(root, 'download-' + name),
    fetcher: async (url, options) => {
      if (url.endsWith('/latest')) return Response.json(meta('100.0.1', nextSize, nextHash));
      if (url.includes('/releases/tags/')) return Response.json(meta('100.0.0', oldSize, oldHash));
      assert(url.startsWith(rootURL));
      const result = await fetch(
        `http://127.0.0.1:${server.address().port}/` + url.slice(rootURL.length),
        options,
      );
      // Transport bridge for CI only; production still enforces GitHub origins.
      return new Response(result.body, { status: result.status, headers: result.headers });
    },
  });
  try {
    await updater.setAutoDownload(true);
    const state = await updater.check();
    assert.equal(state.status, 'ready', state.message);
    assert.equal(await fileHash(updater.getReadyPath()), nextHash);
    if (requireSavings) {
      assert.equal(state.mode, 'differential');
      assert.equal(fullTransfers, 0);
      assert(state.totalBytes < nextSize / 10);
    }
    return {
      name,
      mode: state.mode,
      fullBytes: nextSize,
      downloadedBytes: state.totalBytes,
      rangedBytes,
      ranges,
      fullTransfers,
      sha256Verified: true,
    };
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
}
async function run(directory = path.resolve(process.argv[2] || 'release')) {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), 'ditasha-real-delta-'));
  try {
    const report = { syntheticHeaderChanges: [], previousRelease: null };
    for (const name of ['DITASHA-Setup.exe', 'DITASHA-Editor.exe']) {
      const target = path.join(directory, name),
        base = path.join(root, name);
      await fsp.copyFile(target, base);
      const handle = await fsp.open(base, 'r+');
      try {
        const byte = Buffer.alloc(1);
        await handle.read(byte, 0, 1, 512);
        byte[0] ^= 255;
        await handle.write(byte, 0, 1, 512);
      } finally {
        await handle.close();
      }
      report.syntheticHeaderChanges.push(
        await check({ root, target, base, name, requireSavings: true }),
      );
    }
    if (process.env.DITASHA_PREVIOUS_SETUP) {
      const base = process.env.DITASHA_PREVIOUS_SETUP;
      const checksum = (await fsp.readFile(base + '.sha256', 'utf8')).trim().split(/\s+/)[0];
      assert.equal(await fileHash(base), checksum, 'Previous public installer checksum');
      report.previousRelease = await check({
        root,
        target: path.join(directory, 'DITASHA-Setup.exe'),
        base,
        name: 'DITASHA-Setup.exe',
        requireSavings: false,
      });
      report.previousRelease.version = process.env.DITASHA_PREVIOUS_VERSION || 'previous';
    }
    await fsp.mkdir(path.join(directory, 'qa'), { recursive: true });
    await fsp.writeFile(
      path.join(directory, 'qa/differential-update-result.json'),
      JSON.stringify(report, null, 2),
    );
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await fsp.rm(root, { recursive: true, force: true });
  }
}
if (require.main === module)
  run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
module.exports = { run };
