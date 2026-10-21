import test from 'node:test';
import assert from 'node:assert/strict';
import { assetKind, textureCap, previewCompanions } from '../src/compressor-plan.js';
test('Batch profiles keep independent per-file caps without assuming uniform author resolutions', () => {
  assert.equal(assetKind('mlo/stream/wall.ytd'), 'mlo');
  assert.equal(assetKind('mp_f_freemode_01^jbib_000_u.ydd'), 'clothing');
  assert.equal(assetKind('ped/stream/body.ytd'), 'ped');
  assert.equal(assetKind('car.yft'), 'vehicle');
  assert.equal(textureCap({ kind: 'mlo' }, { mlo: 2048 }), 2048);
  assert.equal(textureCap({ kind: 'mlo', maxSize: 4096 }, { mlo: 2048 }), 4096);
});
test('Preview pairing separates resources and clothing collections while exposing variants', () => {
  const model = { path: 'pack/stream/mp_f_freemode_01_shop^jbib_000_u.ydd' },
    paths = [
      'pack/stream/mp_f_freemode_01_shop^jbib_diff_000_a_uni.ytd',
      'pack/stream/mp_f_freemode_01_shop^jbib_diff_000_b_uni.ytd',
      'pack/stream/mp_f_freemode_01_other^jbib_diff_000_a_uni.ytd',
      'other/stream/mp_f_freemode_01_shop^jbib_diff_000_a_uni.ytd',
    ];
  assert.deepEqual(
    previewCompanions(
      model,
      paths.map((path) => ({ path })),
    ).map((e) => e.path),
    paths.slice(0, 2),
  );
  assert.deepEqual(
    previewCompanions({ path: 'cars/a_hi.yft' }, [
      { path: 'cars/a.ytd' },
      { path: 'cars/a_hi.ytd' },
      { path: 'other/a.ytd' },
    ]).length,
    2,
  );
});
