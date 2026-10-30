import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { freemodePart, validateAppearance } from '../src/freemode-character.js';
import { expandEmoteFiles } from '../src/emote-import.js';
import { zipFiles } from '../src/asset-tools.js';
import { createWeaponSketch, WEAPON_REFERENCES } from '../src/weapon-studio.js';
const require = createRequire(import.meta.url),
  { validateJob } = require('../electron/native-build.cjs');
test('freemode file matching keeps head hair sex and texture variants distinct', () => {
  const f = { name: 'mp_f_freemode_01^head_diff_046_a_whi.ytd' };
  assert.deepEqual(
    { ...freemodePart(f), file: undefined },
    { part: 'head', drawable: 46, texture: true, gender: 'female', file: undefined },
  );
  assert.equal(
    freemodePart({ name: 'hair_002_u.ydd', webkitRelativePath: 'mp_m_freemode_01/hair_002_u.ydd' })
      .gender,
    'male',
  );
  assert.equal(freemodePart({ name: 'vehicle.ydd' }), null);
  const value = {
    model: 'mp_m_freemode_01',
    components: [{ component_id: 2, drawable: 5, texture: 1 }],
  };
  assert.equal(validateAppearance(value), value);
  assert.equal(validateAppearance({ ...value, model: -1667301416 }).model, 'mp_f_freemode_01');
  assert.equal(
    validateAppearance({ ...value, hair: { style: 3000, texture: 0 } }).components.find(
      (c) => c.component_id === 2,
    ).drawable,
    3000,
  );
  assert.throws(() => validateAppearance({ ...value, model: 'arbitrary' }));
  assert.throws(() =>
    validateAppearance({ ...value, components: [{ component_id: 2, drawable: -1, texture: 1 }] }),
  );
});
test('ZIP emote import extracts animation sources and never evaluates scripts', async () => {
  const bytes = new Uint8Array([82, 83, 67, 55, 1, 2]);
  const zip = zipFiles([
    {
      name: 'client/AnimationListCustom.lua',
      data: new TextEncoder().encode('error("never execute")'),
    },
    { name: 'stream/pose.ycd', data: bytes },
  ]);
  const files = await expandEmoteFiles([new File([zip], 'RPEmotes.zip')]);
  assert.equal(files.length, 1);
  assert.equal(files[0].name, 'pose.ycd');
  assert.deepEqual(new Uint8Array(await files[0].arrayBuffer()), bytes);
  await assert.rejects(
    () => expandEmoteFiles([new File(['return {}'], 'AnimationList.lua')]),
    /Tidak ada file/,
  );
});
test('head workflows validate fitting transforms slot names and mode before native execution', () => {
  const payload = { mode: 'garment', headOptions: { enabled: true } };
  const job = validateJob(payload);
  assert.equal(job.headOptions.gender, 'mp_m');
  for (const option of [
    { scale: Infinity },
    { hairOffset: [0, 0, 3] },
    { headSlot: '../head.ydd' },
    { weights: 'guess' },
    { gender: 'animal' },
    { collection: '../escape' },
  ])
    assert.throws(() => validateJob({ ...payload, headOptions: { enabled: true, ...option } }));
  assert.throws(() => validateJob({ mode: 'probe', headOptions: { enabled: true } }));
});
test('weapon design blockouts are original bounded meshes with UVs and explicit model references', () => {
  assert(WEAPON_REFERENCES.some((x) => x[1] === 'WEAPON_CARBINERIFLE'));
  for (const kind of ['pistol', 'smg', 'rifle']) {
    const model = createWeaponSketch(kind);
    assert(model.name.includes('generik'));
    assert(model.children.length >= 4);
    for (const mesh of model.children) {
      assert(mesh.geometry.getAttribute('uv'));
      assert(mesh.geometry.attributes.position.count < 100);
      mesh.geometry.dispose();
      mesh.material.dispose();
    }
  }
});
