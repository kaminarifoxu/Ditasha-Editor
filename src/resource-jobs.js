import { MAX_YTD_INPUT_BYTES } from './texture-memory.js';
import { analyzeDebadge, removeVehicleParts } from './vehicle-debadge.js';
import {
  Resource,
  indexYtd,
  readYtd,
  readYdd,
  readYdr,
  readYft,
  clothingAssetHints,
} from './resource.js';
import { maskResourceGeometry } from './vehicle-resource.js';
import { optimizeYtd } from './texture-optimize.js';
export function performResourceJob(kind, buffer, options = {}) {
  const maxInput = [
    'texture-index',
    'texture-set',
    'textures',
    'ytd',
    'optimize-ytd',
    'clothing-hints',
  ].includes(kind)
    ? MAX_YTD_INPUT_BYTES
    : 64 * 1024 * 1024;
  if (!(buffer instanceof ArrayBuffer) || buffer.byteLength > maxInput)
    throw Error('Resource input maksimum ' + Math.round(maxInput / 1048576) + ' MB.');
  if (kind === 'debadge-read') return analyzeDebadge(buffer);
  if (kind === 'optimize-ytd') return optimizeYtd(buffer, options);
  if (kind === 'debadge-write') return removeVehicleParts(buffer, options.selected);
  if (kind === 'texture-index') return indexYtd(buffer);
  if (kind === 'clothing-hints') return clothingAssetHints(buffer, options.extension);
  if (kind === 'ytd') return readYtd(buffer, options);
  if (kind === 'texture-set') {
    const { textures, warnings } = readYtd(buffer, { ...options, tolerateErrors: true });
    return { textures, warnings };
  }
  if (kind === 'textures') return readYtd(buffer, options).textures;
  if (kind === 'mask') return maskResourceGeometry(buffer, options.selected, options.extension);
  const read = { ydd: readYdd, ydr: readYdr, yft: readYft }[kind];
  if (!read) throw Error('Jenis resource tidak didukung.');
  return read(buffer);
}
export function reviveResource(kind, data) {
  if (kind === 'ytd') Object.setPrototypeOf(data, Resource.prototype);
  return data;
}
