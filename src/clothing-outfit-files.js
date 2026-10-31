// Pure selection of imported freemode model/texture files for a saved outfit.
export function resolveOutfitEntries(packs, slots) {
  if (!Array.isArray(packs) || !Array.isArray(slots) || !slots.length) throw Error('Outfit kosong.');
  const selected = [];
  for (const slot of slots) {
    const pack = packs.find(item => item.id === slot.packId);
    const model = pack?.files?.find(file =>
      file.relativePath === slot.relativePath && /\.ydd$/i.test(file.name));
    if (!model) throw Error('Model outfit tidak ditemukan di Clothing Library: ' + (slot.component || '?'));
    selected.push({packId: pack.id, entry: model});
    const related = pack.files.filter(file =>
      /\.ytd$/i.test(file.name) &&
      file.component === model.component &&
      file.drawable === model.drawable &&
      (slot.textureVariant == null || file.textureVariant === slot.textureVariant));
    for (const entry of related) selected.push({packId:pack.id,entry});
  }
  return selected;
}
