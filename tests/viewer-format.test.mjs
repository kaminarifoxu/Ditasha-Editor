import test from 'node:test';
import assert from 'node:assert/strict';
import { deflateRaw } from 'pako';
import { readYdd, Resource } from '../src/resource.js';
import { folderArchive, sortEntries, hexPage } from '../src/explorer.js';
import { openArchive, writeRpf } from '../src/archives.js';
import { hashName } from '../src/asset-tools.js';
function modelFixture() {
  const bytes = new Uint8Array(6144),
    v = new DataView(bytes.buffer),
    ptr = (at, to) => v.setBigUint64(at, BigInt(0x50000000 + to), true),
    gfx = (at, to) => v.setBigUint64(at, BigInt(0x60000000 + to), true);
  ptr(48, 64);
  v.setUint16(56, 1, true);
  ptr(64, 128);
  ptr(128 + 16, 2048);
  ptr(128 + 80, 512);
  ptr(128 + 88, 528);
  ptr(512, 560);
  v.setUint16(520, 2, true);
  ptr(560, 600);
  ptr(568, 648);
  ptr(528, 576);
  v.setUint16(536, 1, true);
  ptr(576, 696);
  for (const [model, array, geometry, mapping] of [
    [600, 752, 1024, 1800],
    [648, 760, 1152, 1802],
    [696, 768, 1280, 1804],
  ]) {
    ptr(model + 8, array);
    v.setUint16(model + 16, 1, true);
    ptr(array, geometry);
    ptr(model + 32, mapping);
    ptr(geometry + 24, geometry === 1280 ? 1472 : 1408);
    ptr(geometry + 56, geometry === 1280 ? 1648 : 1600);
  }
  for (const [vb, at] of [
    [1408, 0],
    [1472, 128],
  ]) {
    v.setUint16(vb + 8, 20, true);
    gfx(vb + 16, at);
    v.setUint32(vb + 24, 3, true);
    ptr(vb + 48, 1728);
    for (let i = 0; i < 3; i++) {
      v.setFloat32(4096 + at + i * 20, i === 1 ? (at ? 2 : 1) : 0, true);
      v.setFloat32(4104 + at + i * 20, i === 2 ? 1 : 0, true);
      v.setFloat32(4108 + at + i * 20, i === 1 ? 1 : 0, true);
      v.setFloat32(4112 + at + i * 20, i === 2 ? 1 : 0, true);
    }
  }
  v.setUint32(1728, 65, true);
  v.setBigUint64(1736, 6n | (5n << 24n), true);
  for (const [ib, at] of [
    [1600, 256],
    [1648, 272],
  ]) {
    v.setUint32(ib + 8, 3, true);
    gfx(ib + 16, at);
    for (let i = 0; i < 3; i++) v.setUint16(4096 + at + i * 2, i, true);
  }
  ptr(2048 + 8, 2560);
  ptr(2048 + 16, 2112);
  v.setUint16(2048 + 24, 1, true);
  ptr(2112, 2176);
  ptr(2176, 2240);
  bytes[2176 + 16] = 1;
  ptr(2240 + 8, 2304);
  v.setUint32(2256, hashName('DiffuseSampler'), true);
  ptr(2304 + 40, 2368);
  bytes.set(new TextEncoder().encode('cloth_diffuse\0'), 2368);
  ptr(2560 + 48, 2624);
  v.setUint16(2560 + 56, 1, true);
  ptr(2624, 2688);
  ptr(2688 + 40, 2368);
  v.setUint16(2688 + 80, 1, true);
  v.setUint16(2688 + 82, 1, true);
  v.setUint16(2688 + 86, 4, true);
  v.setUint32(2688 + 88, 21, true);
  bytes[2688 + 93] = 1;
  gfx(2688 + 112, 512);
  bytes.set([30, 20, 10, 255], 4096 + 512);
  return bytes;
}
function pack(bytes) {
  const compressed = deflateRaw(bytes),
    out = new Uint8Array(16 + compressed.length),
    v = new DataView(out.buffer);
  v.setUint32(0, 0x37435352, true);
  v.setUint32(4, 165, true);
  v.setUint32(8, 0x08000003, true);
  v.setUint32(12, 0x08000002, true);
  out.set(compressed, 16);
  return out.buffer;
}
export const viewerModel = pack(modelFixture());
test('All available LODs, parts and diffuse shader references are read independently', () => {
  const [d] = readYdd(viewerModel);
  assert.deepEqual(
    d.lods.map((l) => l.name),
    ['High', 'Medium'],
  );
  assert.equal(d.lods[0].geometries.length, 2);
  assert.deepEqual(
    d.lods[0].geometries.map((g) => g.part),
    [0, 1],
  );
  assert.equal(d.lods[1].geometries[0].positions[3], 2);
  assert.equal(d.geometries[0].diffuseTexture, 'cloth_diffuse');
  assert.deepEqual([...d.embeddedTextures[0].out], [10, 20, 30, 255]);
});
test('Non-finite vertices and malformed low-LOD data are rejected', () => {
  const bytes = modelFixture();
  new DataView(bytes.buffer).setFloat32(4096 + 128, NaN, true);
  assert.throws(() => readYdd(pack(bytes)), /non-finite/);
  const index = modelFixture();
  new DataView(index.buffer).setUint16(4096 + 272, 99, true);
  assert.throws(() => readYdd(pack(index)), /Index model/);
});
test('Folder browsing keeps lazy files, names and bounded extraction', async () => {
  const files = [new File(['abc'], 'a.meta'), new File(['def'], 'b.ytd')];
  Object.defineProperty(files[0], 'webkitRelativePath', {
    value: 'gta/mods/a.meta',
    configurable: true,
  });
  Object.defineProperty(files[1], 'webkitRelativePath', { value: 'gta/mods/b.ytd' });
  const a = folderArchive(files);
  assert.equal(a.name, 'gta');
  assert.deepEqual(
    a.entries.map((e) => e.name),
    ['mods/a.meta', 'mods/b.ytd'],
  );
  assert.equal(new TextDecoder().decode(await a.extract(a.entries[0])), 'abc');
  Object.defineProperty(files[0], 'webkitRelativePath', { value: 'gta/../bad' });
  assert.throws(() => folderArchive(files), /tidak aman/);
});
test('Explorer sorting and hex inspection preserve bytes and order', () => {
  const files = [
    { name: 'a10.ytd', size: 1 },
    { name: 'a2.yft', size: 3 },
    { name: 'B.meta', size: 2 },
  ];
  assert.deepEqual(
    sortEntries(files).map((e) => e.name),
    ['a2.yft', 'a10.ytd', 'B.meta'],
  );
  assert.deepEqual(
    sortEntries(files, 'size', true).map((e) => e.size),
    [3, 2, 1],
  );
  assert.equal(sortEntries(files, 'type')[0].name, 'B.meta');
  const hex = hexPage(new Uint8Array([0, 0x41, 0xff]));
  assert.match(hex, /00000000  00 41 ff/);
  assert.match(hex, /\.A\./);
  assert.throws(() => hexPage(new Uint8Array(), -1), /Invalid/);
});
test('New empty OPEN RPF is a valid archive and nested stored RPF stays lazy', async () => {
  const empty = await openArchive(new Blob([writeRpf([])]), 'empty.rpf');
  assert.equal(empty.entries.length, 0);
  const a = await openArchive(
    new Blob([writeRpf([{ name: 'nested.rpf', data: writeRpf([]) }])]),
    'parent.rpf',
  );
  assert(a.entries[0].source instanceof Blob);
  assert.equal((await openArchive(a.entries[0].source, 'nested.rpf')).kind, 'RPF7');
});
