const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { ClothingLibrary, metadataFor } = require('../electron/clothing-library.cjs');

test('identifies male freemode upper clothing', () => {
  assert.deepEqual(metadataFor('mp_m_freemode_01^jbib_012_u.ydd'), { gender: 'male', component: 'jbib', drawable: 12 });
});
test('persists custom imported clothing and removes it', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ditasha-clothing-'));
  try {
    const source = path.join(root, 'mp_f_freemode_01^lowr_001_u.ydd');
    await fs.writeFile(source, Buffer.from('test'));
    const library = new ClothingLibrary(path.join(root, 'library'));
    const item = await library.importFiles({ pack: 'Custom', files: [source] });
    assert.equal((await library.list())[0].files[0].component, 'lowr');
    const second = new ClothingLibrary(path.join(root, 'library'));
    assert.equal((await second.list()).length, 1);
    assert.equal(await second.remove(item.id), true);
    assert.equal((await second.list()).length, 0);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});


test('rejects a texture-only pack without saving a library record', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ditasha-invalid-pack-'));
  try {
    const source = path.join(root, 'mp_m_freemode_01^jbib_diff_001_a_uni.ytd');
    await fs.writeFile(source, Buffer.from('test-texture'));
    const library = new ClothingLibrary(path.join(root, 'library'));
    await assert.rejects(library.importFiles({ files: [source] }), /at least one YDD/);
    assert.deepEqual(await library.list(), []);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});
test('rejects duplicate source paths', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ditasha-dupes-'));
  try {
    const source = path.join(root, 'mp_m_freemode_01^jbib_001_u.ydd');
    await fs.writeFile(source, Buffer.from('test'));
    const library = new ClothingLibrary(path.join(root, 'library'));
    await assert.rejects(library.importFiles({ files: [source, source] }), /Duplicate source/);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});
