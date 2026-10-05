import { safePath, zipFiles, MAX_EXPORT } from './asset-tools.js';
const slots = {
  head: 'Head',
  berd: 'Mask',
  hair: 'Hair',
  uppr: 'Torso',
  lowr: 'Legs',
  hand: 'Bag',
  feet: 'Shoes',
  teef: 'Accessories',
  accs: 'Undershirt',
  task: 'Armor',
  decl: 'Decal',
  jbib: 'Top',
  p_head: 'Hat',
  p_eyes: 'Glasses',
  p_ears: 'Ears',
  p_lwrist: 'Left wrist',
  p_rwrist: 'Right wrist',
};
export function clothingInfo(name) {
  const gender = /mp_f_freemode/i.test(name)
    ? 'Female'
    : /mp_m_freemode/i.test(name)
      ? 'Male'
      : 'Unknown';
  const m = name.match(/(?:^|[\/^])((?:p_)?[a-z]+)_(?:diff_)?(\d{3})(?:_|\.)/i);
  return {
    gender,
    slot: slots[m?.[1]?.toLowerCase()] || 'Other',
    index: m ? Number(m[2]) : null,
    key: gender + ' · ' + (slots[m?.[1]?.toLowerCase()] || 'Other') + ' · ' + (m?.[2] || name),
  };
}
export function importPath(path) {
  path = path.replace(/\\/g, '/');
  const stream = path.toLowerCase().indexOf('/stream/');
  if (stream >= 0) return safePath(path.slice(stream + 1));
  if (path.toLowerCase().startsWith('stream/')) return safePath(path);
  const base = path.split('/').at(-1);
  return safePath(/\.(ydd|ytd|ymt|yld)$/i.test(base) ? 'stream/' + base : base);
}
export function analyzePack(entries, mode) {
  const errors = [],
    warnings = [],
    seen = new Set();
  let models = 0,
    textures = 0;
  const metas = [],
    ymts = [];
  for (const e of entries) {
    try {
      safePath(e.path);
    } catch (err) {
      errors.push(err.message);
      continue;
    }
    const key = e.path.toLowerCase();
    if (seen.has(key)) errors.push('File duplikat: ' + e.path);
    seen.add(key);
    if (/\.ydd$/i.test(e.path)) {
      models++;
      if (!/mp_[mf]_freemode_01/i.test(e.path))
        errors.push('Nama model perlu prefix ped/collection: ' + e.path);
      const info = clothingInfo(e.path);
      const has = entries.some(
        (t) => /\.ytd$/i.test(t.path) && clothingInfo(t.path).key === info.key,
      );
      if (!has) warnings.push('Periksa tekstur model: ' + e.path);
    }
    if (/\.ytd$/i.test(e.path)) textures++;
    if (/\.ymt$/i.test(e.path)) ymts.push(e);
    if (/\.meta$/i.test(e.path)) metas.push(e);
  }
  if (!models) errors.push('Tambahkan sedikitnya satu model YDD.');
  if (mode === 'addon' && (!ymts.length || !metas.length))
    errors.push('Add-on memerlukan YMT dan shop .meta dari collection yang sama.');
  if (mode === 'replace' && (ymts.length || metas.length))
    errors.push('Pilih mode add-on untuk menyertakan YMT / shop metadata.');
  if (entries.reduce((n, e) => n + e.data.length, 0) > MAX_EXPORT - 65536)
    errors.push('Pack melebihi batas ekspor 128 MB.');
  return { errors, warnings, models, textures, ymts: ymts.length, metas: metas.length };
}
export function buildPack(entries, { name, mode = 'replace', note = '', version = 1 }) {
  if (!/^[a-z][a-z0-9_-]{0,63}$/.test(name))
    throw Error('Nama resource: mulai huruf kecil, gunakan a–z, angka, _ atau -.');
  const check = analyzePack(entries, mode);
  if (check.errors.length) throw Error(check.errors.join('\n'));
  const metas = entries.filter((e) => /\.meta$/i.test(e.path));
  for (const e of metas) {
    const text = new TextDecoder().decode(e.data);
    if (!/<ShopPedApparel[\s>]/.test(text))
      throw Error('Hanya shop apparel .meta yang dapat dikemas: ' + e.path);
  }
  const manifest = [
    "fx_version 'cerulean'",
    "game 'gta5'",
    "author 'Ditasha-Workshop'",
    `description 'Clothing pack ${name}'`,
    `version '${version}.0.0'`,
  ];
  if (metas.length) {
    manifest.push(
      'files {',
      ...metas.map((e) => `  '${e.path.replace(/'/g, "\\'")}',`),
      '}',
      ...metas.map(
        (e) => `data_file 'SHOP_PED_APPAREL_META_FILE' '${e.path.replace(/'/g, "\\'")}'`,
      ),
    );
  }
  const report = {
    name,
    mode,
    version,
    note,
    files: entries.map((e) => ({ path: e.path, size: e.data.length, ...clothingInfo(e.path) })),
    warnings: check.warnings,
  };
  const readme = `${name} — build ${version}\n© 2026 Ditasha-Workshop\n\n${note}\n\nInstallation:\nExtract ${name} into your server resources folder.\nAdd: ensure ${name}\nRestart the resource/server and check it in game.\n\n${mode === 'replace' ? 'Replacement pack: uses the existing drawable slots encoded in filenames.' : 'Existing add-on: original YMT, collection IDs, filenames and shop metadata are preserved.'}\nNo new YMT, slots, collection IDs or Enhanced resources are generated.\nVerify collection compatibility and conflicts on your server.\n\nFindings:\n${check.warnings.join('\n') || 'No filename findings.'}\n`;
  return zipFiles([
    ...entries.map((e) => ({ name: name + '/' + e.path, data: e.data })),
    { name: name + '/fxmanifest.lua', data: manifest.join('\n') + '\n' },
    { name: name + '/README.txt', data: readme },
    { name: name + '/ditasha-pack.json', data: JSON.stringify(report, null, 2) },
  ]);
}
