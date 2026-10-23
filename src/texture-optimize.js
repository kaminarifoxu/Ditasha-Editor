import { deflateRaw } from 'pako';
import { Resource, decodeTexture } from './resource.js';
import { MAX_YTD_RESOURCE_BYTES, MAX_YTD_GRAPHICS_BYTES } from './texture-memory.js';
import { resizeTexture, compressTexture } from './texture-compress.js';
const BC1 = 0x31545844,
  BC2 = 0x33545844,
  BC3 = 0x35545844,
  BC7 = 0x20374342,
  BC4 = 0x31495441;
const align = (n) => Math.ceil(n / 16) * 16;
function nativeSize(w, h, format, levels, stride) {
  let size = 0;
  for (let i = 0; i < levels; i++) {
    if ([BC1, BC2, BC3, BC4, BC7].includes(format))
      size += Math.ceil(w / 4) * Math.ceil(h / 4) * ([BC1, BC4].includes(format) ? 8 : 16);
    else if ([21, 22, 32, 33, 28, 50, 51].includes(format))
      size +=
        i === 0 ? stride * h : w * h * ([28, 50].includes(format) ? 1 : format === 51 ? 2 : 4);
    else throw Error('Format tekstur belum didukung untuk optimasi: ' + format);
    w = Math.max(1, w >> 1);
    h = Math.max(1, h >> 1);
  }
  return size;
}
function decodeBoundedMip(r, p, w, h, format, levels, stride) {
  let skipped = 0,
    advance = 0;
  while (w > 8192 || h > 8192 || w * h > 16777216) {
    if (++skipped >= levels)
      throw Error('Atlas terlalu besar tanpa mipmap aman; asli dipertahankan.');
    advance += nativeSize(w, h, format, 1, stride);
    w = Math.max(1, w >> 1);
    h = Math.max(1, h >> 1);
    stride = [BC1, BC2, BC3, BC4, BC7].includes(format)
      ? Math.max(1, Math.ceil(w * ([BC1, BC4].includes(format) ? 0.5 : 1)))
      : w * ([28, 50].includes(format) ? 1 : format === 51 ? 2 : 4);
  }
  if (!skipped) return decodeTexture(r, p);
  const descriptor = r.bytes.slice(p + 80, p + 120);
  const pointer = r.v.getBigUint64(p + 112, true);
  try {
    r.v.setUint16(p + 80, w, true);
    r.v.setUint16(p + 82, h, true);
    r.v.setUint16(p + 86, stride, true);
    r.bytes[p + 93] = levels - skipped;
    r.v.setBigUint64(p + 112, pointer + BigInt(advance), true);
    return decodeTexture(r, p);
  } finally {
    r.bytes.set(descriptor, p + 80);
  }
}
export function optimizeYtd(buffer, { maxSize = 1024 } = {}) {
  if (![256, 512, 1024, 2048, 4096].includes(maxSize)) throw Error('Ukuran optimasi tidak valid.');
  const r = new Resource(buffer, 13, MAX_YTD_RESOURCE_BYTES),
    entries = r.list(48, r.u16(56)),
    parts = [],
    details = [];
  const aliases = new Map();
  let offset = 0,
    before = 0,
    after = 0,
    changed = 0;
  for (const p of entries) {
    const w = r.u16(p + 80),
      h = r.u16(p + 82),
      format = r.u32(p + 88),
      levels = r.bytes[p + 93] || 1,
      data = r.ptr(p + 112),
      stride = r.u16(p + 86);
    if (
      !w ||
      !h ||
      levels > Math.floor(Math.log2(Math.max(w, h))) + 1 ||
      data === null ||
      r.u16(p + 84) !== 1
    )
      throw Error('Texture volume/mipmap tidak didukung; file asli dipertahankan.');
    const effectiveStride = stride || w * ([28, 50].includes(format) ? 1 : format === 51 ? 2 : 4);
    const size = nativeSize(w, h, format, levels, effectiveStride);
    if (data < r.sys || data + size > r.bytes.length)
      throw Error('Data mipmap terpotong; file asli dipertahankan.');
    let payload = r.bytes.subarray(data, data + size),
      nw = w,
      nh = h,
      nf = format,
      nl = levels,
      ns = stride;
    const uncompressed = ![BC1, BC2, BC3, BC4, BC7].includes(format);
    if (Math.max(w, h) > maxSize || uncompressed) {
      let t = decodeBoundedMip(r, p, w, h, format, levels, effectiveStride);
      const scale = Math.min(1, maxSize / Math.max(w, h));
      const dataMap = format === BC4 || /(normal|bump|spec|mask|rough|metal)/i.test(t.name);
      nw = Math.max(1, Math.floor(w * scale));
      nh = Math.max(1, Math.floor(h * scale));
      if (nw !== w || nh !== h) t = resizeTexture(t, nw, nh, dataMap);
      const alpha = t.out.some((v, i) => i % 4 === 3 && v < 255),
        chunks = [];
      do {
        chunks.push(compressTexture(t, alpha));
        if (t.w === 1 && t.h === 1) break;
        t = resizeTexture(t, Math.max(1, t.w >> 1), Math.max(1, t.h >> 1), dataMap);
      } while (true);
      const count = chunks.reduce((s, c) => s + c.length, 0);
      if (count < size) {
        payload = new Uint8Array(count);
        let cursor = 0;
        for (const c of chunks) {
          payload.set(c, cursor);
          cursor += c.length;
        }
        nf = alpha ? BC3 : BC1;
        nl = chunks.length;
        // Legacy RAGE stride is bytes per pixel row (block row pitch / 4),
        // unlike a DDS/D3D block-row pitch. Native YTDs store w for DXT5.
        ns = Math.max(1, Math.ceil(nw * (alpha ? 1 : 0.5)));
        changed++;
      } else {
        nw = w;
        nh = h;
      }
    }
    const aliasKey = [data, size, w, h, format, levels, stride].join(':');
    const packedOffset = aliases.get(aliasKey) ?? offset;
    parts.push({
      p,
      offset: packedOffset,
      payload,
      w: nw,
      h: nh,
      format: nf,
      levels: nl,
      stride: ns,
    });
    if (!aliases.has(aliasKey)) {
      aliases.set(aliasKey, offset);
      offset += align(payload.length);
    }
    before += size;
    after += payload.length;
    details.push({
      name: r.str(r.ptr(p + 40)),
      before: { w, h, format, levels, bytes: size },
      after: { w: nw, h: nh, format: nf, levels: nl, bytes: payload.length },
    });
  }
  const large = offset > 16777216,
    unit = large ? 8192 : 512,
    exp = Math.max(0, Math.ceil(Math.log2(offset / unit))),
    gfx = unit * 2 ** exp;
  const allocation = { before: r.bytes.length - r.sys, after: gfx };
  const repacked = gfx < allocation.before;
  if (!changed && !repacked)
    return {
      bytes: new Uint8Array(buffer),
      changed: 0,
      repacked: false,
      before,
      after: before,
      allocation: { before: allocation.before, after: allocation.before },
      details,
    };
  if (exp > 15 || gfx > MAX_YTD_GRAPHICS_BYTES || r.sys + gfx > MAX_YTD_RESOURCE_BYTES)
    throw Error('Hasil optimasi melewati batas resource.');
  const bytes = new Uint8Array(r.sys + gfx);
  bytes.set(r.bytes.subarray(0, r.sys));
  const v = new DataView(bytes.buffer);
  for (const t of parts) {
    bytes.set(t.payload, r.sys + t.offset);
    v.setUint16(t.p + 80, t.w, true);
    v.setUint16(t.p + 82, t.h, true);
    v.setUint16(t.p + 86, t.stride, true);
    v.setUint32(t.p + 88, t.format, true);
    bytes[t.p + 93] = t.levels;
    v.setBigUint64(t.p + 112, BigInt(0x60000000 + t.offset), true);
  }
  const header = r.header.slice(),
    hv = new DataView(header.buffer);
  hv.setUint32(
    12,
    (hv.getUint32(12, true) & 0xf0000000) | (large ? 0x00020000 : 0x08000000) | exp,
    true,
  );
  const pages = r.ptr(8);
  if (pages !== null && pages < r.sys - 16) bytes[pages + 9] = 1;
  const compressed = deflateRaw(bytes),
    out = new Uint8Array(16 + compressed.length);
  out.set(header);
  out.set(compressed, 16);
  return { bytes: out, changed, repacked, before, after, allocation, details };
}
