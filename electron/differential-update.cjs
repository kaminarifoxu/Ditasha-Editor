'use strict';
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const crypto = require('node:crypto');
const { gunzipSync } = require('node:zlib');
const MAX_MAP = 4 * 1024 ** 2;
const MAX_FILE = 512 * 1024 ** 2;

async function fileHash(file) {
  const hash = crypto.createHash('sha256');
  for await (const chunk of fs.createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}

// Only complete, contiguous external v2 maps are supported. Any other format
// falls back to the full verified installer, including future binary blockmaps.
function parseBlockMap(bytes, size) {
  if (bytes.length > MAX_MAP || !Number.isSafeInteger(size) || size < 1 || size > MAX_FILE)
    throw Error('Peta blok terlalu besar.');
  const map = JSON.parse(gunzipSync(bytes, { maxOutputLength: 16 * 1024 ** 2 }));
  const file = map.files?.[0];
  if (
    map.version !== '2' ||
    map.files.length !== 1 ||
    file.offset !== 0 ||
    !Array.isArray(file.sizes) ||
    !Array.isArray(file.checksums) ||
    !file.sizes.length ||
    file.sizes.length > 100000 ||
    file.sizes.length !== file.checksums.length
  )
    throw Error('Format peta blok tidak didukung.');
  let offset = 0;
  const blocks = file.sizes.map((length, index) => {
    const checksum = file.checksums[index];
    if (
      !Number.isSafeInteger(length) ||
      length < 1 ||
      length > 1024 ** 2 ||
      typeof checksum !== 'string' ||
      !/^[A-Za-z0-9+/=]{8,128}$/.test(checksum)
    )
      throw Error('Blok update tidak valid.');
    const block = { offset, size: length, checksum };
    offset += length;
    if (offset > size) throw Error('Peta blok melewati ukuran file.');
    return block;
  });
  if (offset !== size) throw Error('Peta blok tidak lengkap.');
  return blocks;
}

function planDifferential(oldBlocks, newBlocks) {
  const available = new Map();
  for (const block of oldBlocks) {
    const key = block.size + ':' + block.checksum;
    if (!available.has(key)) available.set(key, block.offset);
  }
  const operations = [];
  let downloadBytes = 0,
    reusedBytes = 0;
  for (const block of newBlocks) {
    const from = available.get(block.size + ':' + block.checksum);
    const copy = from !== undefined;
    const source = copy ? from : block.offset;
    if (copy) reusedBytes += block.size;
    else downloadBytes += block.size;
    const previous = operations.at(-1);
    if (previous && previous.copy === copy && previous.source + previous.size === source) {
      previous.size += block.size;
    } else operations.push({ copy, source, size: block.size });
  }
  return { operations, downloadBytes, reusedBytes };
}

async function readMap(request, info) {
  const response = await request(info.blockmapURL);
  if (!response.ok || !response.body) throw Error('Peta blok tidak tersedia.');
  const chunks = [];
  let size = 0;
  for await (const part of response.body) {
    size += part.length;
    if (size > MAX_MAP) throw Error('Peta blok terlalu besar.');
    chunks.push(Buffer.from(part));
  }
  const bytes = Buffer.concat(chunks);
  return { blocks: parseBlockMap(bytes, info.size), bytes: size };
}

async function writeAll(handle, bytes) {
  let position = 0;
  while (position < bytes.length) {
    const { bytesWritten } = await handle.write(bytes, position, bytes.length - position);
    if (!bytesWritten) throw Error('Tidak dapat menulis update.');
    position += bytesWritten;
  }
}

async function downloadDifferential({
  baseFile,
  baseRelease,
  release,
  expected,
  request,
  destination,
  onProgress,
}) {
  if (!baseFile || !baseRelease?.blockmapURL || !release.blockmapURL || !baseRelease.sha256)
    return null;
  const stat = await fsp.lstat(baseFile);
  if (
    !stat.isFile() ||
    stat.isSymbolicLink() ||
    stat.size !== baseRelease.size ||
    stat.size > MAX_FILE ||
    (await fileHash(baseFile)) !== baseRelease.sha256
  )
    throw Error('Installer acuan tidak cocok.');
  const oldMap = await readMap(request, baseRelease);
  const newMap = await readMap(request, release);
  const plan = planDifferential(oldMap.blocks, newMap.blocks);
  const metadataBytes = oldMap.bytes + newMap.bytes;
  if (
    plan.downloadBytes + metadataBytes >= release.size * 0.9 ||
    plan.operations.filter((o) => !o.copy).length > 128
  )
    return null;
  const totalBytes = plan.downloadBytes + metadataBytes;
  let downloadedBytes = metadataBytes;
  const report = () =>
    onProgress({
      mode: 'differential',
      totalBytes,
      downloadedBytes,
      fullBytes: release.size,
      reusedBytes: plan.reusedBytes,
      progress: totalBytes ? Math.floor((downloadedBytes / totalBytes) * 100) : 100,
    });
  report();
  const base = await fsp.open(baseFile, 'r');
  let output;
  try {
    output = await fsp.open(destination, 'w');
    const buffer = Buffer.alloc(1024 ** 2);
    for (const operation of plan.operations) {
      if (operation.copy) {
        let remaining = operation.size,
          offset = operation.source;
        while (remaining) {
          const { bytesRead } = await base.read(
            buffer,
            0,
            Math.min(buffer.length, remaining),
            offset,
          );
          if (!bytesRead) throw Error('Installer acuan terpotong.');
          await writeAll(output, buffer.subarray(0, bytesRead));
          remaining -= bytesRead;
          offset += bytesRead;
        }
      } else {
        const end = operation.source + operation.size - 1;
        const response = await request(release.url, {
          timeout: 15 * 60 * 1000,
          headers: {
            Accept: 'application/octet-stream',
            'Accept-Encoding': 'identity',
            Range: `bytes=${operation.source}-${end}`,
          },
        });
        if (
          response.status !== 206 ||
          response.headers.get('content-range') !==
            `bytes ${operation.source}-${end}/${release.size}` ||
          !response.body
        ) {
          await response.body?.cancel?.().catch(() => {});
          throw Error('Server tidak mendukung unduhan bagian.');
        }
        let received = 0;
        for await (const part of response.body) {
          received += part.length;
          if (received > operation.size) throw Error('Unduhan bagian terlalu besar.');
          await writeAll(output, Buffer.from(part));
          downloadedBytes += part.length;
          report();
        }
        if (received !== operation.size) throw Error('Unduhan bagian terpotong.');
      }
    }
  } finally {
    await base.close();
    await output?.close();
  }
  if (
    (await fsp.stat(destination)).size !== release.size ||
    (await fileHash(destination)) !== expected
  )
    throw Error('Verifikasi update diferensial gagal.');
  return { downloadedBytes, totalBytes, reusedBytes: plan.reusedBytes };
}

module.exports = { fileHash, parseBlockMap, planDifferential, downloadDifferential };
