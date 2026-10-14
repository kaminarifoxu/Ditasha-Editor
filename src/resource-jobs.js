import { Resource, readYtd, readYdd, readYdr, readYft } from './resource.js';
import { maskResourceGeometry } from './vehicle-resource.js';
export function performResourceJob(kind, buffer, options = {}) {
  if (!(buffer instanceof ArrayBuffer) || buffer.byteLength > 64 * 1024 * 1024)
    throw Error('Resource input maksimum 64 MB.');
  if (kind === 'ytd') return readYtd(buffer);
  if (kind === 'textures') return readYtd(buffer).textures;
  if (kind === 'mask') return maskResourceGeometry(buffer, options.selected, options.extension);
  const read = { ydd: readYdd, ydr: readYdr, yft: readYft }[kind];
  if (!read) throw Error('Jenis resource tidak didukung.');
  return read(buffer);
}
export function reviveResource(kind, data) {
  if (kind === 'ytd') Object.setPrototypeOf(data, Resource.prototype);
  return data;
}
