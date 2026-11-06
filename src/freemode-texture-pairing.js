// Pure freemode YDD/YTD pairing; never inspect private bytes or rewrite source textures.
// A matching drawable number is not sufficient across genders or addon collections.
export function freemodeIdentity(entry) {
  const file = entry?.file || entry;
  const name = String(entry?.name || file?.name || '').replaceAll('\\', '/').split('/').pop();
  const path = String(entry?.relativePath || file?.webkitRelativePath || name).replaceAll('\\', '/');
  const match = name.match(/^(?:(.+?)\^)?(head|hair|uppr|hand|lowr|feet|accs|jbib|teef)_(diff_)?(\d{3})_([^.]+)\.(ydd|ytd)$/i);
  if (!match) return null;
  const [, prefix, component, diffuse, index, suffix, ext] = match;
  if ((ext.toLowerCase() === 'ytd') !== !!diffuse) return null;
  const variant = diffuse ? suffix.match(/^([a-z])(?:_|$)/i)?.[1]?.toLowerCase() : null;
  if (diffuse && !variant) return null;
  const genderName = path.match(/mp_([mf])_freemode_01/i)?.[1]?.toLowerCase();
  // A path may originate in a gender-separated collection folder.
  const genderFolder = path.match(/(?:^|\/)(male|female)(?:\/|$)/i)?.[1]?.toLowerCase();
  const gender = genderName === 'm' ? 'male' : genderName === 'f' ? 'female' : genderFolder || entry?.gender || null;
  const collectionFolder = path.split('/').slice(0,-1).reverse().find(segment =>
    /^mp_[mf]_freemode_01(?:_[a-z0-9_]+)?$/i.test(segment));
  const collection = prefix?.toLowerCase() || entry?.collection?.toLowerCase() ||
    collectionFolder?.toLowerCase() || null;
  return { component: component.toLowerCase(), drawable: Number(index),
    gender, collection, variant, texture: ext.toLowerCase() === 'ytd' };
}
export function matchingFreemodeTextures(modelInput, textureInputs, { gender, variant } = {}) {
  const model = freemodeIdentity(modelInput);
  if (!model || model.texture) return [];
  if (gender && model.gender && model.gender !== gender) return [];
  const matches = [];
  for (const candidate of textureInputs) {
    const entry = freemodeIdentity(candidate);
    if (!entry?.texture || entry.component !== model.component || entry.drawable !== model.drawable) continue;
    if (gender && entry.gender && entry.gender !== gender) continue;
    if (model.gender && entry.gender && model.gender !== entry.gender) continue;
    if (model.collection && entry.collection && model.collection !== entry.collection) continue;
    // Do not use a different explicit collection as an implicit substitute.
    if (Boolean(model.collection) !== Boolean(entry.collection)) continue;
    if (variant != null && entry.variant !== variant) continue;
    matches.push({ file: candidate, variant: entry.variant });
  }
  return matches.sort((a,b) => a.variant.localeCompare(b.variant) ||
    String(a.file?.relativePath || a.file?.file?.webkitRelativePath || a.file?.name || '').localeCompare(
      String(b.file?.relativePath || b.file?.file?.webkitRelativePath || b.file?.name || '')));
}
export function selectFreemodeTexture(model, candidates, requestedVariant = 'a', gender) {
  const choices = matchingFreemodeTextures(model, candidates, { gender, variant: requestedVariant });
  return choices.length === 1 ? { status:'matched', file: choices[0].file } :
    { status:choices.length ? 'ambiguous' : 'missing', file:null };
}
