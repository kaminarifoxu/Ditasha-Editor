import { Resource, readYft } from './resource.js';
import { deflateRaw } from 'pako';
// Connectivity uses positions as well as indices, so UV seams do not split one badge.
// Components never cross a native geometry/material boundary.
export function connectedParts(g) {
  const { positions: p, indices: ix } = g;
  const parent = new Int32Array(p.length / 3).fill(-1),
    welded = new Map();
  const find = (n) => {
    let r = n;
    while (parent[r] !== r) r = parent[r];
    while (parent[n] !== n) {
      const next = parent[n];
      parent[n] = r;
      n = next;
    }
    return r;
  };
  const join = (a, b) => {
    a = find(a);
    b = find(b);
    if (a !== b) parent[Math.max(a, b)] = Math.min(a, b);
  };
  const live = [];
  for (let t = 0; t < ix.length / 3; t++) {
    const a = ix[t * 3],
      b = ix[t * 3 + 1],
      c = ix[t * 3 + 2];
    if (a === b || a === c || b === c) continue;
    const ax = p[b * 3] - p[a * 3],
      ay = p[b * 3 + 1] - p[a * 3 + 1],
      az = p[b * 3 + 2] - p[a * 3 + 2],
      bx = p[c * 3] - p[a * 3],
      by = p[c * 3 + 1] - p[a * 3 + 1],
      bz = p[c * 3 + 2] - p[a * 3 + 2];
    if ((ay * bz - az * by) ** 2 + (az * bx - ax * bz) ** 2 + (ax * by - ay * bx) ** 2 < 1e-24)
      continue;
    live.push(t);
    for (const v of [a, b, c])
      if (parent[v] < 0) {
        parent[v] = v;
        const key = [p[v * 3], p[v * 3 + 1], p[v * 3 + 2]]
          .map((x) => Math.round(x * 1e5))
          .join(',');
        const old = welded.get(key);
        if (old !== undefined) join(v, old);
        else welded.set(key, v);
      }
    join(a, b);
    join(a, c);
  }
  const groups = new Map();
  for (const t of live) {
    const key = find(ix[t * 3]);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(t);
  }
  return [...groups.values()].map((triangles) => {
    const min = [Infinity, Infinity, Infinity],
      max = [-Infinity, -Infinity, -Infinity];
    for (const t of triangles)
      for (let k = 0; k < 3; k++) {
        const v = ix[t * 3 + k] * 3;
        for (let a = 0; a < 3; a++) {
          min[a] = Math.min(min[a], p[v + a]);
          max[a] = Math.max(max[a], p[v + a]);
        }
      }
    return {
      id: `${g.sourceGeometry}:${triangles[0]}`,
      sourceGeometry: g.sourceGeometry,
      indexOffset: g.indexOffset,
      triangles,
      min,
      max,
    };
  });
}
export function analyzeDebadge(buffer) {
  const drawables = readYft(buffer),
    cache = new Map();
  let totalParts = 0;
  for (const d of drawables)
    for (const lod of d.lods)
      for (const g of lod.geometries) {
        if (!cache.has(g.sourceGeometry)) {
          const parts = connectedParts(g);
          totalParts += parts.length;
          if (totalParts > 100000) throw Error('Too many disconnected parts (maximum 100,000).');
          cache.set(g.sourceGeometry, parts);
        }
        // Keep only component data; the vertex/index buffers remain shared inside this result.
        g.parts = cache.get(g.sourceGeometry);
      }
  return drawables;
}
export function removeVehicleParts(buffer, selected) {
  if (
    !Array.isArray(selected) ||
    !selected.length ||
    selected.length > 100000 ||
    selected.some((x) => typeof x !== 'string')
  )
    throw Error('Select at least one part to remove.');
  const data = analyzeDebadge(buffer),
    wanted = new Set(selected),
    known = new Map(),
    geometries = new Map();
  for (const d of data)
    for (const l of d.lods)
      for (const g of l.geometries) {
        geometries.set(g.sourceGeometry, g);
        for (const p of g.parts) known.set(p.id, p);
      }
  if ([...wanted].some((id) => !known.has(id)))
    throw Error('Selection does not belong to this original YFT.');
  if (data.some((d) => d.geometryWarnings?.length))
    throw Error(
      'Some YFT drawables could not be read. Export is blocked to avoid leaving unreviewed geometry.',
    );
  const writes = new Map();
  for (const id of wanted) {
    const part = known.get(id),
      g = geometries.get(part.sourceGeometry);
    for (const t of part.triangles) writes.set(g.indexOffset + t * 6, g.indices[t * 3]);
  }
  // Different geometries can alias native index bytes. Refuse partial/shifted overlaps.
  const ranges = [...geometries.values()]
    .map((g) => [g.indexOffset, g.indexOffset + g.indices.length * 2])
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let previous;
  for (const range of ranges) {
    if (
      previous &&
      range[0] < previous[1] &&
      (range[0] !== previous[0] || range[1] !== previous[1])
    )
      throw Error('Overlapping index buffer ranges cannot be edited safely.');
    previous = range;
  }
  for (const g of geometries.values())
    for (const part of g.parts)
      if (!wanted.has(part.id))
        for (const t of part.triangles) {
          if (writes.has(g.indexOffset + t * 6))
            throw Error(
              'This part shares an index buffer with another geometry. Select the corresponding part too, or leave it unchanged.',
            );
        }
  for (const d of data)
    for (const level of d.lods) {
      const parts = level.geometries.flatMap((g) => g.parts);
      if (parts.length && parts.every((p) => wanted.has(p.id)))
        throw Error(
          'Removing every visible part of ' + level.name + ' is blocked. Keep the vehicle body.',
        );
    }
  let remaining = 0;
  for (const g of geometries.values())
    for (const part of g.parts) if (!wanted.has(part.id)) remaining += part.triangles.length;
  if (!remaining) throw Error('Removing every visible part is blocked. Keep the vehicle body.');
  const r = new Resource(buffer, 162);
  for (const [at, first] of writes) {
    r.v.setUint16(at + 2, first, true);
    r.v.setUint16(at + 4, first, true);
  }
  const compressed = deflateRaw(r.bytes),
    out = new Uint8Array(16 + compressed.length);
  out.set(r.header);
  out.set(compressed, 16);
  readYft(out.buffer);
  return { bytes: out, removedTriangles: writes.size, removedParts: wanted.size };
}
