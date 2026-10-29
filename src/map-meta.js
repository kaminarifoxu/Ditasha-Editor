// Read-only Legacy META layout, based on CodeWalker Meta.cs/MetaTypes.cs (MIT).
import { Resource } from './resource.js';
const MAP = 3545841574,
  TYPES = 3649811809,
  ENTITY = 3461354627,
  MLO_INSTANCE = 164374718,
  BASE = 2195127427,
  TIME = 1991296364,
  MLO = 273704021;
export function readMapMeta(buffer) {
  const r = new Resource(buffer, 2, 64 * 1024 ** 2),
    at = r.ptr(48),
    count = r.u16(76),
    blocks = [];
  if (!count || count > 4095 || at === null || at + count * 16 > r.bytes.length)
    throw Error('Invalid META block table.');
  for (let i = 0; i < count; i++) {
    const p = at + i * 16,
      len = r.u32(p + 4),
      data = r.ptr(p + 8);
    if (data === null || data + len > r.bytes.length) throw Error('META block is truncated.');
    blocks.push({ type: r.u32(p), data, len });
  }
  function deref(value, size = 0) {
    const index = (value & 4095) - 1,
      offset = (value >>> 12) & 1048575,
      b = blocks[index];
    if (!b || offset + size > b.len) throw Error('META pointer outside block.');
    return { p: b.data + offset, type: b.type };
  }
  let totalItems = 0;
  function array(p) {
    const n = r.u16(p + 8);
    totalItems += n;
    if (n > 4096 || totalItems > 20000) throw Error('Too many META items.');
    if (!n) return [];
    const a = deref(r.u32(p), n * 8);
    return Array.from({ length: n }, (_, i) => deref(r.u32(a.p + i * 8)));
  }
  function floats(p, n) {
    const a = Array.from({ length: n }, (_, i) => r.f32(p + i * 4));
    if (!a.every(Number.isFinite)) throw Error('Non-finite META transform.');
    return a;
  }
  function entity(ref) {
    if (![ENTITY, MLO_INSTANCE].includes(ref.type))
      throw Error('Unsupported map entity type ' + ref.type);
    const { p } = derefPointer(ref, 128);
    const pos = floats(p + 32, 3),
      rot = floats(p + 48, 4),
      scale = [r.f32(p + 64), r.f32(p + 68)];
    if (
      pos.some((v) => Math.abs(v) > 1e7) ||
      Math.hypot(...rot) < 1e-8 ||
      scale.some((v) => !Number.isFinite(v) || v <= 0 || v > 1000)
    )
      throw Error('Invalid map transform.');
    return {
      hash: r.u32(p + 8),
      position: pos,
      rotation: rot,
      scale: [scale[0], scale[0], scale[1]],
      isMlo: ref.type === MLO_INSTANCE,
      lod: r.u32(p + 84),
    };
  }
  function derefPointer(ref, size) {
    const b = blocks.find((b) => ref.p >= b.data && ref.p < b.data + b.len);
    if (!b || ref.p + size > b.data + b.len) throw Error('META structure is truncated.');
    return ref;
  }
  const root = blocks[r.u32(28) - 1];
  if (!root) throw Error('Missing META root block.');
  if (root.type === MAP) {
    if (root.len < 112) throw Error('Map root is truncated.');
    return { kind: 'ymap', entities: array(root.data + 96).map(entity), archetypes: [] };
  }
  if (root.type === TYPES) {
    if (root.len < 40) throw Error('Type root is truncated.');
    return {
      kind: 'ytyp',
      entities: [],
      archetypes: array(root.data + 24).map((ref) => {
        if (![BASE, TIME, MLO].includes(ref.type)) throw Error('Unsupported archetype ' + ref.type);
        const { p } = derefPointer(ref, ref.type === MLO ? 240 : 144);
        return {
          hash: r.u32(p + 88),
          asset: r.u32(p + 112),
          texture: r.u32(p + 92),
          drawableDictionary: r.u32(p + 100),
          isMlo: ref.type === MLO,
          entities: ref.type === MLO ? array(p + 152).map(entity) : [],
          hasEntitySets: ref.type === MLO && r.u16(p + 208) > 0,
        };
      }),
    };
  }
  throw Error('Unsupported META resource.');
}
