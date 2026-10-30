'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { gzipSync } = require('node:zlib');
const { createPortableUpdater } = require('../electron/updater.cjs');
const { parseBlockMap, planDifferential } = require('../electron/differential-update.cjs');
const origin = 'https://github.com/kaminarifoxu/Ditasha-Editor/releases/download/';
const hash = (data) => crypto.createHash('sha256').update(data).digest('hex');
function mapBytes(bytes) {
  const sizes = [],
    checksums = [];
  for (let i = 0; i < bytes.length; i += 4096) {
    const part = bytes.subarray(i, i + 4096);
    sizes.push(part.length);
    checksums.push(crypto.createHash('sha256').update(part).digest('base64'));
  }
  return gzipSync(JSON.stringify({ version: '2', files: [{ offset: 0, sizes, checksums }] }));
}
async function fixture(t, { installed = true, failure, identical = false } = {}) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'ditasha-delta-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const old = crypto.randomBytes(failure === 'fragmented' ? 2 * 1024 ** 2 : 128 * 1024);
  old.write('MZ');
  const next = Buffer.from(old);
  if (!identical) next.fill(20, 4096, 8192);
  if (failure === 'all-changed') {
    next.fill(44);
    next.write('MZ');
  }
  if (failure === 'fragmented')
    for (let i = 4096; i < next.length; i += 8192) next.fill(22, i, i + 4096);
  const baseFile = path.join(directory, 'base.exe');
  await fs.writeFile(baseFile, failure === 'cache' ? Buffer.alloc(old.length) : old);
  const name = installed ? 'DITASHA-Setup.exe' : 'DITASHA-Editor.exe';
  const meta = (version, bytes) => ({
    tag_name: 'v' + version,
    assets: [
      {
        name,
        size: bytes.length,
        digest: 'sha256:' + hash(bytes),
        state: 'uploaded',
        browser_download_url: origin + 'v' + version + '/' + name,
      },
      {
        name: name + '.blockmap',
        state: 'uploaded',
        browser_download_url: origin + 'v' + version + '/' + name + '.blockmap',
      },
    ],
  });
  let wireBytes = 0,
    fullRequests = 0,
    ranges = 0;
  const states = [];
  const updater = createPortableUpdater({
    version: '1.0.0',
    directory,
    installed,
    baseFile,
    onState: (s) => states.push(s),
    fetcher: async (url, options = {}) => {
      if (url.endsWith('/latest')) return Response.json(meta('1.1.0', next));
      if (url.includes('/releases/tags/'))
        return failure === 'base-meta'
          ? new Response('', { status: 404 })
          : Response.json(meta('1.0.0', old));
      if (url.endsWith('.blockmap')) {
        if (['map', 'all-corrupt'].includes(failure)) return new Response('', { status: 404 });
        const bytes = mapBytes(url.includes('/v1.0.0/') ? old : next);
        wireBytes += bytes.length;
        return new Response(bytes);
      }
      if (options.headers.Range) {
        ranges++;
        const [, start, end] = /bytes=(\d+)-(\d+)/.exec(options.headers.Range).map(Number);
        if (failure === 'range-ignored') return new Response(next);
        const data = Buffer.from(next.subarray(start, end + 1));
        if (failure === 'range-corrupt') data.fill(33);
        wireBytes += data.length;
        return new Response(failure === 'range-short' ? data.subarray(0, 10) : data, {
          status: 206,
          headers: {
            'content-range':
              failure === 'range-header' ? 'bytes 0-1/2' : `bytes ${start}-${end}/${next.length}`,
          },
        });
      }
      fullRequests++;
      wireBytes += next.length;
      return new Response(failure === 'all-corrupt' ? old : next);
    },
  });
  await updater.setAutoDownload(true);
  return { updater, states, next, count: () => ({ wireBytes, fullRequests, ranges }) };
}
for (const installed of [true, false])
  test(`reconstructs verified ${installed ? 'Setup' : 'portable'} using only changed byte ranges`, async (t) => {
    const f = await fixture(t, { installed });
    assert.equal((await f.updater.check()).status, 'ready');
    assert.deepEqual(await fs.readFile(f.updater.getReadyPath()), f.next);
    assert.equal(f.count().fullRequests, 0);
    assert.equal(f.count().ranges, 1);
    assert(f.count().wireBytes < f.next.length / 10);
    const s = f.updater.getState();
    assert.equal(s.mode, 'differential');
    assert.equal(s.totalBytes, f.count().wireBytes);
    assert.equal(s.downloadedBytes, s.totalBytes);
    assert(s.reusedBytes > f.next.length * 0.9);
  });
for (const failure of [
  'cache',
  'map',
  'base-meta',
  'range-ignored',
  'range-header',
  'range-corrupt',
  'range-short',
  'all-changed',
  'fragmented',
])
  test(`falls back to the complete verified package after ${failure}`, async (t) => {
    const f = await fixture(t, { failure });
    assert.equal((await f.updater.check()).status, 'ready');
    assert.deepEqual(await fs.readFile(f.updater.getReadyPath()), f.next);
    assert.equal(f.count().fullRequests, 1);
    assert.equal(f.updater.getState().mode, 'full');
  });
test('does not request executable bytes when maps describe identical payloads', async (t) => {
  const f = await fixture(t, { identical: true });
  assert.equal((await f.updater.check()).status, 'ready');
  assert.equal(f.count().ranges, 0);
  assert.equal(f.count().fullRequests, 0);
});
test('never exposes an invalid full fallback as ready', async (t) => {
  const f = await fixture(t, { failure: 'all-corrupt' });
  assert.equal((await f.updater.check()).status, 'error');
  assert.equal(f.updater.getReadyPath(), null);
});
test('rejects unsupported, incomplete, oversized and compressed-bomb blockmaps', () => {
  assert.throws(() => parseBlockMap(gzipSync('{}'), 1));
  assert.throws(() => parseBlockMap(mapBytes(Buffer.alloc(4096)), 4095));
  assert.throws(() => parseBlockMap(Buffer.alloc(4 * 1024 ** 2 + 1), 4096));
  assert.throws(() => parseBlockMap(gzipSync(Buffer.alloc(17 * 1024 ** 2)), 4096));
});
test('matches moved and repeated blocks by checksum and size, preserving target order', () => {
  const old = parseBlockMap(
    mapBytes(Buffer.concat([Buffer.alloc(4096, 1), Buffer.alloc(4096, 2)])),
    8192,
  );
  const next = parseBlockMap(
    mapBytes(Buffer.concat([Buffer.alloc(4096, 2), Buffer.alloc(4096, 1), Buffer.alloc(4096, 2)])),
    12288,
  );
  const p = planDifferential(old, next);
  assert.equal(p.downloadBytes, 0);
  assert.deepEqual(
    p.operations.map((o) => o.source),
    [4096, 0],
  );
});
