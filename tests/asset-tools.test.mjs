import assert from 'node:assert/strict';
import { test } from 'node:test';
import { inflateRaw } from 'pako';
import {
  createYtd,
  writeDds,
  readDds,
  zipFiles,
  crc32,
  safePath,
  hashName,
} from '../src/asset-tools.js';
import { readYtd } from '../src/resource.js';
import { clothingInfo, importPath, analyzePack, buildPack } from '../src/clothing-pack.js';
const rgba = {
  name: 'jbib_diff_000_a_uni.png',
  w: 2,
  h: 2,
  out: new Uint8ClampedArray([1, 2, 3, 0, 40, 50, 60, 255, 255, 0, 0, 128, 0, 255, 0, 255]),
};
function unzipStored(b) {
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength),
    out = new Map();
  let p = 0;
  while (v.getUint32(p, true) === 0x04034b50) {
    const size = v.getUint32(p + 18, true),
      n = v.getUint16(p + 26, true),
      extra = v.getUint16(p + 28, true),
      start = p + 30 + n + extra,
      name = new TextDecoder().decode(b.slice(p + 30, p + 30 + n)),
      data = b.slice(start, start + size);
    assert.equal(crc32(data), v.getUint32(p + 14, true));
    out.set(name, data);
    p = start + size;
  }
  assert.equal(v.getUint32(p, true), 0x02014b50);
  return out;
}
test('new YTD round trips multiple textures, names, dimensions and alpha', () => {
  const bytes = createYtd([rgba, { ...rgba, name: 'feet_diff_001_a_uni.dds' }]),
    r = readYtd(bytes.buffer);
  assert.equal(r.textures.length, 2);
  for (const t of r.textures) {
    assert.equal(t.w, 2);
    assert.deepEqual(t.out, rgba.out);
  }
  const uncompressed = inflateRaw(bytes.subarray(16)),
    v = new DataView(uncompressed.buffer);
  assert.equal(v.getUint32(24, true), 1);
  assert.equal(v.getUint32(4, true), 1);
  const hashes = r.ptr(32);
  assert.ok(v.getUint32(hashes, true) < v.getUint32(hashes + 4, true));
  assert.equal(hashName('TEST'), hashName('test'));
  assert.throws(() => createYtd([rgba, rgba]), /duplikat/);
  assert.throws(() => createYtd([{ ...rgba, w: 0 }]), /Dimensi/);
  assert.throws(() => createYtd([{ ...rgba, name: 'bad name.png' }]), /Nama/);
});
test('DDS RGBA/BGRA preserve alpha, DXT decoding and truncated/DX10 rejection', () => {
  const bytes = writeDds(rgba),
    out = readDds(bytes.buffer);
  assert.deepEqual(out.out, rgba.out);
  const bgra = bytes.slice(),
    v = new DataView(bgra.buffer);
  v.setUint32(92, 0xff0000, true);
  v.setUint32(100, 0xff, true);
  for (let i = 128; i < bgra.length; i += 4) [bgra[i], bgra[i + 2]] = [bgra[i + 2], bgra[i]];
  assert.deepEqual(readDds(bgra.buffer).out, rgba.out);
  assert.throws(() => readDds(bytes.slice(0, 132).buffer), /terpotong/);
  for (const four of [0x31545844, 0x33545844, 0x35545844]) {
    const dds = new Uint8Array(144),
      d = new DataView(dds.buffer);
    dds.set(bytes.subarray(0, 128));
    d.setUint32(12, 4, true);
    d.setUint32(16, 4, true);
    d.setUint32(80, 4, true);
    d.setUint32(84, four, true);
    const at = four === 0x31545844 ? 128 : 136;
    d.setUint16(at, 0xf800, true);
    d.setUint16(at + 2, 0, true);
    if (four === 0x33545844) dds.fill(255, 128, 136);
    if (four === 0x35545844) dds[128] = 255;
    assert.deepEqual([...readDds(dds.buffer).out.slice(0, 4)], [255, 0, 0, 255]);
  }
  const dx10 = bytes.slice(),
    dv = new DataView(dx10.buffer);
  dv.setUint32(80, 4, true);
  dv.setUint32(84, 0x30315844, true);
  assert.throws(() => readDds(dx10.buffer), /DDS mendukung/);
});
test('ZIP validates paths, collisions and readable CRC-correct content', () => {
  assert.equal(crc32(new TextEncoder().encode('123456789')), 0xcbf43926);
  const zip = zipFiles([
      { name: 'resource/stream/衣服.ydd', data: rgba.out },
      { name: 'resource/fxmanifest.lua', data: 'test' },
    ]),
    files = unzipStored(zip);
  assert.deepEqual(files.get('resource/stream/衣服.ydd'), new Uint8Array(rgba.out));
  for (const name of ['../x', 'x/../y', '/x', 'C:\\x', 'x//y', 'x/NUL.txt', 'x/test.'])
    assert.throws(() => safePath(name));
  assert.throws(
    () =>
      zipFiles([
        { name: 'X.ytd', data: '' },
        { name: 'x.YTD', data: '' },
      ]),
    /duplikat/,
  );
});
const entries = [
  { path: 'stream/mp_m_freemode_01^jbib_000_u.ydd', data: new Uint8Array([1, 2, 3]) },
  { path: 'stream/mp_m_freemode_01^jbib_diff_000_a_uni.ytd', data: new Uint8Array([4, 5, 6]) },
];
test('clothing grouping, texture pairing and replacement resource output', () => {
  assert.equal(clothingInfo(entries[0].path).key, clothingInfo(entries[1].path).key);
  assert.equal(clothingInfo('mp_f_freemode_01_pack^p_head_001.ydd').slot, 'Hat');
  assert.equal(importPath('folder/stream/sub/asset.ydd'), 'stream/sub/asset.ydd');
  const check = analyzePack(entries, 'replace');
  assert.deepEqual(check.errors, []);
  assert.deepEqual(check.warnings, []);
  const files = unzipStored(buildPack(entries, { name: 'my_clothes', note: 'Build one' }));
  assert.deepEqual(files.get('my_clothes/' + entries[0].path), entries[0].data);
  const manifest = new TextDecoder().decode(files.get('my_clothes/fxmanifest.lua'));
  assert.match(manifest, /fx_version 'cerulean'/);
  assert.match(manifest, /Ditasha-Workshop/);
  assert.ok(files.has('my_clothes/ditasha-pack.json'));
  assert.throws(() => buildPack(entries, { name: '../bad' }), /Nama/);
  assert.ok(analyzePack(entries.slice(0, 1), 'replace').warnings.length);
  assert.ok(analyzePack([...entries, entries[0]], 'replace').errors.length);
});
test('add-on requires existing metadata and preserves collections and payloads', () => {
  assert.throws(() => buildPack(entries, { name: 'addon', mode: 'addon' }), /memerlukan YMT/);
  const addon = [
    ...entries,
    { path: 'stream/mp_m_freemode_01_pack.ymt', data: new Uint8Array([9, 8, 7]) },
    {
      path: 'mp_m_freemode_01_pack.meta',
      data: new TextEncoder().encode('<ShopPedApparel><dlcName>pack</dlcName></ShopPedApparel>'),
    },
  ];
  const files = unzipStored(buildPack(addon, { name: 'addon', mode: 'addon' })),
    manifest = new TextDecoder().decode(files.get('addon/fxmanifest.lua'));
  assert.match(manifest, /SHOP_PED_APPAREL_META_FILE/);
  assert.deepEqual(files.get('addon/stream/mp_m_freemode_01_pack.ymt'), addon[2].data);
  assert.throws(() => buildPack(addon, { name: 'replace' }), /mode add-on/);
  assert.throws(
    () =>
      buildPack(
        [
          ...addon.slice(0, 3),
          { path: 'wrong.meta', data: new TextEncoder().encode('<NotShop/>') },
        ],
        { name: 'addon', mode: 'addon' },
      ),
    /Hanya shop/,
  );
});
