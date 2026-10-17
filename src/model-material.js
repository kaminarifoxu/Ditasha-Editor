import { hashName } from './asset-tools.js';
const normalize = (name = '') =>
  name
    .split(/[\\/]/)
    .at(-1)
    .replace(/\.(yft|ydd|ydr|ytd|dds|png|jpe?g|webp)$/i, '')
    .toLowerCase();
export function textureNameMatches(name, candidate) {
  const key = normalize(name);
  return (
    normalize(candidate) === key ||
    (/^hash_[0-9a-f]{8}$/i.test(key) &&
      hashName(normalize(candidate)) === parseInt(key.slice(5), 16))
  );
}
// External replacements belong to a dictionary; embedded maps belong to one drawable.
export function resolveModelTexture(name, external, embedded, sourceName) {
  if (!name) return null;
  const matches = external.filter((texture) => textureNameMatches(name, texture.name));
  const source = normalize((sourceName || '').split(' · ')[0]).replace(/_hi$/, '');
  const owned = matches.filter((t) => normalize(t.dictionary).replace(/_hi$/, '') === source);
  if (owned.length) return owned.at(-1);
  const local = embedded.find((texture) => textureNameMatches(name, texture.name));
  if (matches.length === 1) return matches[0];
  return local || null;
}
// Opaque vehicle presets (bucket 0), checked against szio/gta5/Shaders.xml.
// Their diffuse alpha is shader data, not surface transparency.
const opaqueVehicle = new Set(
  [
    'vehicle_mesh',
    'vehicle_tire',
    'vehicle_tire_emissive',
    'vehicle_paint4',
    'vehicle_paint1',
    'vehicle_mesh2_enveff',
    'vehicle_interior2',
    'vehicle_detail2',
    'vehicle_shuts',
    'vehicle_paint3',
    'vehicle_licenseplate',
    'vehicle_emissive_opaque',
    'vehicle_dash_emissive_opaque',
    'vehicle_paint2',
    'vehicle_paint8',
    'vehicle_interior',
    'vehicle_paint6_enveff',
    'vehicle_track2',
    'vehicle_detail',
    'vehicle_paint4_enveff',
    'vehicle_paint9',
    'vehicle_cloth',
    'vehicle_basic',
    'vehicle_track',
    'vehicle_generic',
    'vehicle_track_ammo',
    'vehicle_track_emissive',
    'vehicle_paint5_enveff',
    'vehicle_paint6',
    'vehicle_paint1_enveff',
    'vehicle_mesh_enveff',
    'vehicle_track2_emissive',
    'vehicle_paint3_enveff',
    'vehicle_paint2_enveff',
    'vehicle_paint7_enveff',
    'vehicle_paint7',
    'vehicle_paint4_emissive',
    'vehicle_paint3_lvr',
    'vehicle_cloth2',
    'vehicle_mesh_enveff_reflect',
    'vehicle_dash',
  ].flatMap((n) => [hashName(n), hashName(n + '.sps')]),
);
export function modelAlphaMode(geometry, override = 'auto') {
  if (override !== 'auto') return override;
  return opaqueVehicle.has(geometry.shaderHash) || opaqueVehicle.has(geometry.shaderFileHash)
    ? 'opaque'
    : 'blend';
}
