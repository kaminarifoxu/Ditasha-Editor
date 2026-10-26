import test from 'node:test';
import assert from 'node:assert/strict';
import {
  scanClothing,
  buildYmtDocuments,
  buildYmtResource,
  normalizeCollectionName,
} from '../src/ymt-creator.js';
import { createYtd, hashName } from '../src/asset-tools.js';
import { clothingAssetHints } from '../src/resource.js';
import { performResourceJob } from '../src/resource-jobs.js';
import { openArchive } from '../src/archives.js';
import { testYdd } from './format.test.mjs';
import { deflateRaw } from 'pako';
const plan = (names, options = {}) =>
  scanClothing(
    names.map((path) => (typeof path === 'string' ? { path } : path)),
    { collection: 'DitashaHair1', ...options },
  );
const hints = (name) => ({ names: [name], keys: [hashName(name)] });

test('screenshot collection names and noncontiguous indices/letters normalize together without merging authors', () => {
  const entries = [
    'Hair-1/mp_f_freemode_01_newhairset_01^hair_073_u.ydd',
    'Hair-1/mp_f_freemode_01_newhairset_01^hair_diff_073_d_uni.ytd',
    'Hair-1/mp_f_freemode_01_newhairset_01^hair_diff_073_z_uni.ytd',
    'Hair-1/mp_f_freemode_01_other^hair_073_u.ydd',
    'Hair-1/mp_f_freemode_01_other^hair_diff_073_b_uni.ytd',
    'Hair-1/mp_f_freemode_01_other^hair_073_u_7.ydd',
    'Hair-1/mp_f_freemode_01_other^hair_073_u.yld',
  ];
  const result = plan(entries);
  assert.deepEqual(result.errors, []);
  assert.equal(result.collection, 'ditashahair1');
  assert.deepEqual(
    result.groups.map((g) => g.index),
    [0, 1],
  );
  assert.ok(result.files.every((f) => f.sex === 'f'));
  assert.ok(
    result.files
      .find((f) => f.path.endsWith('_z_uni.ytd'))
      .output.endsWith('hair_diff_000_b_uni.ytd'),
  );
  assert.ok(result.files.find((f) => f.kind === 'alternative').output.endsWith('_001_u_1.ydd'));
  assert.equal(new Set(result.files.map((f) => f.output)).size, entries.length);
  const xml = buildYmtDocuments(result).find((d) => d.name.endsWith('.ymt.xml')).data;
  assert.match(xml, /<pedXml_drawblIdx value="1"/);
});
test('arbitrary names and unrelated numbers pair using internal diffuse names, including unknown gender on YTD', () => {
  const entries = [
    { path: 'mp_f_freemode_01_original^Random 742.ydd', hints: hints('hair_diff_142_a_uni') },
    { path: 'texture 9037.ytd', hints: hints('hair_diff_142_a_uni') },
  ];
  const result = plan(entries);
  assert.deepEqual(result.errors, []);
  assert.ok(result.files.every((f) => f.sex === 'f' && f.slot === 'hair' && f.index === 0));
  assert.equal(result.files[1].sourceModel, entries[0].path);
  assert.ok(result.files[1].output.endsWith('hair_diff_000_a_uni.ytd'));
});
test('content matches disambiguate random flat files with a bulk type; no input objects are mutated', () => {
  const entries = [
    { path: 'Model 45.ydd', hints: hints('red_fabric') },
    { path: 'aaa 700.ytd', hints: hints('blue_fabric') },
    { path: 'Model 88.ydd', hints: hints('blue_fabric') },
    { path: 'zzz 17.ytd', hints: hints('red_fabric') },
  ].map(Object.freeze);
  const result = plan(entries, { defaultSlot: 'hair' });
  assert.deepEqual(result.errors, []);
  assert.equal(result.files.find((f) => f.path === 'aaa 700.ytd').sourceModel, 'Model 88.ydd');
  assert.equal(result.files.find((f) => f.path === 'zzz 17.ytd').sourceModel, 'Model 45.ydd');
  const reverse = plan([...entries].reverse(), { defaultSlot: 'hair' });
  const map = (p) => p.files.map((f) => [f.path, f.output]).sort();
  assert.deepEqual(map(result), map(reverse));
  assert.ok(entries.every((e) => !Object.hasOwn(e, 'output')));
});
test('ambiguous random textures require a pairing choice, rather than a guessed slot or overwritten file', () => {
  const entries = [
    { path: 'a.ydd' },
    { path: 'b.ydd' },
    { path: 'first.ytd' },
    { path: 'second.ytd' },
  ];
  const ambiguous = plan(entries, { defaultSlot: 'hair' });
  assert.ok(ambiguous.errors.some((e) => e.includes('ambigu')));
  assert.throws(() => buildYmtDocuments(ambiguous));
  const resolved = plan(
    entries.map((e) => ({
      ...e,
      modelPath: e.path === 'first.ytd' ? 'a.ydd' : e.path === 'second.ytd' ? 'b.ydd' : undefined,
    })),
    { defaultSlot: 'hair' },
  );
  assert.deepEqual(resolved.errors, []);
  assert.ok(
    resolved.files.find((f) => f.path === 'second.ytd').output.endsWith('hair_diff_001_a_uni.ytd'),
  );
});
test('unique folder pairs can have unrelated names/numbers; shared generic content still respects known indices', () => {
  const result = plan(['Hair-9/whatever17.ydd', 'Hair-9/different822.ytd']);
  assert.deepEqual(result.errors, []);
  const generic = plan([
    { path: 'hair_77_u.ydd', hints: hints('diffuse') },
    { path: 'hair_99_u.ydd', hints: hints('diffuse') },
    { path: 'hair_diff_77_b_uni.ytd', hints: hints('diffuse') },
    { path: 'hair_diff_99_c_uni.ytd', hints: hints('diffuse') },
  ]);
  assert.deepEqual(generic.errors, []);
  assert.equal(
    generic.files.find((f) => f.path === 'hair_diff_99_c_uni.ytd').sourceModel,
    'hair_99_u.ydd',
  );
});
test('unsafe paths, missing pairs, ambiguous types and game limits remain blocked', () => {
  for (const entries of [
    ['../hair_7_u.ydd', 'hair_diff_7_a_uni.ytd'],
    ['random.ydd', 'tex.ytd'],
    ['hair_7_u.ydd'],
    ['hair_diff_7_a_uni.ytd'],
    ['hair_7_u.ydd', 'hair_7_u.ydd', 'hair_diff_7_a_uni.ytd'],
  ])
    assert.ok(plan(entries).errors.length, entries.join(','));
  const tooMany = plan(
    Array.from({ length: 129 }, (_, i) => [
      `hair_${i + 1000}_u.ydd`,
      `hair_diff_${i + 1000}_a_uni.ytd`,
    ]).flat(),
  );
  assert.ok(tooMany.errors.some((e) => e.includes('128')));
  assert.equal(normalizeCollectionName('My Hair Pack!'), 'my_hair_pack');
  assert.equal(normalizeCollectionName('123 Hair'), 'ditasha_123_hair');
  assert.throws(() => normalizeCollectionName('...'));
});
test('unisex and race-specific source pairs sharing an index stay distinct', () => {
  const result = plan([
    'hair_73_u.ydd',
    'hair_73_r.ydd',
    'hair_diff_73_a_uni.ytd',
    'hair_diff_73_a_whi.ytd',
  ]);
  assert.deepEqual(result.errors, []);
  assert.equal(result.files.find((f) => f.path.endsWith('_uni.ytd')).sourceModel, 'hair_73_u.ydd');
  assert.equal(result.files.find((f) => f.path.endsWith('_whi.ytd')).sourceModel, 'hair_73_r.ydd');
});
test('renamed resource ZIP retains exact original bytes and records source/output mapping', async () => {
  const entries = [
    { path: 'Hair-1/a88.ydd', data: new Uint8Array([1, 2, 3]) },
    { path: 'Hair-1/b45.ytd', data: new Uint8Array([4, 5, 6]) },
  ];
  const result = plan(entries);
  assert.deepEqual(result.errors, []);
  const archive = await openArchive(new Blob([await buildYmtResource(result)]), 'renamed.zip');
  for (const item of result.files) {
    const entry = archive.entries.find((e) => (e.path || e.name) === 'ditashahair1/' + item.output);
    assert.ok(entry);
    assert.deepEqual(new Uint8Array(await archive.extract(entry)), item.entry.data);
  }
  const mapping = archive.entries.find((e) =>
    (e.path || e.name).endsWith('ditasha-ymt-report.json'),
  );
  const report = JSON.parse(new TextDecoder().decode(await archive.extract(mapping)));
  assert.equal(report.mapping[0].source, 'Hair-1/a88.ydd');
});
test('lightweight resource hints use dictionary lookup hashes and shaders without requiring geometry/pixels', () => {
  const texture = { name: 'hair_diff_83_a_uni', w: 4, h: 4, out: new Uint8Array(64) };
  const bytes = createYtd([texture]);
  const info = performResourceJob('clothing-hints', bytes.buffer, { extension: 'ytd' });
  assert.deepEqual(info.names, [texture.name]);
  assert.ok(info.keys.includes(hashName(texture.name)));
  assert.ok(!JSON.stringify(info).includes('pixels'));
  const model = clothingAssetHints(testYdd, 'ydd');
  assert.ok(Array.isArray(model.names));
  const body = new Uint8Array(1536),
    v = new DataView(body.buffer);
  const ptr = (at, to) => v.setBigUint64(at, BigInt(0x50000000 + to), true);
  ptr(48, 64);
  v.setUint16(56, 1, true);
  ptr(64, 128);
  ptr(144, 256);
  ptr(272, 320);
  v.setUint16(280, 1, true);
  ptr(320, 384);
  ptr(384, 448);
  body[400] = 1;
  ptr(456, 512);
  v.setUint32(464, hashName('DiffuseSampler'), true);
  ptr(552, 640);
  body.set(new TextEncoder().encode('hair_diff_83_a_uni\0'), 640);
  const header = new Uint8Array(16),
    hv = new DataView(header.buffer);
  hv.setUint32(0, 0x37435352, true);
  hv.setUint32(4, 165, true);
  hv.setUint32(8, 0xa8000001, true);
  hv.setUint32(12, 0x58000000, true);
  const payload = deflateRaw(body),
    file = new Uint8Array(16 + payload.length);
  file.set(header);
  file.set(payload, 16);
  assert.deepEqual(clothingAssetHints(file.buffer, 'ydd').names, ['hair_diff_83_a_uni']);
  assert.throws(() => clothingAssetHints(testYdd, 'exe'));
});
