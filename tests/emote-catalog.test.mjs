import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmoteCatalog } from '../src/emote-catalog.js';
const file = (name, data = name) => new File([data], name);
const decoder =
  (count = 1, values = 8) =>
  async (file, prefix) => ({
    entries: Array.from({ length: count }, (_, index) => ({
      id: prefix + ':' + index,
      label: file.name + '/' + index,
      clip: { name: 'pose_' + index, duration: 2, tracks: [{ values: new Float32Array(8) }] },
      ycd: { animation: { large: new Float32Array(8) } },
    })),
    warnings: [],
    values,
    memoryBytes: values * 4,
  });
test('Catalog keeps more than 2048 clips without retaining every decoded animation and skips duplicate contents', async () => {
  const catalog = createEmoteCatalog({ decode: decoder(256), maxValues: 10 });
  for (let i = 0; i < 12; i++) await catalog.add(file(i + '.ycd'), 'external:' + i);
  assert.equal(catalog.entries.length, 3072);
  assert.equal(catalog.stats().residentFiles, 0);
  assert.equal(catalog.entries[0].ycd, undefined);
  assert.deepEqual(catalog.entries[0].clip.tracks, []);
  const duplicate = await catalog.add(file('renamed.ycd', '0.ycd'), 'external:100');
  assert.equal(duplicate.duplicate, true);
  assert.equal(duplicate.source.prefix, 'external:0');
  assert.equal(catalog.sources.length, 12);
});
test('Playback evicts inactive dictionaries, reloads on selection and refuses only oversized active combinations', async () => {
  let reads = 0;
  const catalog = createEmoteCatalog({
    maxValues: 10,
    decode: async (...args) => {
      reads++;
      return decoder()(...args);
    },
  });
  await catalog.add(file('a.ycd'), 'external:1');
  await catalog.add(file('b.ycd'), 'external:2');
  const [a, b] = catalog.entries;
  assert((await catalog.load([a])).get(a.id).ycd);
  await catalog.load([b]);
  assert.equal(catalog.stats().residentFiles, 1);
  await catalog.load([a]);
  assert.equal(reads, 5);
  await assert.rejects(catalog.load([a, b]), /aktif bersamaan/);
  assert.equal(catalog.sources.length, 2);
  assert((await catalog.load([b])).get(b.id).ycd);
});
test('Concurrent hydration shares one read and cannot double-count the same resident file', async () => {
  let reads = 0;
  const catalog = createEmoteCatalog({
    maxValues: 10,
    decode: async (...args) => {
      reads++;
      await new Promise((r) => setTimeout(r, 5));
      return decoder()(...args);
    },
  });
  await catalog.add(file('a.ycd'), 'external:1');
  const entry = catalog.entries[0];
  await Promise.all([catalog.load([entry]), catalog.load([entry])]);
  assert.equal(reads, 2);
  assert.equal(catalog.stats().residentFiles, 1);
});
test('Invalid files and catalog limits never erase the previously imported sources', async () => {
  const catalog = createEmoteCatalog({
    maxFiles: 1,
    decode: async (f, prefix) => {
      if (f.name === 'broken.ycd') throw Error('bad header');
      return decoder()(f, prefix);
    },
  });
  await assert.rejects(catalog.add(file('broken.ycd'), 'external:0'), /bad header/);
  await catalog.add(file('ok.ycd'), 'external:1');
  await assert.rejects(catalog.add(file('overflow.ycd'), 'external:2'), /2000 file/);
  assert.equal(catalog.entries[0].id, 'external:1:0');
});
