// Preview-only material decisions. Never rewrite source YDD/YTD alpha or UV data.
const smallDetail = /(?:eyelash|lashes|lash_|brow|eyebrow|haircard|hair_card|fringe|decal|tattoo)/i;
const opaqueFabric = /(?:^|[\^/])(jbib|uppr|lowr|hand|feet|accs|task)_(?:diff_)?\d/i;

export function textureAlphaStats(texture) {
  const bytes = texture?.out;
  if (!bytes || bytes.length < 4 || bytes.length % 4 !== 0) return null;
  let transparent = 0, partial = 0, opaque = 0;
  for (let i = 3; i < bytes.length; i += 4) {
    const a = bytes[i];
    if (a <= 8) transparent++;
    else if (a >= 247) opaque++;
    else partial++;
  }
  const pixels = bytes.length / 4;
  return { transparent, partial, opaque, pixels,
    transparentRatio: transparent / pixels, partialRatio: partial / pixels };
}

export function previewMaterialAlpha(geometry, texture, fileName, shaderAlpha = null) {
  const stats = textureAlphaStats(texture);
  const detail = smallDetail.test([geometry?.name, geometry?.diffuseTexture, fileName].join(' '));
  const fabric = opaqueFabric.test(fileName) && !detail;
  const hasCutout = !!stats && stats.transparent > 0;
  const hasBlend = !!stats && stats.partial > 0;
  // GTA clothing alpha can carry masks and material data. Never turn ordinary
  // opaque fabrics transparent based on diffuse alpha alone.
  if (fabric && shaderAlpha?.mode !== 'cutout')
    return { transparent: false, alphaTest: 0, depthWrite: true, side: 'front' };
  if (shaderAlpha?.mode === 'opaque' && !detail)
    return { transparent: false, alphaTest: 0, depthWrite: true, side: 'front' };
  if (shaderAlpha?.mode === 'cutout' || (detail && hasCutout))
    return { transparent: false, alphaTest: shaderAlpha?.cutoff || 0.25, depthWrite: true, side: 'double' };
  if (shaderAlpha?.mode === 'blend' || (detail && hasBlend))
    return { transparent: true, alphaTest: 0.005, depthWrite: false, side: 'double' };
  if (hasCutout && !fabric)
    return { transparent: false, alphaTest: 0.15, depthWrite: true, side: 'double' };
  return { transparent: false, alphaTest: 0, depthWrite: true, side: 'front' };
}

/**
 * A preview variant must only assign textures matching the material sampler.
 * The old single-texture fallback mapped an unrelated atlas to every submesh.
 */
export function resolveVariantDiffuse(name, textures, embedded, sourceName, resolve) {
  return resolve(name, textures, embedded, sourceName);
}
