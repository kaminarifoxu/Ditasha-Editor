import {
  resolveModelTexture,
  textureDictionaryFamily,
  textureParentChain,
  textureNameMatches,
} from './model-material.js';
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

// Vehicle dictionaries must never inherit the currently selected ped's texture scope.
export function vehicleTextureTarget(file, candidates, textures = [], parents = []) {
  const vehicles = candidates.filter((a) => ['vehicle', 'vehicle-part'].includes(a.kind));
  const family = textureDictionaryFamily(file.name);
  if (family === 'vehshare') return null;
  const unique = (rows) => (rows.length === 1 ? rows[0] : null);
  const exact = vehicles.filter((a) => textureDictionaryFamily(a.name) === family);
  const root = unique(exact.filter((a) => a.kind === 'vehicle')) || unique(exact);
  if (root) return root;
  const inherited = unique(
    vehicles.filter((a) => textureParentChain(a.name, parents).includes(family)),
  );
  if (inherited) return inherited;
  const folder = (f) =>
    String(f?.webkitRelativePath || '')
      .replaceAll('\\', '/')
      .split('/')
      .slice(0, -1)
      .join('/')
      .toLowerCase();
  const directory = folder(file);
  const nearby = directory ? vehicles.filter((a) => folder(a.file) === directory) : [];
  if (nearby.length === 1) return nearby[0];
  const referenced = vehicles.filter((a) =>
    (a.drawables || []).some((d) =>
      d.lods.some((l) =>
        l.geometries.some((g) =>
          textures.some((t) => textureNameMatches(g.diffuseTexture || '', t)),
        ),
      ),
    ),
  );
  return unique(referenced.filter((a) => a.kind === 'vehicle')) || unique(referenced);
}
