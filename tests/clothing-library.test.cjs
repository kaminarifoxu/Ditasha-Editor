const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { ClothingLibrary, metadataFor } = require('../electron/clothing-library.cjs');

test('identifies male freemode upper clothing', () => {
  assert.deepEqual(metadataFor('mp_m_freemode_01^jbib_012_u.ydd'), { gender: 'male', component: 'jbib', drawable: 12, textureVariant: null });
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

test('reads persisted model bytes for preview after app reload', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ditasha-preview-'));
  try {
    const source = path.join(root, 'mp_m_freemode_01^jbib_005_u.ydd');
    await fs.writeFile(source, Buffer.from('example-model'));
    const library = new ClothingLibrary(path.join(root, 'library'));
    const pack = await library.importFiles({ files: [source] });
    const reopened = new ClothingLibrary(path.join(root, 'library'));
    const result = await reopened.readAsset(pack.id, pack.files[0].relativePath);
    assert.equal(result.name, path.basename(source));
    assert.equal(Buffer.from(result.bytes).toString(), 'example-model');
    await assert.rejects(reopened.readAsset(pack.id, '../index.json'), /Asset not found/);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});

test('renames saved pack and preserves name after restart', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ditasha-rename-'));
  try {
    const source = path.join(root, 'mp_m_freemode_01^jbib_001_u.ydd');
    await fs.writeFile(source, Buffer.from('model'));
    const library = new ClothingLibrary(path.join(root, 'library'));
    const pack = await library.importFiles({ files: [source] });
    await library.rename(pack.id, 'Custom Outfit');
    const reopened = new ClothingLibrary(path.join(root, 'library'));
    assert.equal((await reopened.list())[0].pack, 'Custom Outfit');
    await assert.rejects(reopened.rename(pack.id, '  '), /Invalid pack name/);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});

test('imports a nested clothing resource folder and persists textures', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ditasha-folder-'));
  try {
    const folder = path.join(root, 'resource');
    const stream = path.join(folder, 'stream', 'collection');
    await fs.mkdir(stream, { recursive: true });
    await fs.writeFile(path.join(stream, 'mp_f_freemode_01^jbib_003_u.ydd'), 'model');
    await fs.writeFile(path.join(stream, 'mp_f_freemode_01^jbib_diff_003_a_uni.ytd'), 'texture');
    await fs.writeFile(path.join(folder, 'ignored.txt'), 'ignore');
    const library = new ClothingLibrary(path.join(root, 'library'));
    const pack = await library.importDirectory({ pack: 'Nested Pack', directory: folder });
    assert.equal(pack.files.length, 2);
    assert.equal((await new ClothingLibrary(path.join(root, 'library')).list())[0].files.length, 2);
    assert.equal(pack.files.find(x => /\.ytd$/i.test(x.name)).component, 'jbib');
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});

test('pairs drawable and multiple texture variations from GTA naming', () => {
  const model = metadataFor('mp_f_freemode_01^jbib_003_u.ydd');
  const textureA = metadataFor('mp_f_freemode_01^jbib_diff_003_a_uni.ytd');
  const textureB = metadataFor('mp_f_freemode_01^jbib_diff_003_b_uni.ytd');
  assert.equal(model.drawable, 3);
  assert.equal(textureA.component, 'jbib');
  assert.equal(textureA.drawable, 3);
  assert.equal(textureA.textureVariant, 'a');
  assert.equal(textureB.textureVariant, 'b');
  assert.equal(textureA.gender, 'female');
});

test('saves freemode outfit with multiple drawable parts across restart', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ditasha-outfit-'));
  try {
    const sources = ['mp_m_freemode_01^jbib_001_u.ydd', 'mp_m_freemode_01^lowr_002_u.ydd',
      'mp_m_freemode_01^jbib_diff_001_a_uni.ytd'].map(name => path.join(root,name));
    for(const source of sources) await fs.writeFile(source,'sample');
    const library = new ClothingLibrary(path.join(root,'library'));
    const pack = await library.importFiles({files:sources});
    const top=pack.files.find(f=>f.component==='jbib' && /\.ydd$/i.test(f.name));
    const pants=pack.files.find(f=>f.component==='lowr');
    const preset=await library.saveOutfit({name:'My Outfit',gender:'male',slots:[
      {packId:pack.id,relativePath:top.relativePath,textureVariant:'a'},
      {packId:pack.id,relativePath:pants.relativePath}
    ]});
    const reopened = new ClothingLibrary(path.join(root,'library'));
    assert.equal((await reopened.listOutfits())[0].id,preset.id);
    await assert.rejects(reopened.saveOutfit({name:'Wrong',gender:'female',slots:[
      {packId:pack.id,relativePath:top.relativePath}]}),/incompatible/);
    assert.equal(await reopened.removeOutfit(preset.id),true);
    assert.deepEqual(await reopened.listOutfits(),[]);
  } finally { await fs.rm(root,{recursive:true,force:true}); }
});

test('prevents removing clothing packs referenced by saved outfit presets', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ditasha-outfit-guard-'));
  try {
    const source = path.join(root, 'mp_m_freemode_01^jbib_001_u.ydd');
    await fs.writeFile(source, 'model');
    const library = new ClothingLibrary(path.join(root, 'library'));
    const pack = await library.importFiles({files:[source]});
    const outfit = await library.saveOutfit({name:'Protected outfit',gender:'male',slots:[{packId:pack.id,relativePath:pack.files[0].relativePath}]});
    await assert.rejects(library.remove(pack.id), /Protected outfit/);
    assert.equal((await library.list()).length, 1);
    await library.removeOutfit(outfit.id);
    assert.equal(await library.remove(pack.id),true);
    assert.deepEqual(await library.list(),[]);
  } finally { await fs.rm(root,{recursive:true,force:true}); }
});
