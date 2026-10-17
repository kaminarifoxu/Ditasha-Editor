import { hashName } from './asset-tools.js';
const normalize = (name = '') =>
  name
    .split(/[\\/]/)
    .at(-1)
    .replace(/\.(yft|ydd|ydr|ytd|dds|png|jpe?g|webp)$/i, '')
    .toLowerCase();
// Preserve copy suffixes: car_hi(1).yft belongs to car(1).ytd, not car(2).ytd.
export const textureDictionaryFamily = (name = '') =>
  normalize(name.split(' · ')[0]).replace(/_hi(?=(?:\s*\(\d+\))?$)/i, '');
export function textureDependency(name = '') {
  if (/^script_rt_/i.test(normalize(name))) return 'runtime';
  return /^(vehicle_generic_|vehiclelights|plate\d)/i.test(normalize(name)) ? 'shared' : 'asset';
}
export const isSharedDictionary = (name) => textureDictionaryFamily(name) === 'vehshare';
export function textureNameMatches(name, candidate) {
  const texture = typeof candidate === 'string' ? { name: candidate } : candidate;
  const key = normalize(name),
    candidateName = normalize(texture.name);
  const hash = /^hash_[0-9a-f]{8}$/i.test(key) ? parseInt(key.slice(5), 16) : hashName(key);
  return (
    candidateName === key ||
    (!!key && Number.isInteger(texture.nameHash) && texture.nameHash === hash) ||
    (/^hash_[0-9a-f]{8}$/i.test(key) && hashName(candidateName) === hash)
  );
}
// External replacements belong to a dictionary; embedded maps belong to one drawable.
export function resolveModelTexture(name, external, embedded, sourceName) {
  if (!name) return null;
  const matches = external.filter((texture) => textureNameMatches(name, texture));
  const source = textureDictionaryFamily(sourceName);
  const owned = matches.filter((t) => textureDictionaryFamily(t.dictionary) === source);
  if (owned.length) return owned.at(-1);
  const local = embedded.find((texture) => textureNameMatches(name, texture));
  if (matches.length === 1) return matches[0];
  const shared =
    textureDependency(name) === 'shared'
      ? matches.filter((t) => isSharedDictionary(t.dictionary))
      : [];
  return local || (shared.length === 1 ? shared[0] : null);
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

// Vehicle bucket-1 materials need continuous texture alpha. Ped cutout defaults
// must never turn a 45%-opaque window into an opaque surface.
const blendedVehicle = new Set(
  [
    'vehicle_vehglass',
    'vehicle_vehglass_inner',
    'vehicle_lights',
    'vehicle_lightsemissive',
    'vehicle_badges',
    'vehicle_decal',
    'vehicle_emissive_alpha',
    'vehicle_dash_emissive',
    'vehicle_blurredrotor',
    'vehicle_track_siren',
    'vehicle_blurredrotor_emissive',
    'vehicle_lightsemissive_siren',
  ].flatMap((name) => [hashName(name), hashName(name + '.sps')]),
);
export function modelPreviewAlpha(geometry, override = 'auto') {
  if (override !== 'auto') return { mode: override, cutoff: override === 'opaque' ? 0 : 0.02 };
  if (opaqueVehicle.has(geometry.shaderHash) || opaqueVehicle.has(geometry.shaderFileHash))
    return { mode: 'opaque', cutoff: 0 };
  if (blendedVehicle.has(geometry.shaderHash) || blendedVehicle.has(geometry.shaderFileHash))
    return { mode: 'blend', cutoff: 0.001 };
  return null;
}
