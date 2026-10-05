import test from 'node:test';
import assert from 'node:assert/strict';
import { deflateRaw } from 'pako';
import { openArchive, writeRpf } from '../src/archives.js';
import { zipFiles, createYtd, crc32 } from '../src/asset-tools.js';
const enc = new TextEncoder(),
  blob = (b) => new Blob([b]);
const entry = (name, text) => ({ name, data: enc.encode(text) });
test('RPF OPEN directories, resources and nested archives round-trip', async () => {
  const ytd = createYtd([
      { name: 'test', w: 1, h: 1, out: new Uint8ClampedArray([100, 20, 30, 255]) },
    ]),
    inner = writeRpf([entry('content.meta', 'hello')]);
  const files = [
      entry('folder/config.xml', '<config/>'),
      { name: 'folder/test.ytd', data: ytd },
      { name: 'nested.rpf', data: inner },
      entry('empty.bin', ''),
    ],
    data = writeRpf(files),
    archive = await openArchive(blob(data), 'test.rpf');
  assert.equal(archive.kind, 'RPF7');
  for (const f of files)
    assert.deepEqual(await archive.extract(archive.entries.find((e) => e.name === f.name)), f.data);
  const nested = await openArchive(
    blob(await archive.extract(archive.entries.find((e) => e.name === 'nested.rpf'))),
    'nested.rpf',
  );
  assert.equal(new TextDecoder().decode(await nested.extract(nested.entries[0])), 'hello');
});
test('Reject encrypted RPF and corrupt directory graphs / ranges', async () => {
  const good = writeRpf([entry('x.txt', 'hello')]);
  for (const [at, value, pattern] of [
    [12, 0x0ffffff9, /encryption keys/],
    [24, 0, /Cyclic/],
    [16 + 16 + 4, 0x7fffff00, /folder|directory|unreachable|Cyclic/],
  ]) {
    const data = good.slice();
    new DataView(data.buffer).setUint32(at, value, true);
    await assert.rejects(() => openArchive(blob(data)), pattern);
  }
  const truncated = good.subarray(0, 512);
  await assert.rejects(() => openArchive(blob(truncated)), /range|truncated/);
});
test('Stored ZIP and OIV paths, bytes and checksums', async () => {
  const files = [
      entry('assembly.xml', '<package version="2.2"/>'),
      entry('content/a.meta', 'test'),
    ],
    zip = zipFiles(files),
    archive = await openArchive(blob(zip), 'mod.oiv');
  assert.equal(archive.kind, 'OIV');
  for (const f of files)
    assert.deepEqual(await archive.extract(archive.entries.find((e) => e.name === f.name)), f.data);
  const bad = zip.slice();
  bad[30 + files[0].name.length] ^= 1;
  const corrupt = await openArchive(blob(bad), 'bad.zip');
  await assert.rejects(() => corrupt.extract(corrupt.entries[0]), /checksum/);
});
function compressedZip(data, declared = data.length) {
  const zip = zipFiles([{ name: 'x.txt', data }]),
    n = 5,
    packed = deflateRaw(data),
    central = zip.subarray(30 + n + data.length, zip.length - 22),
    out = new Uint8Array(30 + n + packed.length + central.length + 22),
    h = new DataView(out.buffer);
  out.set(zip.subarray(0, 35));
  h.setUint16(8, 8, true);
  h.setUint32(18, packed.length, true);
  h.setUint32(22, declared, true);
  out.set(packed, 35);
  const p = 35 + packed.length;
  out.set(central, p);
  h.setUint16(p + 10, 8, true);
  h.setUint32(p + 20, packed.length, true);
  h.setUint32(p + 24, declared, true);
  out.set(zip.subarray(zip.length - 22), out.length - 22);
  h.setUint32(out.length - 6, p, true);
  return out;
}
test('Deflated ZIP extraction verifies size, CRC and decompression bounds', async () => {
  const data = enc.encode('some data '.repeat(10000)),
    archive = await openArchive(blob(compressedZip(data)), 'deflate.zip');
  assert.deepEqual(await archive.extract(archive.entries[0]), data);
  const bomb = await openArchive(blob(compressedZip(data, 1)), 'bomb.zip');
  await assert.rejects(() => bomb.extract(bomb.entries[0]), /declared size/);
});
test('Reject traversal, name mismatch, password entries and unsupported ZIP methods', async () => {
  const good = zipFiles([entry('a.txt', 'hello')]),
    p = 35 + 5;
  const unsafe = good.slice();
  unsafe.set(enc.encode('../xx'), p + 46);
  await assert.rejects(() => openArchive(blob(unsafe)), /not safe|tidak aman/);
  const mismatch = good.slice();
  mismatch[30] = 98;
  const a = await openArchive(blob(mismatch));
  await assert.rejects(() => a.extract(a.entries[0]), /filename mismatch/);
  for (const [field, value, pattern] of [
    [8, 0x801, /Password/],
    [10, 99, /compression/],
  ]) {
    const d = good.slice();
    new DataView(d.buffer).setUint16(p + field, value, true);
    const a = await openArchive(blob(d));
    await assert.rejects(() => a.extract(a.entries[0]), pattern);
  }
});
test('RPF writer rejects path collisions, duplicate names and unsafe resource scripts', () => {
  assert.throws(() => writeRpf([entry('dir', 'x'), entry('dir/x', 'y')]), /collision/);
  assert.throws(() => writeRpf([entry('a.txt', 'x'), entry('A.txt', 'y')]), /Duplicate/);
  assert.throws(() => writeRpf([entry('../x', 'bad')]), /tidak aman/);
  const ytd = createYtd([{ name: 't', w: 1, h: 1, out: new Uint8ClampedArray(4) }]);
  assert.throws(() => writeRpf([{ name: 'script.ysc', data: ytd }]), /Encrypted scripts/);
});

test('Independent RPF7 fixture reads compressed binary data and validates its declared size', async () => {
  const data = enc.encode('RPF compressed payload '.repeat(100)),
    packed = deflateRaw(data),
    out = new Uint8Array(512 + packed.length),
    v = new DataView(out.buffer);
  v.setUint32(0, 0x52504637, true);
  v.setUint32(4, 2, true);
  v.setUint32(8, 16, true);
  v.setUint32(12, 0, true);
  v.setUint32(20, 0x7fffff00, true);
  v.setUint32(24, 1, true);
  v.setUint32(28, 1, true);
  v.setUint16(32, 1, true);
  out.set([packed.length & 255, (packed.length >>> 8) & 255, 0, 1, 0, 0], 34);
  v.setUint32(40, data.length, true);
  out.set(enc.encode('\0test.txt\0'), 48);
  out.set(packed, 512);
  const a = await openArchive(blob(out), 'fixture.rpf');
  assert.deepEqual(await a.extract(a.entries[0]), data);
  v.setUint32(40, 1, true);
  const bad = await openArchive(blob(out));
  await assert.rejects(() => bad.extract(bad.entries[0]), /declared size/);
});
test('RPF directory names use ordinal order required by the game', async () => {
  const files = ['lower.txt', 'Upper.txt', '_under.txt', '+plus.txt'].map((n) => entry(n, n)),
    archive = await openArchive(blob(writeRpf(files)));
  assert.deepEqual(
    archive.entries.map((e) => e.name),
    files.map((e) => e.name).sort(),
  );
});
