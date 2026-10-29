import { resolveModelTexture } from './model-material.js';
// Model-local replacements take precedence over a shared ped dictionary, even
// when the replacement file has a different name. Other ped scopes never enter.
export function resolveBoothTexture(name, textures, embedded, assetId, ownerId, sourceName) {
  const local = textures.filter((t) => t.boothOwner === assetId);
  const owned = textures.filter((t) => t.boothOwner === ownerId && t.boothOwner !== assetId);
  return (
    resolveModelTexture(name, local, [], sourceName) ||
    resolveModelTexture(name, owned, [], sourceName) ||
    resolveModelTexture(
      name,
      textures.filter((t) => t.boothOwner == null),
      embedded,
      sourceName,
    )
  );
}
export function replaceBoothTextureScope(state, ownerId, file, decoded) {
  if (!decoded.length) throw Error('YTD tidak berisi tekstur yang dapat dibaca.');
  const retained = state.textureFiles
    .map((file, i) => ({ file, owner: state.textureOwners[i] }))
    .filter((row) => row.owner !== ownerId);
  return {
    textures: [
      ...state.textures.filter((t) => t.boothOwner !== ownerId),
      ...decoded.map((t) => ({ ...t, boothOwner: ownerId })),
    ],
    textureFiles: [...retained.map((r) => r.file), file],
    textureOwners: [...retained.map((r) => r.owner), ownerId],
  };
}
