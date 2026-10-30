import { resolveModelTexture, textureNameMatches } from './model-material.js';

// Explicit viewport overrides never rename a sampler in the source asset.
export function resolveEditorDiffuse(binding, external, embedded, source) {
  const override = binding.previewDiffuseOverride;
  if (override) {
    const selected = external.find(
      (t) => t.name === override.name && t.dictionary === override.dictionary,
    );
    // A previously selected YTD can disappear when switching model folders or
    // reloading dictionaries. Do not leave the model grey because of a stale
    // preview-only override: resolve its original sampler instead.
    if (selected) return selected;
  }
  return resolveModelTexture(binding.diffuseTexture, external, embedded, source);
}

export function editorTextureMatches(binding, texture, source) {
  const override = binding.previewDiffuseOverride;
  return override
    ? texture.name === override.name && texture.dictionary === override.dictionary
    : textureNameMatches(binding.diffuseTexture || '', texture);
}
