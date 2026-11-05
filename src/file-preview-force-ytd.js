// Preview-only automatic filename-paired diffuse recovery.
// Native YDD/YTD bytes and material shader names are never modified.
const dataMapName = /(?:^|[_\-.])(normal|nrm|norm|bump|spec|specular|rough|metal|mask|ao|n|s)(?:[_\-.]|$)/i;
export function availableDiffuseTextures(textures) {
  if (!Array.isArray(textures)) return [];
  return textures.filter((t) => t && typeof t.name === 'string' &&
    t.out && Number.isInteger(t.w) && Number.isInteger(t.h) &&
    !dataMapName.test(t.name));
}
export function automaticPairedDiffuse(name, textures, embedded, sourceName, resolve) {
  if (!name) return null;
  // The external YTD was paired by *filename/collection* upstream.
  // Prefer its exact sampler match over an embedded grey placeholder.
  const matched = resolve(name, textures, [], sourceName);
  if (matched) return matched;
  const candidates = availableDiffuseTextures(textures);
  if (candidates.length === 1) return candidates[0];
  // Several images without a matching sampler are ambiguous; leave the
  // original embedded map intact rather than painting an unrelated atlas.
  return resolve(name, [], embedded, sourceName);
}
// Compatibility for existing preview consumers; the UI no longer provides
// a manual Force YTD control.
export function forcedPreviewDiffuse(name, textures, embedded, sourceName, resolve, force = false) {
  return force ? automaticPairedDiffuse(name, textures, embedded, sourceName, resolve)
    : resolve(name, textures, embedded, sourceName);
}
