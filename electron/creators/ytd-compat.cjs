'use strict';
const { inflateRawSync } = require('node:zlib');

// Mirrors the container/index fields used by src/resource.js. This is metadata
// inspection only: no texture pixels are decoded in the main Electron process.
function pageSize(flags) {
  return 512 * (2 ** (flags & 15)) * (
    ((flags >>> 27) & 1) + ((flags >>> 26) & 1) * 2 +
    ((flags >>> 25) & 1) * 4 + ((flags >>> 24) & 1) * 8 +
    ((flags >>> 17) & 127) * 16 + ((flags >>> 11) & 63) * 32 +
    ((flags >>> 7) & 15) * 64 + ((flags >>> 5) & 3) * 128 +
    ((flags >>> 4) & 1) * 256
  );
}
function indexEditorYtd(contents) {
  if (!Buffer.isBuffer(contents) || contents.length < 17)
    throw Error('YTD cannot be opened: invalid RSC7 container');
  const header = contents.subarray(0, 16);
  if (header.readUInt32LE(0) !== 0x37435352 || header.readUInt32LE(4) !== 13)
    throw Error('YTD cannot be opened: expected GTA V Legacy RSC7 version 13');
  const sys = pageSize(header.readUInt32LE(8));
  const expected = sys + pageSize(header.readUInt32LE(12));
  if (sys < 64 || expected < 64 || expected > 768 * 1024 * 1024)
    throw Error('YTD cannot be opened: invalid or oversized resource pages');
  const bytes = inflateRawSync(contents.subarray(16), { maxOutputLength: expected });
  if (bytes.length !== expected) throw Error('YTD cannot be opened: incorrect decoded length');
  function bounded(offset, size) {
    if (!Number.isSafeInteger(offset) || offset < 0 || offset + size > bytes.length)
      throw Error('YTD cannot be opened: invalid texture pointer');
    return offset;
  }
  function ptr(offset) {
    bounded(offset, 8);
    const raw = bytes.readBigUInt64LE(offset);
    if (raw === 0n) return null;
    const n = Number(raw);
    const addr = n >= 0x60000000 && n < 0x70000000
      ? sys + n - 0x60000000
      : n >= 0x50000000 && n < 0x60000000
        ? n - 0x50000000
        : -1;
    return bounded(addr, 1);
  }
  bounded(56, 2);
  const count = bytes.readUInt16LE(56);
  if (count < 1) throw Error('YTD has no readable textures: dictionary is empty');
  if (count > 4096) throw Error('YTD cannot be opened: too many textures');
  const entries = ptr(48);
  if (entries === null) throw Error('YTD has no readable textures: missing dictionary index');
  bounded(entries, count * 8);
  const textures = [];
  for (let i = 0; i < count; i++) {
    const texture = ptr(entries + i * 8);
    if (texture === null) throw Error('YTD cannot be opened: null texture entry');
    bounded(texture + 82, 2);
    const width = bytes.readUInt16LE(texture + 80);
    const height = bytes.readUInt16LE(texture + 82);
    if (!width || !height || width > 8192 || height > 8192)
      throw Error('YTD cannot be opened: invalid texture dimensions');
    textures.push({ width, height });
  }
  return Object.freeze({ textureCount: textures.length, textures });
}
module.exports = { indexEditorYtd };
