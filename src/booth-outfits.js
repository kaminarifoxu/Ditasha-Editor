export const MAX_BOOTH_MODELS = 100;
export const MAX_BOOTH_VERTICES = 5000000;
export const MAX_BOOTH_MODEL_BYTES = 1024 * 1024 ** 2;
export const OUTFIT_CATEGORIES = [
  ['tops', 'Baju / jaket', 'clothing'],
  ['undershirt', 'Kaos dalam', 'clothing'],
  ['pants', 'Celana / rok', 'clothing'],
  ['shoes', 'Sepatu', 'clothing'],
  ['bags', 'Tas / backpack', 'accessory'],
  ['vest', 'Vest / armor', 'clothing'],
  ['torso', 'Torso / tangan', 'clothing'],
  ['mask', 'Masker', 'accessory'],
  ['hair', 'Rambut', 'accessory'],
  ['hat', 'Topi / helm', 'accessory'],
  ['glasses', 'Kacamata', 'accessory'],
  ['ears', 'Anting', 'accessory'],
  ['wrist', 'Jam / gelang', 'accessory'],
  ['jewelry', 'Kalung / aksesori', 'accessory'],
  ['decals', 'Decal', 'clothing'],
  ['other', 'Lainnya', 'accessory'],
];
const slots = {
  jbib: 'tops',
  accs: 'undershirt',
  lowr: 'pants',
  feet: 'shoes',
  hand: 'bags',
  task: 'vest',
  uppr: 'torso',
  teef: 'jewelry',
  hair: 'hair',
  berd: 'mask',
  decl: 'decals',
  p_head: 'hat',
  p_eyes: 'glasses',
  p_ears: 'ears',
  p_lwrist: 'wrist',
  p_rwrist: 'wrist',
};
export function outfitCategory(name, requested = 'auto', kind = 'clothing') {
  if (kind === 'ped') return 'ped';
  if (requested !== 'auto') {
    if (!OUTFIT_CATEGORIES.some(([id]) => id === requested))
      throw Error('Kategori outfit tidak valid.');
    return requested;
  }
  const match = String(name)
    .toLowerCase()
    .match(/(?:^|[\/\\^])((?:p_)?[a-z]+)_\d+/);
  return slots[match?.[1]] || 'other';
}
export function outfitLabel(id) {
  return id === 'ped'
    ? 'Ped / tubuh'
    : OUTFIT_CATEGORIES.find(([key]) => key === id)?.[1] || 'Lainnya';
}
export function boothVertexCount(asset) {
  if (asset.gltf) {
    let count = 0;
    asset.gltf.scene.traverse((o) => {
      if (o.isMesh) count += o.geometry?.attributes.position?.count || 0;
    });
    return count;
  }
  return (asset.drawables || []).reduce(
    (n, d) => n + (d.geometries || []).reduce((s, g) => s + g.positions.length / 3, 0),
    0,
  );
}

// Keep a folder batch's texture dictionaries with the matching model, not its first item.
export function outfitTextureTarget(
  file,
  candidates,
  fallback,
  textures = [],
  references = () => [],
) {
  const path = (f) =>
    String(f?.webkitRelativePath || f?.name || '')
      .replaceAll('\\', '/')
      .toLowerCase();
  const folder = (f) => path(f).split('/').slice(0, -1).join('/');
  const stem = (f) =>
    String(f?.name || '')
      .replace(/\.[^.]+$/, '')
      .toLowerCase();
  const pick = (rows) => {
    const same = rows.filter((a) => folder(a.file) === folder(file));
    return same.length === 1 ? same[0] : rows.length === 1 ? rows[0] : null;
  };
  const exact = pick(candidates.filter((a) => stem(a.file) === stem(file)));
  if (exact) return exact;
  const identity = (f) => {
    const name = String(f?.name || '').toLowerCase();
    const m = name.match(/(?:^|[\/^])((?:p_)?[a-z]+)_(?:diff_)?(\d+)(?:_|\.)/);
    return m ? [name.includes('^') ? name.split('^')[0] : '', m[1], Number(m[2])].join(':') : null;
  };
  const key = identity(file),
    paired = key && pick(candidates.filter((a) => identity(a.file) === key));
  if (paired) return paired;
  const names = new Set(textures.map((t) => t.name.toLowerCase()));
  const matched = pick(
    candidates.filter((a) => references(a).some((name) => names.has(String(name).toLowerCase()))),
  );
  return matched || (candidates.length === 1 ? candidates[0] : fallback);
}
