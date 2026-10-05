import { deflateRaw } from 'pako';
import { decodeTexture } from './resource.js';
const encoder = new TextEncoder();
const align = (n) => Math.ceil(n / 16) * 16;
export const MAX_EXPORT = 128 * 1024 * 1024;
export function safePath(name) {
  if (
    typeof name !== 'string' ||
    !name ||
    name.length > 240 ||
    /[\x00-\x1f<>:"\\|?*]/.test(name) ||
    name.startsWith('/') ||
    name
      .split('/')
      .some(
        (p) =>
          !p ||
          p === '.' ||
          p === '..' ||
          /[. ]$/.test(p) ||
          /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(p),
      )
  )
    throw Error('Nama/path file tidak aman: ' + name);
  return name;
}
export function hashName(name) {
  let h = 0;
  for (const c of encoder.encode(name.toLowerCase())) {
    h = (h + c) >>> 0;
    h = (h + (h << 10)) >>> 0;
    h ^= h >>> 6;
  }
  h = (h + (h << 3)) >>> 0;
  h ^= h >>> 11;
  return (h + (h << 15)) >>> 0;
}
function validateTexture(t) {
  if (
    !Number.isInteger(t.w) ||
    !Number.isInteger(t.h) ||
    t.w < 1 ||
    t.h < 1 ||
    t.w > 8192 ||
    t.h > 8192 ||
    t.w * t.h > 16777216 ||
    t.out?.length !== t.w * t.h * 4
  )
    throw Error('Dimensi/data tekstur tidak valid.');
}
// Legacy TextureDictionary/Texture layout, one system and one graphics page.
export function createYtd(input) {
  if (!input.length || input.length > 4096) throw Error('Pilih 1–4096 tekstur.');
  const names = new Set(),
    hashes = new Set();
  const textures = input
    .map((t) => {
      validateTexture(t);
      const name = t.name.replace(/\.[^.]+$/, '').toLowerCase();
      if (!/^[a-z0-9_+-]{1,120}$/.test(name))
        throw Error('Nama tekstur harus a–z, angka, _, + atau -: ' + name);
      const hash = hashName(name);
      if (names.has(name) || hashes.has(hash)) throw Error('Nama/hash tekstur duplikat: ' + name);
      names.add(name);
      hashes.add(hash);
      return { ...t, name, hash };
    })
    .sort((a, b) => a.hash - b.hash);
  const n = textures.length,
    hashesAt = 96,
    listAt = align(hashesAt + n * 4),
    structAt = align(listAt + n * 8);
  let cursor = structAt + n * 144;
  for (const t of textures) {
    t.p = structAt + textures.indexOf(t) * 144;
    t.nameAt = cursor;
    cursor = align(cursor + encoder.encode(t.name).length + 1);
  }
  const sysExp = Math.max(0, Math.ceil(Math.log2(cursor / 512))),
    sys = 512 * 2 ** sysExp;
  const total = textures.reduce((s, t) => s + align(t.out.length), 0),
    large = total > 16777216,
    unit = large ? 8192 : 512,
    gfxExp = Math.max(0, Math.ceil(Math.log2(total / unit))),
    gfx = unit * 2 ** gfxExp;
  if (sys + gfx > MAX_EXPORT) throw Error('Hasil YTD melebihi 128 MB.');
  const b = new Uint8Array(sys + gfx),
    v = new DataView(b.buffer),
    ptr = (at, to) => v.setBigUint64(at, BigInt(to), true),
    sysPtr = (at, to) => ptr(at, 0x50000000 + to);
  v.setUint32(4, 1, true);
  sysPtr(8, 64);
  b[72] = b[73] = 1;
  v.setUint32(24, 1, true);
  sysPtr(32, hashesAt);
  v.setUint16(40, n, true);
  v.setUint16(42, n, true);
  sysPtr(48, listAt);
  v.setUint16(56, n, true);
  v.setUint16(58, n, true);
  let pos = 0;
  textures.forEach((t, i) => {
    v.setUint32(hashesAt + i * 4, t.hash, true);
    sysPtr(listAt + i * 8, t.p);
    v.setUint32(t.p + 4, 1, true);
    sysPtr(t.p + 40, t.nameAt);
    v.setUint16(t.p + 48, 1, true);
    v.setUint16(t.p + 50, 2, true);
    b.set(encoder.encode(t.name), t.nameAt);
    v.setUint16(t.p + 80, t.w, true);
    v.setUint16(t.p + 82, t.h, true);
    v.setUint16(t.p + 84, 1, true);
    v.setUint16(t.p + 86, t.w * 4, true);
    v.setUint32(t.p + 88, 21, true);
    b[t.p + 93] = 1;
    ptr(t.p + 112, 0x60000000 + pos);
    for (let j = 0; j < t.out.length; j += 4)
      b.set([t.out[j + 2], t.out[j + 1], t.out[j], t.out[j + 3]], sys + pos + j);
    pos += align(t.out.length);
  });
  const z = deflateRaw(b),
    out = new Uint8Array(z.length + 16),
    h = new DataView(out.buffer);
  h.setUint32(0, 0x37435352, true);
  h.setUint32(4, 13, true);
  h.setUint32(8, 0x08000000 | sysExp, true);
  h.setUint32(12, (0xd0000000 | (large ? 0x00020000 : 0x08000000) | gfxExp) >>> 0, true);
  out.set(z, 16);
  return out;
}
export function writeDds(t) {
  validateTexture(t);
  const out = new Uint8Array(128 + t.out.length),
    v = new DataView(out.buffer);
  for (const [p, n] of [
    [0, 0x20534444],
    [4, 124],
    [8, 0x100f],
    [12, t.h],
    [16, t.w],
    [20, t.w * 4],
    [76, 32],
    [80, 0x41],
    [88, 32],
    [92, 0xff],
    [96, 0xff00],
    [100, 0xff0000],
    [104, 0xff000000],
    [108, 0x1000],
  ])
    v.setUint32(p, n, true);
  out.set(t.out, 128);
  return out;
}
export function readDds(buffer, name = 'texture') {
  const v = new DataView(buffer);
  if (
    buffer.byteLength < 128 ||
    v.getUint32(0, true) !== 0x20534444 ||
    v.getUint32(4, true) !== 124 ||
    v.getUint32(76, true) !== 32
  )
    throw Error('Header DDS tidak valid.');
  const w = v.getUint32(16, true),
    h = v.getUint32(12, true),
    flags = v.getUint32(80, true),
    four = v.getUint32(84, true),
    caps = v.getUint32(112, true);
  if (caps || v.getUint32(24, true) > 1) throw Error('DDS cube/volume belum didukung.');
  if (!w || !h || w > 8192 || h > 8192 || w * h > 16777216)
    throw Error('Dimensi DDS tidak didukung.');
  if (flags & 4) {
    if (![0x31545844, 0x33545844, 0x35545844].includes(four))
      throw Error('DDS mendukung DXT1, DXT3, DXT5 atau RGBA/BGRA 32-bit.');
    const length = Math.ceil(w / 4) * Math.ceil(h / 4) * (four === 0x31545844 ? 8 : 16);
    if (buffer.byteLength < 128 + length) throw Error('Data DDS terpotong.');
    const bytes = new Uint8Array(buffer, 128, length);
    const r = {
      bytes,
      v: new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength),
      u16: (p) => (p === 80 ? w : p === 82 ? h : 0),
      u32: () => four,
      ptr: () => 0,
      str: () => name,
    };
    return decodeTexture(r, 0);
  }
  const masks = [92, 96, 100, 104].map((p) => v.getUint32(p, true));
  if (
    !(flags & 0x40) ||
    v.getUint32(88, true) !== 32 ||
    masks[1] !== 0xff00 ||
    ![0xff, 0xff0000].includes(masks[0]) ||
    masks[2] !== (masks[0] === 0xff ? 0xff0000 : 0xff) ||
    ![0, 0xff000000].includes(masks[3])
  )
    throw Error('DDS pixel format belum didukung.');
  const pitch = v.getUint32(8, true) & 8 ? v.getUint32(20, true) : w * 4;
  if (pitch < w * 4 || buffer.byteLength < 128 + pitch * h) throw Error('Data DDS terpotong.');
  const data = new Uint8Array(buffer),
    out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const s = 128 + y * pitch + x * 4,
        d = (y * w + x) * 4;
      out.set(
        [
          data[s + (masks[0] === 0xff ? 0 : 2)],
          data[s + 1],
          data[s + (masks[0] === 0xff ? 2 : 0)],
          masks[3] ? data[s + 3] : 255,
        ],
        d,
      );
    }
  return { name, w, h, out, format: 'RGBA' };
}
export function crc32(data) {
  let c = 0xffffffff;
  for (const b of data) {
    c ^= b;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
  }
  return (c ^ 0xffffffff) >>> 0;
}
export function zipFiles(entries) {
  if (!entries.length || entries.length > 65535) throw Error('Jumlah file ZIP tidak valid.');
  const seen = new Set(),
    local = [],
    central = [];
  let offset = 0,
    total = 0;
  for (const e of entries) {
    safePath(e.name);
    const key = e.name.toLowerCase();
    if (seen.has(key)) throw Error('File duplikat: ' + e.name);
    seen.add(key);
    const name = encoder.encode(e.name),
      data = typeof e.data === 'string' ? encoder.encode(e.data) : e.data;
    if (!(data instanceof Uint8Array) && !(data instanceof Uint8ClampedArray))
      throw Error('Data ZIP tidak valid.');
    total += data.length + name.length * 2 + 76;
    if (total > MAX_EXPORT) throw Error('Hasil ZIP melebihi 128 MB.');
    const crc = crc32(data),
      l = new Uint8Array(30 + name.length),
      v = new DataView(l.buffer);
    v.setUint32(0, 0x04034b50, true);
    v.setUint16(4, 20, true);
    v.setUint16(6, 0x800, true);
    v.setUint16(12, 33, true);
    v.setUint32(14, crc, true);
    v.setUint32(18, data.length, true);
    v.setUint32(22, data.length, true);
    v.setUint16(26, name.length, true);
    l.set(name, 30);
    local.push(l, data);
    const c = new Uint8Array(46 + name.length),
      cv = new DataView(c.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x800, true);
    cv.setUint16(14, 33, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, data.length, true);
    cv.setUint32(24, data.length, true);
    cv.setUint16(28, name.length, true);
    cv.setUint32(42, offset, true);
    c.set(name, 46);
    central.push(c);
    offset += l.length + data.length;
  }
  const cs = central.reduce((n, c) => n + c.length, 0),
    end = new Uint8Array(22),
    ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, cs, true);
  ev.setUint32(16, offset, true);
  const out = new Uint8Array(offset + cs + 22);
  let pos = 0;
  for (const b of [...local, ...central, end]) {
    out.set(b, pos);
    pos += b.length;
  }
  return out;
}
