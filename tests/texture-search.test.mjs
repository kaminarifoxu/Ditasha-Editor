import test from 'node:test';
import assert from 'node:assert/strict';
import { createYtd, hashName } from '../src/asset-tools.js';
import { performResourceJob } from '../src/resource-jobs.js';
import { indexTextureFiles, planTextureSearch, loadSearchTextures } from '../src/texture-search.js';

const texture = (name) => ({ name, w: 1, h: 1, out: new Uint8Array([25, 50, 100, 255]) });
const file = (path, names) => {
  const data = createYtd(names.map(texture));
  return {
    name: path.split('/').at(-1),
    webkitRelativePath: path,
    size: data.length,
    arrayBuffer: async () => data.slice().buffer,
  };
};
const decode = async (...args) => performResourceJob(...args);

test('Folder indexing reads names without RGBA and decodes only requested maps under the remaining budget', async () => {
  const f = file('library/shared.ytd', ['tire_diffuse', 'unrelated']);
  const original = new Uint8Array(await f.arrayBuffer());
  const library = await indexTextureFiles([f, { name: 'ignored.rpf', size: 1 }], { decode });
  assert.equal(library.files, 1);
  assert.equal(library.entries.length, 2);
  assert(library.entries.every((t) => !('out' in t)));
  const plan = planTextureSearch(
    [{ name: 'TIRE_DIFFUSE.dds', source: 'bike_hi.yft' }],
    library.entries,
  );
  const loaded = await loadSearchTextures(plan.selected, {
    decode,
    usedBytes: 512 * 1024 ** 2 - 4,
  });
  assert.deepEqual(
    loaded.textures.map((t) => t.name),
    ['tire_diffuse'],
  );
  assert.equal(loaded.textures[0].searchPath, 'library/shared.ytd');
  assert.deepEqual([...loaded.textures[0].out], [25, 50, 100, 255]);
  assert.deepEqual(new Uint8Array(await f.arrayBuffer()), original);
  const denied = await loadSearchTextures(plan.selected, { decode, usedBytes: 512 * 1024 ** 2 });
  assert.equal(denied.textures.length, 0);
  assert.match(denied.errors[0].message, /limit/);
});

test('Search prefers the model dictionary, resolves hashes and refuses ambiguous or approximate names', async () => {
  const library = await indexTextureFiles(
    [
      file('lib/other.ytd', ['tire_diffuse']),
      file('lib/bike.ytd', ['tire_diffuse']),
      file('lib/spec.ytd', ['missing_spec']),
    ],
    { decode },
  );
  const hashed = 'hash_' + hashName('tire_diffuse').toString(16).padStart(8, '0');
  const own = planTextureSearch(
    [{ name: hashed, source: 'bike_hi.yft · drawable' }],
    library.entries,
  );
  assert.equal(own.selected[0].dictionary, 'bike.ytd');
  const ambiguous = planTextureSearch(
    [
      { name: 'tire_diffuse', source: 'car.yft' },
      { name: 'missing', source: 'car.yft' },
    ],
    library.entries,
  );
  assert.equal(ambiguous.selected.length, 0);
  assert.equal(ambiguous.ambiguous.length, 1);
  assert.equal(ambiguous.absent.length, 1);
  const duplicates = [
    ...library.entries,
    { ...library.entries[1], file: file('else/bike.ytd', ['tire_diffuse']) },
  ];
  assert.equal(
    planTextureSearch([{ name: hashed, source: 'bike.yft' }], duplicates).selected.length,
    0,
  );
});

test('Corrupt dictionaries are reported; cancellation never returns a partial repair; folder limits precede reads', async () => {
  const bad = { name: 'broken.ytd', size: 16, arrayBuffer: async () => new ArrayBuffer(16) };
  const good = file('lib/a.ytd', ['a']);
  const library = await indexTextureFiles([bad, good], { decode });
  assert.equal(library.errors.length, 1);
  assert.equal(library.entries.length, 1);
  const controller = new AbortController();
  await assert.rejects(
    indexTextureFiles([good], {
      decode,
      signal: controller.signal,
      progress: () => controller.abort(),
    }),
    { name: 'AbortError' },
  );
  const controller2 = new AbortController();
  await assert.rejects(
    loadSearchTextures(library.entries, {
      decode: async (...args) => {
        controller2.abort();
        return decode(...args);
      },
      signal: controller2.signal,
    }),
    { name: 'AbortError' },
  );
  await assert.rejects(indexTextureFiles(Array(1001).fill(good), { decode }), /1.000/);
});
