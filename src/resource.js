import { decodeBC7 } from 'tex-decoder/build/esm/bc7.js';
import { Matrix4, Quaternion, Vector3 } from 'three';
import { deflateRaw, Inflate } from 'pako';
export const pageSize = (f) =>
  512 *
  2 ** (f & 15) *
  (((f >>> 27) & 1) +
    ((f >>> 26) & 1) * 2 +
    ((f >>> 25) & 1) * 4 +
    ((f >>> 24) & 1) * 8 +
    ((f >>> 17) & 127) * 16 +
    ((f >>> 11) & 63) * 32 +
    ((f >>> 7) & 15) * 64 +
    ((f >>> 5) & 3) * 128 +
    ((f >>> 4) & 1) * 256);
export class Resource {
  constructor(buffer, version) {
    this.header = new Uint8Array(buffer.slice(0, 16));
    const h = new DataView(buffer);
    if (h.getUint32(0, true) !== 0x37435352)
      throw Error('File bukan resource RSC7. File terenkripsi belum didukung.');
    if (h.getUint32(4, true) !== version)
      throw Error('Versi resource ini belum didukung. Gunakan GTA V Legacy.');
    this.sys = pageSize(h.getUint32(8, true));
    const expected = this.sys + pageSize(h.getUint32(12, true));
    if (expected > 128 * 1024 * 1024 || expected < 64)
      throw Error('Ukuran resource tidak didukung (maksimum 128 MB).');
    let parts = [],
      total = 0;
    let inf = new Inflate({ raw: true });
    inf.onData = (c) => {
      total += c.length;
      if (total > expected) throw Error('Resource melebihi ukuran header.');
      parts.push(c);
    };
    inf.push(new Uint8Array(buffer, 16), true);
    if (inf.err) throw Error('Resource gagal didekompresi.');
    if (total !== expected) throw Error('Ukuran resource tidak cocok dengan header.');
    this.bytes = new Uint8Array(total);
    let pos = 0;
    for (const c of parts) {
      this.bytes.set(c, pos);
      pos += c.length;
    }
    this.v = new DataView(this.bytes.buffer);
  }
  u16(p) {
    return this.v.getUint16(p, true);
  }
  u32(p) {
    return this.v.getUint32(p, true);
  }
  f32(p) {
    return this.v.getFloat32(p, true);
  }
  ptr(p) {
    const n = Number(this.v.getBigUint64(p, true));
    if (!n) return null;
    let o =
      n >= 0x60000000 && n < 0x70000000
        ? this.sys + n - 0x60000000
        : n >= 0x50000000 && n < 0x60000000
          ? n - 0x50000000
          : -1;
    if (o < 0 || o >= this.bytes.length) throw Error('Pointer resource tidak valid.');
    return o;
  }
  str(p) {
    if (p === null) return '';
    let end = p;
    while (end < this.bytes.length && end - p < 1024 && this.bytes[end]) end++;
    return new TextDecoder().decode(this.bytes.subarray(p, end));
  }
  list(p, count) {
    if (count > 4096) throw Error('Terlalu banyak item resource.');
    const arr = this.ptr(p);
    if (arr === null && count) throw Error('Daftar resource kosong.');
    return Array.from({ length: count }, (_, i) => this.ptr(arr + i * 8)).filter((x) => x !== null);
  }
}
const DXT1 = 0x31545844,
  DXT3 = 0x33545844,
  DXT5 = 0x35545844;
export function decodeTexture(r, p) {
  const w = r.u16(p + 80),
    h = r.u16(p + 82),
    format = r.u32(p + 88),
    data = r.ptr(p + 112);
  if (!w || !h || w > 8192 || h > 8192 || w * h > 16777216 || data === null)
    throw Error('Dimensi tekstur tidak didukung.');
  const out = new Uint8ClampedArray(w * h * 4),
    v = r.v;
  const name = r.str(r.ptr(p + 40)) || 'texture';
  if ([28, 50, 51].includes(format)) {
    const channels = format === 51 ? 2 : 1;
    const stride = r.u16(p + 86) || w * channels;
    if (stride < w * channels || data + (h - 1) * stride + w * channels > r.bytes.length)
      throw Error('Texture pixel buffer is truncated.');
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const s = data + y * stride + x * channels,
          d = (y * w + x) * 4;
        out[d] = out[d + 1] = out[d + 2] = format === 28 ? 255 : r.bytes[s];
        out[d + 3] = format === 28 ? r.bytes[s] : format === 51 ? r.bytes[s + 1] : 255;
      }
    return {
      name,
      w,
      h,
      p,
      out,
      format: { 28: 'A8', 50: 'L8', 51: 'A8L8' }[format],
      mipLevels: r.bytes[p + 93] || 1,
    };
  }
  if ([21, 22, 32, 33].includes(format)) {
    const stride = r.u16(p + 86) || w * 4;
    if (stride < w * 4 || data + (h - 1) * stride + w * 4 > r.bytes.length)
      throw Error('Texture pixel buffer is truncated.');
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        let s = data + y * stride + x * 4,
          d = (y * w + x) * 4;
        out[d] = r.bytes[s + (format <= 22 ? 2 : 0)];
        out[d + 1] = r.bytes[s + 1];
        out[d + 2] = r.bytes[s + (format <= 22 ? 0 : 2)];
        out[d + 3] = [22, 33].includes(format) ? 255 : r.bytes[s + 3];
      }
    return { name, w, h, p, out, format: 'RGBA', mipLevels: r.bytes[p + 93] || 1 };
  }
  if (format === 0x20374342) {
    const length = Math.ceil(w / 4) * Math.ceil(h / 4) * 16;
    if (data + length > r.bytes.length) throw Error('Compressed BC7 texture buffer is truncated.');
    out.set(decodeBC7(r.bytes.subarray(data, data + length), w, h));
    return { name, w, h, p, out, format: 'BC7', mipLevels: r.bytes[p + 93] || 1 };
  }
  if (![DXT1, DXT3, DXT5].includes(format))
    throw Error('Format tekstur ' + format.toString(16) + ' belum didukung.');
  const length = Math.ceil(w / 4) * Math.ceil(h / 4) * (format === DXT1 ? 8 : 16);
  if (data + length > r.bytes.length) throw Error('Compressed texture buffer is truncated.');
  let off = data;
  const rgb = (n) => [
    Math.round((((n >> 11) & 31) * 255) / 31),
    Math.round((((n >> 5) & 63) * 255) / 63),
    Math.round(((n & 31) * 255) / 31),
  ];
  for (let by = 0; by < h; by += 4)
    for (let bx = 0; bx < w; bx += 4) {
      const start = off;
      let alpha = Array(16).fill(255);
      if (format === DXT3) {
        let bits = v.getBigUint64(off, true);
        for (let i = 0; i < 16; i++) alpha[i] = Number((bits >> BigInt(i * 4)) & 15n) * 17;
        off += 8;
      }
      if (format === DXT5) {
        let a0 = r.bytes[off],
          a1 = r.bytes[off + 1],
          a = [a0, a1];
        if (a0 > a1) {
          for (let i = 1; i <= 6; i++) a.push(Math.round(((7 - i) * a0 + i * a1) / 7));
        } else {
          for (let i = 1; i <= 4; i++) a.push(Math.round(((5 - i) * a0 + i * a1) / 5));
          a.push(0, 255);
        }
        let bits = 0n;
        for (let i = 0; i < 6; i++) bits |= BigInt(r.bytes[off + 2 + i]) << BigInt(i * 8);
        for (let i = 0; i < 16; i++) alpha[i] = a[Number((bits >> BigInt(i * 3)) & 7n)];
        off += 8;
      }
      const c0 = v.getUint16(off, true),
        c1 = v.getUint16(off + 2, true),
        a = rgb(c0),
        b = rgb(c1);
      let cs = [a, b];
      if (c0 > c1 || format !== DXT1) {
        cs.push(
          a.map((x, i) => Math.round((2 * x + b[i]) / 3)),
          a.map((x, i) => Math.round((x + 2 * b[i]) / 3)),
        );
      } else
        cs.push(
          a.map((x, i) => Math.round((x + b[i]) / 2)),
          [0, 0, 0],
        );
      const bits = v.getUint32(off + 4, true);
      for (let i = 0; i < 16; i++) {
        let x = bx + (i % 4),
          y = by + (i >> 2);
        if (x >= w || y >= h) continue;
        let c = (bits >>> (i * 2)) & 3,
          d = (y * w + x) * 4;
        out.set(cs[c], d);
        out[d + 3] = format === DXT1 && c0 <= c1 && c === 3 ? 0 : alpha[i];
      }
      off = start + (format === DXT1 ? 8 : 16);
    }
  return {
    name,
    w,
    h,
    p,
    out,
    format: format === DXT1 ? 'DXT1' : format === DXT3 ? 'DXT3' : 'DXT5',
    mipLevels: r.bytes[p + 93] || 1,
  };
}
export function readYtd(buffer) {
  const r = new Resource(buffer, 13);
  let pixels = 0;
  r.textures = r.list(48, r.u16(56)).map((p) => {
    pixels += r.u16(p + 80) * r.u16(p + 82);
    if (pixels > 33554432) throw Error('Decoded textures exceed 128 MB.');
    return decodeTexture(r, p);
  });
  if (!r.textures.length) throw Error('Tidak ada tekstur dalam YTD.');
  return r;
}
export function writeYtd(r, textures) {
  let total = textures.reduce((n, t) => n + Math.ceil((t.w * t.h * 4) / 16) * 16, 0);
  if (total + r.sys > 128 * 1024 * 1024)
    throw Error('Ekspor melebihi 128 MB. Kurangi ukuran kanvas.');
  const large = total > 16777216,
    unit = large ? 8192 : 512,
    exp = Math.max(0, Math.ceil(Math.log2(total / unit)));
  if (exp > 15) throw Error('Ekspor melebihi ukuran yang didukung.');
  const gfxSize = unit * 2 ** exp;
  const bytes = new Uint8Array(r.sys + gfxSize);
  bytes.set(r.bytes.subarray(0, r.sys));
  const v = new DataView(bytes.buffer);
  const pages = r.ptr(8);
  if (pages !== null && pages < r.sys - 16) v.setUint8(pages + 9, 1);
  let offset = 0;
  for (const t of textures) {
    v.setUint16(t.p + 80, t.w, true);
    v.setUint16(t.p + 82, t.h, true);
    v.setUint16(t.p + 84, 1, true);
    v.setUint16(t.p + 86, t.w * 4, true);
    v.setUint32(t.p + 88, 21, true);
    v.setUint8(t.p + 93, 1);
    v.setBigUint64(t.p + 112, BigInt(0x60000000 + offset), true);
    for (let i = 0; i < t.out.length; i += 4) {
      bytes[r.sys + offset + i] = t.out[i + 2];
      bytes[r.sys + offset + i + 1] = t.out[i + 1];
      bytes[r.sys + offset + i + 2] = t.out[i];
      bytes[r.sys + offset + i + 3] = t.out[i + 3];
    }
    offset += Math.ceil((t.w * t.h * 4) / 16) * 16;
  }
  let header = r.header.slice(),
    hv = new DataView(header.buffer);
  hv.setUint32(
    12,
    (hv.getUint32(12, true) & 0xf0000000) | (large ? 0x00020000 : 0x08000000) | exp,
    true,
  );
  const compressed = deflateRaw(bytes),
    out = new Uint8Array(16 + compressed.length);
  out.set(header);
  out.set(compressed, 16);
  return out;
}
function half(n) {
  let e = (n >> 10) & 31,
    m = n & 1023;
  return (
    (n & 32768 ? -1 : 1) *
    (e === 0
      ? 2 ** -14 * (m / 1024)
      : e === 31
        ? m
          ? NaN
          : Infinity
        : 2 ** (e - 15) * (1 + m / 1024))
  );
}
// YDD UVs use a top-origin V coordinate, matching the 2D canvas and CanvasTexture.flipY=false.
// Native Legacy drawable layout; references: CodeWalker Drawable.cs / ShaderParametersBlock.
function nameHash(name) {
  let h = 0;
  for (const c of new TextEncoder().encode(name.toLowerCase())) {
    h = (h + c) >>> 0;
    h = (h + (h << 10)) >>> 0;
    h ^= h >>> 6;
  }
  h = (h + (h << 3)) >>> 0;
  h ^= h >>> 11;
  return (h + (h << 15)) >>> 0;
}
function shaderInfo(r, d) {
  const group = r.ptr(d + 16),
    bindings = [],
    embeddedTextures = [],
    warnings = [];
  if (group === null) return { bindings, embeddedTextures, warnings };
  const dictionary = r.ptr(group + 8);
  if (dictionary !== null) {
    let pixels = 0;
    for (const p of r.list(dictionary + 48, r.u16(dictionary + 56))) {
      pixels += r.u16(p + 80) * r.u16(p + 82);
      if (pixels > 33554432) throw Error('Embedded textures exceed 128 MB.');
      try {
        embeddedTextures.push(decodeTexture(r, p));
      } catch (e) {
        warnings.push(e.message);
      }
    }
  }
  const shaderCount = r.u16(group + 24),
    shaderArray = r.ptr(group + 16);
  if (shaderCount > 4096 || (shaderCount && shaderArray === null))
    throw Error('Invalid shader list.');
  for (let si = 0; si < shaderCount; si++) {
    const shader = r.ptr(shaderArray + si * 8);
    if (shader === null) {
      bindings.push({});
      continue;
    }
    const params = r.ptr(shader),
      count = r.bytes[shader + 16];
    if (params === null || !count) {
      bindings.push({});
      continue;
    }
    let hashes = params + count * 16;
    for (let i = 0; i < count; i++) hashes += r.bytes[params + i * 16] * 16;
    const refs = [];
    for (let i = 0; i < count; i++) {
      const p = params + i * 16;
      if (r.bytes[p] !== 0) continue;
      const texture = r.ptr(p + 8);
      if (texture !== null)
        refs.push({ hash: r.u32(hashes + i * 4), name: r.str(r.ptr(texture + 40)) });
    }
    const diffuse =
      refs.find((t) => t.hash === nameHash('DiffuseSampler')) ||
      refs.find((t) => t.hash === nameHash('TextureSampler')) ||
      refs.find((t) => t.hash === nameHash('DiffuseSampler2'));
    bindings.push({
      diffuseTexture: diffuse?.name || null,
      textureNames: refs.map((t) => t.name).filter(Boolean),
      textureSamplers: refs,
      shaderHash: r.u32(shader + 8),
    });
  }
  return { bindings, embeddedTextures, warnings };
}
// DrawableModel rigid parts are stored in bone-local coordinates, not world space.
function drawableBones(r, drawable) {
  const skeleton = r.ptr(drawable + 24);
  if (skeleton === null) return [];
  const bones = r.ptr(skeleton + 32),
    parents = r.ptr(skeleton + 56),
    count = r.u16(skeleton + 94);
  if (!count) return [];
  if (count > 1024 || bones === null || bones + count * 80 > r.bytes.length)
    throw Error('Invalid skeleton bones.');
  const result = [],
    visiting = new Set();
  function bone(index) {
    if (result[index]) return result[index];
    if (visiting.has(index)) throw Error('Cyclic skeleton hierarchy.');
    visiting.add(index);
    const at = bones + index * 80;
    const values = [0, 4, 8, 12, 16, 20, 24, 32, 36, 40].map((offset) => r.f32(at + offset));
    if (!values.every(Number.isFinite)) throw Error('Invalid bone transform.');
    const q = new Quaternion(...values.slice(0, 4));
    if (q.lengthSq() < 1e-12) throw Error('Invalid bone rotation.');
    const matrix = new Matrix4().compose(
      new Vector3(...values.slice(4, 7)),
      q.normalize(),
      new Vector3(...values.slice(7)),
    );
    const parent = r.v.getInt16(parents === null ? at + 50 : parents + index * 2, true);
    if (parent >= count) throw Error('Invalid bone parent.');
    if (parent >= 0) matrix.premultiply(bone(parent));
    visiting.delete(index);
    return (result[index] = matrix);
  }
  for (let i = 0; i < count; i++) bone(i);
  return result;
}
function rigidGeometry(data, matrix) {
  if (!matrix) return data;
  const positions = data.positions.slice(),
    point = new Vector3();
  for (let i = 0; i < positions.length; i += 3) {
    // Undo GTA -> Three basis, transform in GTA coordinates, then restore basis.
    point.set(positions[i], -positions[i + 2], positions[i + 1]).applyMatrix4(matrix);
    positions.set([point.x, point.z, -point.y], i);
  }
  return { ...data, positions };
}

function readDrawables(r, drawables, metadata = new Map()) {
  const cache = new Map(),
    shaderCache = new Map();
  let vertices = 0,
    indexTotal = 0;
  function geometry(g) {
    if (cache.has(g)) return cache.get(g);
    const vb = r.ptr(g + 24),
      ib = r.ptr(g + 56);
    if (vb === null || ib === null) return null;
    const stride = r.u16(vb + 8),
      count = r.u32(vb + 24),
      data = r.ptr(vb + 16) ?? r.ptr(vb + 32),
      decl = r.ptr(vb + 48);
    if (
      !stride ||
      !count ||
      count > 1000000 ||
      data === null ||
      decl === null ||
      data + count * stride > r.bytes.length
    )
      throw Error('Vertex buffer tidak didukung.');
    vertices += count;
    if (vertices > 2000000) throw Error('Model LOD buffers exceed 2 million vertices.');
    const flags = r.u32(decl),
      types = r.v.getBigUint64(decl + 8, true);
    let offsets = [],
      offset = 0;
    const sizes = [0, 4, 4, 8, 0, 8, 12, 16, 4, 4, 4, 0, 0, 0, 0, 0];
    for (let c = 0; c < 16; c++) {
      if (flags & (1 << c)) {
        const type = Number((types >> BigInt(4 * c)) & 15n);
        if (!sizes[type]) throw Error('Format vertex belum didukung.');
        offsets[c] = { offset, type };
        offset += sizes[type];
      }
    }
    if (offset > stride || !offsets[0] || ![6, 7, 3].includes(offsets[0].type))
      throw Error('Format posisi vertex belum didukung.');
    const get = (i, c, k) => {
      const a = offsets[c];
      if (!a) return 0;
      const p = data + i * stride + a.offset;
      const value = [1, 3].includes(a.type) ? half(r.u16(p + k * 2)) : r.f32(p + k * 4);
      if (!Number.isFinite(value)) throw Error('Invalid non-finite vertex value.');
      return value;
    };
    const positions = new Float32Array(count * 3),
      uvs = offsets[6] ? new Float32Array(count * 2) : null,
      uvs2 = offsets[7] ? new Float32Array(count * 2) : null;
    for (let i = 0; i < count; i++) {
      positions.set([get(i, 0, 0), get(i, 0, 2), -get(i, 0, 1)], i * 3);
      if (uvs) uvs.set([get(i, 6, 0), get(i, 6, 1)], i * 2);
      if (uvs2) uvs2.set([get(i, 7, 0), get(i, 7, 1)], i * 2);
    }
    const ic = r.u32(ib + 8),
      ip = r.ptr(ib + 16);
    indexTotal += ic;
    if (
      ic < 3 ||
      ic > 3000000 ||
      ic % 3 ||
      indexTotal > 6000000 ||
      ip === null ||
      ip + ic * 2 > r.bytes.length
    )
      throw Error('Index buffer tidak didukung.');
    const indices = new Uint16Array(ic);
    for (let i = 0; i < ic; i++) {
      indices[i] = r.u16(ip + i * 2);
      if (indices[i] >= count) throw Error('Index model tidak valid.');
    }
    const result = { positions, uvs, uvs2, indices };
    cache.set(g, result);
    return result;
  }
  return drawables
    .map((d, di) => {
      const details = metadata.get(d) || {};
      try {
        const bones = drawableBones(r, d);
        const lods = [],
          shaderDrawable = r.ptr(d + 16) === null ? (details.shaderParent ?? d) : d,
          key = r.ptr(shaderDrawable + 16);
        if (!shaderCache.has(key)) shaderCache.set(key, shaderInfo(r, shaderDrawable));
        const info = shaderCache.get(key);
        for (const [i, offset] of [80, 88, 96, 104].entries()) {
          const pointer = r.ptr(d + offset);
          if (pointer === null) continue;
          const geometries = [];
          for (const [mi, m] of r.list(pointer, r.u16(pointer + 8)).entries()) {
            const mapping = r.ptr(m + 32);
            const skeletonBinding = r.u32(m + 40);
            const boneIndex = skeletonBinding >>> 24;
            const rigid = ((skeletonBinding >>> 8) & 255) === 0;
            const geometryCount = r.u16(m + 16),
              geometryArray = r.ptr(m + 8);
            if (geometryCount > 4096 || (geometryCount && geometryArray === null))
              throw Error('Invalid geometry list.');
            for (let gi = 0; gi < geometryCount; gi++) {
              const g = r.ptr(geometryArray + gi * 8);
              if (g === null) continue;
              const data = geometry(g);
              if (!data) continue;
              const shaderIndex = mapping === null ? 0 : r.u16(mapping + gi * 2),
                binding = info.bindings[shaderIndex];
              geometries.push({
                ...rigidGeometry(data, rigid ? bones[boneIndex] : null),
                boneIndex,
                name: 'Part ' + (mi + 1) + ' / Mesh ' + (gi + 1),
                part: mi,
                shaderIndex,
                diffuseTexture: binding?.diffuseTexture || null,
                textureNames: binding?.textureNames || [],
                textureSamplers: binding?.textureSamplers || [],
              });
            }
          }
          if (geometries.length)
            lods.push({ name: ['High', 'Medium', 'Low', 'Very low'][i], geometries });
        }
        if (!lods.length) return null;
        return {
          name: details.name || 'Drawable ' + (di + 1),
          geometries: lods[0].geometries,
          lods,
          ...info,
          fragmentChild: details.fragmentChild || false,
        };
      } catch (e) {
        if (!details.fragmentChild) throw e;
        (r.fragmentWarnings ||= []).push(details.name + ': ' + e.message);
        return null;
      }
    })
    .filter(Boolean);
}

// Legacy resource layouts: CodeWalker DrawableBase / FragType.
export function readYdd(buffer) {
  const r = new Resource(buffer, 165);
  return requireGeometry(readDrawables(r, r.list(48, r.u16(56))));
}
export function readYdr(buffer) {
  const r = new Resource(buffer, 165);
  return requireGeometry(readDrawables(r, [0]));
}
export function readYft(buffer) {
  const r = new Resource(buffer, 162),
    offsets = [],
    metadata = new Map();
  const main = r.ptr(48);
  if (main !== null) offsets.push(main);
  const count = r.u32(72);
  if (count) offsets.push(...r.list(56, count));
  const cloth = r.ptr(248);
  if (cloth !== null) offsets.push(cloth);
  // FragType.PhysicsLODGroup (0xF0), LOD1 (0x10), Children (0xD0/0x11D).
  // Pristine and damaged child drawables are separate inspection choices, not stacked.
  const physics = r.ptr(240),
    physicsLod = physics === null ? null : r.ptr(physics + 16);
  if (physicsLod !== null) {
    const children = r.list(physicsLod + 208, r.bytes[physicsLod + 285]);
    children.forEach((child, index) => {
      for (const [offset, label] of [
        [160, 'Pristine'],
        [168, 'Damaged'],
      ]) {
        const d = r.ptr(child + offset);
        if (d === null || offsets.includes(d)) continue;
        offsets.push(d);
        metadata.set(d, {
          name: `Fragment ${index + 1} · bone ${r.u16(child + 18)} · ${label}`,
          shaderParent: main,
          fragmentChild: true,
        });
      }
    });
  }
  if (!offsets.length) throw Error('YFT tidak memiliki drawable yang dapat ditampilkan.');
  const result = requireGeometry(readDrawables(r, [...new Set(offsets)], metadata));
  if (r.fragmentWarnings?.length)
    result[0].warnings = [...result[0].warnings, ...r.fragmentWarnings];
  return result;
}

function requireGeometry(drawables) {
  if (!drawables.length) throw Error('Model tidak memiliki geometri yang dapat ditampilkan.');
  return drawables;
}
