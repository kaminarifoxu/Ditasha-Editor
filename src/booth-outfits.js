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
  accs: 'jewelry',
  lowr: 'pants',
  feet: 'shoes',
  hand: 'bags',
  task: 'vest',
  uppr: 'torso',
  teef: 'undershirt',
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
