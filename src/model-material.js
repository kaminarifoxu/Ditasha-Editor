import { hashName } from './asset-tools.js';
const normalize = (name = '') =>
  name.replace(/\.(yft|ydd|ydr|ytd|dds|png|jpe?g|webp)$/i, '').toLowerCase();
// External replacements belong to a dictionary; embedded maps belong to one drawable.
export function resolveModelTexture(name, external, embedded, sourceName) {
  if (!name) return null;
  const matches = external.filter((t) => normalize(t.name) === normalize(name));
  const source = normalize((sourceName || '').split(' · ')[0]).replace(/_hi$/, '');
  const owned = matches.filter((t) => normalize(t.dictionary).replace(/_hi$/, '') === source);
  if (owned.length) return owned.at(-1);
  const local = embedded.find((t) => normalize(t.name) === normalize(name));
  if (matches.length === 1) return matches[0];
  return local || null;
}
const opaqueVehicle = new Set(
  [
    'vehicle_mesh',
    'vehicle_mesh_enveff',
    'vehicle_mesh_enveff_reflect',
    'vehicle_paint1',
    'vehicle_paint2',
    'vehicle_paint3',
    'vehicle_paint4',
    'vehicle_tire',
    'vehicle_dash',
    'vehicle_interior',
    'vehicle_licenseplate',
  ].flatMap((n) => [hashName(n), hashName(n + '.sps')]),
);
export function modelAlphaMode(geometry, override = 'auto') {
  if (override !== 'auto') return override;
  return opaqueVehicle.has(geometry.shaderHash) || opaqueVehicle.has(geometry.shaderFileHash)
    ? 'opaque'
    : 'blend';
}
