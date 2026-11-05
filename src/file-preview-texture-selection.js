import { resolveModelTexture } from './model-material.js';

// Count external diffuse textures that the model actually references.
// A dictionary's filename alone does not prove it contains that sampler.
export function scorePreviewDictionary(geometries, textures, sourceName) {
  if (!Array.isArray(geometries) || !Array.isArray(textures)) return 0;
  const external = new Set(textures);
  let covered = 0;
  for (const geometry of geometries) {
    if (!geometry?.diffuseTexture) continue;
    const embedded = geometry.sourceEmbeddedTextures || [];
    const selected = resolveModelTexture(geometry.diffuseTexture, textures, embedded, sourceName);
    if (external.has(selected)) covered++;
  }
  return covered;
}

// Only fall back when the initial texture dictionary resolves no diffuse
// samplers. This prevents variant A from silently replacing a valid variant B.
export function shouldTryPreviewFallback(geometries, textures, sourceName) {
  return scorePreviewDictionary(geometries, textures, sourceName) === 0 &&
    geometries.some((g) => !!g?.diffuseTexture);
}
