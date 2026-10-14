import { Resource, readYft, readYdr, readYdd } from './resource.js';
import { deflateRaw } from 'pako';
// Preserve pointers, vertices, shaders, bones and physics. Collapse selected visual
// triangles to degenerate indices. Never split shared native index buffers.
export function maskResourceGeometry(buffer, selected, extension) {
  const read = { yft: readYft, ydr: readYdr, ydd: readYdd }[extension];
  if (!read || !(buffer instanceof ArrayBuffer) || buffer.byteLength < 16)
    throw Error('Resource tidak valid.');
  const wanted = new Set(selected);
  if (!wanted.size) throw Error('Sembunyikan minimal satu mesh model utama dahulu.');
  const data = read(buffer),
    geometries = data.flatMap((d) => d.lods.flatMap((l) => l.geometries));
  const known = new Set(geometries.map((g) => g.sourceGeometry));
  if ([...wanted].some((n) => !known.has(n)))
    throw Error('Pilihan mesh tidak cocok dengan resource asli.');
  const ranges = new Map();
  for (const g of geometries) {
    if (!ranges.has(g.indexOffset)) ranges.set(g.indexOffset, []);
    ranges.get(g.indexOffset).push(g);
  }
  const r = new Resource(buffer, extension === 'yft' ? 162 : 165);
  let changed = 0;
  for (const [offset, list] of ranges) {
    if (!list.some((g) => wanted.has(g.sourceGeometry))) continue;
    if (list.some((g) => !wanted.has(g.sourceGeometry)))
      throw Error(
        'Mesh berbagi index buffer. Sembunyikan semua mesh yang memakai buffer yang sama sebelum ekspor.',
      );
    const count = list[0].indices.length;
    if (list.some((g) => g.indices.length !== count))
      throw Error('Buffer bersama tidak konsisten.');
    r.bytes.fill(0, offset, offset + count * 2);
    changed++;
  }
  if (!changed) throw Error('Tidak ada perubahan visual.');
  const compressed = deflateRaw(r.bytes),
    output = new Uint8Array(16 + compressed.length);
  output.set(r.header);
  output.set(compressed, 16);
  // Re-open output before offering it to the user; native layout must still parse.
  read(output.buffer);
  return output;
}
