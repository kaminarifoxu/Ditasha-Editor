// Explicit preview override only. It never changes the native model material
// sampler, YDD, or YTD file, and cannot enable itself without user action.
const dataMapName = /(?:^|[_\-.])(normal|nrm|norm|bump|spec|specular|rough|metal|mask|ao|n|s)(?:[_\-.]|$)/i;
export function forcedPreviewDiffuse(name, textures, embedded, sourceName, resolver, force = false) {
  const matched = resolver(name, textures, embedded, sourceName);
  if (!force || !Array.isArray(textures)) return matched;
  // A forced dictionary wins over an embedded fallback if it contains the
  // actual named diffuse sampler. Never steal a map from a different YTD.
  const externalMatch = resolver(name, textures, [], sourceName);
  if (externalMatch) return externalMatch;
  const candidates = textures.filter((t) => t && typeof t.name === 'string' &&
    t.out && Number.isInteger(t.w) && Number.isInteger(t.h) &&
    !dataMapName.test(t.name));
  // Fallback only when unambiguous. Multiple diffuse maps require a selected map
  // per material, otherwise forcing one atlas across all submeshes is unsafe.
  return candidates.length === 1 ? candidates[0] : null;
}
