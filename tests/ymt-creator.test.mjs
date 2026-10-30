import test from 'node:test';
import assert from 'node:assert/strict';
import {
  scanClothing,
  buildYmtDocuments,
  buildYmtResource,
  resourceManifest,
  hashValues,
  collectionName,
  YMT_MAX_BYTES,
} from '../src/ymt-creator.js';
import { openArchive } from '../src/archives.js';
const scan = (names, options = {}) =>
  scanClothing(
    names.map((path) => ({ path })),
    { collection: 'ditasha_test', gender: 'm', autoRename: false, ...options },
  );
const pair = ['jbib_000_u.ydd', 'jbib_diff_000_a_uni.ytd'];
test('YMT metadata groups freemode male/female components, prop anchors, races, alternatives and cloth', () => {
  const plan = scan([
    ...pair,
    'jbib_000_u_1.ydd',
    'jbib_000_u.yld',
    'p_head_000.ydd',
    'p_head_diff_000_a.ytd',
    'female/lowr_000_r.ydd',
    'female/lowr_diff_000_a_whi.ytd',
  ]);
  assert.deepEqual(plan.errors, []);
  const docs = buildYmtDocuments(plan),
    male = docs.find((d) => d.name.endsWith('mp_m_freemode_01_ditasha_test.ymt.xml')).data,
    female = docs.find((d) => d.name.endsWith('mp_f_freemode_01_ditasha_test.ymt.xml')).data;
  assert.match(male, /<availComp>255 255 255 255 255 255 255 255 255 255 255 0<\/availComp>/);
  assert.match(male, /<numAlternatives value="1"/);
  assert.match(male, /<ownsCloth value="true"/);
  assert.match(male, /<numAvailProps value="1"/);
  assert.match(male, /<anchor>ANCHOR_HEAD<\/anchor>/);
  assert.match(male, /<props>1<\/props>/);
  assert.match(female, /<propMask value="17"/);
  assert.match(female, /<texId value="1"/);
  assert.equal(
    plan.files.find((f) => f.slot === 'p_head').output,
    'stream/mp_m_freemode_01_p_ditasha_test^p_head_000.ydd',
  );
  assert.match(docs.find((d) => d.name === 'fxmanifest.lua').data, /SHOP_PED_APPAREL_META_FILE/);
  assert.match(docs.find((d) => d.name.startsWith('mp_f_')).data, /SCR_CHAR_MULTIPLAYER_F/);
});
test('Names with gaps, conflicting source collections, missing models and mismatched skin suffixes cannot generate metadata', () => {
  for (const names of [
    ['jbib_005_u.ydd', 'jbib_diff_005_a_uni.ytd'],
    ['jbib_000_u.ydd', 'jbib_diff_000_b_uni.ytd'],
    ['jbib_000_u.ydd', 'jbib_diff_000_a_whi.ytd'],
    ['jbib_000_r.ydd', 'jbib_diff_000_a_uni.ytd'],
    ['jbib_diff_000_a_uni.ytd'],
    ['jbib_000_u.ydd'],
    [...pair, 'jbib_000_u_2.ydd'],
    [...pair, 'mp_m_freemode_01_other^jbib_000_u.ydd'],
    ['p_head_000_u.ydd', 'p_head_diff_000_a.ytd'],
    ['../jbib_000_u.ydd', pair[1]],
    ['a_m_m_custom^jbib_000_u.ydd', pair[1]],
  ]) {
    const plan = scan(names);
    assert.ok(plan.errors.length, names.join(','));
    assert.throws(() => buildYmtDocuments(plan));
  }
  for (const name of ["x'\n", '../bad', 'MY_PACK', 'con', 'x'.repeat(41)])
    assert.throws(() => collectionName(name));
});
test('Explicit ped prefix wins over folders and fallback; collection identity does not merge duplicate source slots', () => {
  const plan = scan([
    'male/mp_f_freemode_01_original^jbib_000_u.ydd',
    'male/mp_f_freemode_01_original^jbib_diff_000_a_uni.ytd',
  ]);
  assert.deepEqual(plan.errors, []);
  assert.equal(plan.groups[0].sex, 'f');
  const implicit = scan(pair, { gender: 'f' });
  assert.equal(implicit.groups[0].sex, 'f');
});
test('YMT resource ZIP preserves asset bytes and emits XML plus explicit binary-conversion instructions', async () => {
  const inputs = pair.map((path, i) => ({ path, data: new Uint8Array([82, 83, 67, 55, i, 255]) }));
  const plan = scanClothing(inputs, { collection: 'sample', gender: 'm' });
  const bytes = await buildYmtResource(plan),
    archive = await openArchive(new Blob([bytes]), 'sample.zip');
  for (const input of inputs) {
    const mapped = plan.files.find((f) => f.entry === input).output;
    const entry = archive.entries.find(
      (e) => e.path === 'sample/' + mapped || e.name === 'sample/' + mapped,
    );
    assert.ok(entry, mapped);
    assert.deepEqual(new Uint8Array(await archive.extract(entry)), input.data);
  }
  assert.ok(
    !archive.entries.some((e) => /\.ymt$/.test(e.path || e.name)),
    'XML must never be mislabeled binary YMT',
  );
  const readme = archive.entries.find((e) => (e.path || e.name).endsWith('README.txt'));
  assert.match(new TextDecoder().decode(await archive.extract(readme)), /REQUIRES CONVERSION/);
  await assert.rejects(() => buildYmtResource(scan(pair)), /Nama saja/);
  const large = scanClothing(
    [
      {
        path: pair[0],
        file: {
          size: YMT_MAX_BYTES,
          arrayBuffer() {
            throw Error('should not read');
          },
        },
      },
      { path: pair[1], data: new Uint8Array(1) },
    ],
    { collection: 'sample', gender: 'm' },
  );
  await assert.rejects(() => buildYmtResource(large), /128 MB/);
});
test('Hash calculator provides GTA joaat representations and manifest output rejects Lua injection/traversal', () => {
  assert.deepEqual(hashValues('adder'), {
    unsigned: 3078201489,
    signed: -1216765807,
    hex: '0xB779A091',
  });
  assert.deepEqual(hashValues('ADDER'), hashValues('adder'));
  const lua = resourceManifest({
    client: 'client/*.lua',
    server: 'server.lua',
    shared: '@ox_lib/init.lua',
    nui: 'html/index.html',
    dependencies: 'ox_lib',
  });
  assert.match(lua, /client\/\*\.lua/);
  assert.match(lua, /@ox_lib\/init.lua/);
  assert.match(lua, /ui_page 'html\/index.html'/);
  for (const input of [
    { client: "a.lua' os.execute('bad')" },
    { server: '../server.lua' },
    { nui: 'https://remote/page' },
    { dependencies: '../resource' },
  ])
    assert.throws(() => resourceManifest(input));
});
