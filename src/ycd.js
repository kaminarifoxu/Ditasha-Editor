// Read-only GTA V Legacy YCD decoder. Format/channel algorithms adapted from
// CodeWalker Clip.cs (MIT, Neodymium 2016); see ui/CODEWALKER-YCD-LICENSE.txt.
import { Resource } from './resource.js';
import { AnimationClip, QuaternionKeyframeTrack, VectorKeyframeTrack, Quaternion } from 'three';
const fail = (message) => {
  throw Error('YCD: ' + message);
};
const finite = (n) => (Number.isFinite(n) ? n : fail('nilai animasi tidak valid.'));
const bounded = (n, min, max) =>
  Number.isInteger(n) && n >= min && n <= max ? n : fail('jumlah/data kanal tidak valid.');
function sequence(r, at, boneCount, budget) {
  const length = r.u32(at + 4),
    frameOffset = r.u32(at + 12),
    frames = r.u16(at + 22),
    stride = r.u16(at + 24),
    chunk = r.bytes[at + 30];
  bounded(length, 18, 64 * 1024 ** 2);
  bounded(frames, 1, 16384);
  bounded(chunk, 1, 255);
  if (at + 32 + length > r.bytes.length) fail('blok sequence terpotong.');
  const bytes = r.bytes.subarray(at + 32, at + 32 + length),
    v = new DataView(bytes.buffer, bytes.byteOffset, bytes.length);
  let pos = 0,
    list = frameOffset + frames * stride,
    info = list + 18,
    frameBits = 0;
  if (info > length) fail('tabel kanal terpotong.');
  const check = (p, n) => {
    if (p < 0 || p + n > length) fail('data kanal terpotong.');
  };
  const u16 = (p) => {
    check(p, 2);
    return v.getUint16(p, true);
  };
  const int = () => {
    check(pos, 4);
    const n = v.getInt32(pos, true);
    pos += 4;
    return n;
  };
  const float = () => {
    check(pos, 4);
    const n = v.getFloat32(pos, true);
    pos += 4;
    return finite(n);
  };
  const bits = (p, n, end = length * 8) => {
    bounded(n, 0, 32);
    if (p < 0 || p + n > end || end > length * 8) fail('bitstream kanal terpotong.');
    let out = 0;
    for (let k = 0; k < n; k++) out += ((bytes[(p + k) >> 3] >> ((p + k) & 7)) & 1) * 2 ** k;
    return out;
  };
  const channels = [],
    groups = Array.from({ length: boneCount }, () => []);
  for (let type = 0; type < 9; type++) {
    const count = bounded(u16(list), 0, boneCount * 4);
    list += 2;
    for (let i = 0; i < count; i++) {
      const association = u16(info);
      info += 2;
      const seq = association >> 2,
        component = association & 3;
      if (seq >= boneCount) fail('indeks track di luar BoneIds.');
      const c = { type, component, width: 0, frameOffset: frameBits };
      if (type < 2) {
        c.vector = [float(), float(), float()];
        if (type === 0)
          c.vector.push(Math.sqrt(Math.max(0, 1 - c.vector.reduce((n, x) => n + x * x, 0))));
      } else if (type === 2) c.value = float();
      else if (type === 3) c.width = 32;
      else if (type === 4) {
        c.width = bounded(int(), 1, 32);
        c.quantum = float();
        c.offset = float();
      } else if (type === 5) {
        c.width = bounded(int(), 1, 24);
        const valueBits = bounded(int(), 1, 32),
          ints = bounded(int(), 1, 1e6);
        c.quantum = float();
        c.offset = float();
        check(pos, ints * 4);
        const count = Math.min(Math.floor((ints * 32) / valueBits), 2 ** c.width - 1);
        c.lookup = Array.from({ length: count }, (_, i) =>
          finite(bits(pos * 8 + i * valueBits, valueBits) * c.quantum + c.offset),
        );
        pos += ints * 4;
      } else if (type === 6) {
        budget.values += frames;
        if (budget.values > 8e6) fail('terlalu banyak sampel animasi.');
        const start = pos,
          ints = bounded(int(), 4, 1e6),
          packed = int(),
          quantum = float(),
          offset = float();
        const a = bounded(packed & 255, 0, 32),
          b = bounded((packed >>> 8) & 255, 0, 32),
          d = bounded((packed >>> 16) & 255, 0, 24);
        const end = (start + ints * 4) * 8,
          chunks = Math.ceil(frames / chunk),
          base = pos * 8;
        check(start, ints * 4);
        const deltaBase = base + chunks * (a + b);
        c.values = new Float32Array(frames);
        for (let k = 0; k < chunks; k++) {
          let p = deltaBase + bits(base + k * a, a, end),
            value = bits(base + chunks * a + k * b, b, end),
            inc = 0;
          for (let j = 0; j < chunk && k * chunk + j < frames; j++) {
            c.values[k * chunk + j] = finite(value * quantum + offset);
            // CW reads one padded delta after the last partial-chunk frame too;
            // it has no effect on any output sample and is deliberately omitted.
            if (j + 1 >= chunk || k * chunk + j + 1 >= frames) break;
            let delta = bits(p, d, end);
            p += d;
            let unary = 0;
            while (!bits(p++, 1, end)) {
              if (++unary > 65536) fail('delta kanal terlalu besar.');
            }
            delta += unary * 2 ** d;
            if (delta && bits(p++, 1, end)) delta = -delta;
            inc += delta;
            value += inc;
          }
        }
        pos = start + ints * 4;
      }
      if (type >= 3 && type <= 5) {
        budget.values += frames + (c.lookup?.length || 0);
        if (budget.values > 8e6) fail('terlalu banyak sampel animasi.');
        c.values = new Float32Array(frames);
        for (let f = 0; f < frames; f++) {
          const raw = bits(
            (frameOffset + f * stride) * 8 + frameBits,
            c.width,
            (frameOffset + (f + 1) * stride) * 8,
          );
          let value;
          if (type === 3) {
            const tmp = new DataView(new ArrayBuffer(4));
            tmp.setUint32(0, raw, true);
            value = tmp.getFloat32(0, true);
          } else if (type === 4) value = raw * c.quantum + c.offset;
          else {
            if (raw >= c.lookup.length) fail('indeks quantization tidak valid.');
            value = c.lookup[raw];
          }
          c.values[f] = finite(value);
        }
      }
      frameBits += c.width;
      if (frameBits > stride * 8) fail('stride kanal tidak cukup.');
      const index = type === 7 ? 3 : type === 8 ? 4 : component;
      if (groups[seq][index]) fail('kanal duplikat.');
      groups[seq][index] = c;
      channels.push(c);
    }
    info += ((4 - (count % 4)) % 4) * 2;
    check(info, 0);
  }
  if (pos > frameOffset) fail('header kanal bertumpuk dengan frame.');
  function evaluate(index, frame) {
    const group = groups[index];
    frame %= frames;
    const cached = group[3]?.type === 7 ? group[3] : group[4]?.type === 8 ? group[4] : null;
    const scalar = (c) => {
      if (!c) fail('komponen kanal tidak lengkap.');
      return c.values ? c.values[frame] : c.value;
    };
    if (cached) {
      const xyz = [0, 1, 2].map((i) => scalar(group[i]));
      xyz.splice(
        cached.component,
        0,
        Math.sqrt(Math.max(0, 1 - xyz.reduce((n, x) => n + x * x, 0))),
      );
      return xyz;
    }
    const out = [];
    for (const c of group) {
      if (!c) fail('komponen kanal tidak lengkap.');
      out.push(...(c.vector || [scalar(c)]));
    }
    return out;
  }
  return {
    frames,
    evaluate,
    types: channels.reduce((counts, c) => (counts[c.type]++, counts), Array(9).fill(0)),
  };
}
export function readYcd(buffer) {
  if (buffer.byteLength > 64 * 1024 ** 2) fail('file maksimal 64 MB.');
  if (buffer.byteLength < 16) fail('header terpotong (' + buffer.byteLength + ' byte).');
  const view = new DataView(buffer);
  let raw = false;
  // Some exported YCDs contain the uncompressed system pages without the RSC7
  // envelope. Recognize the observed dictionary layout, never arbitrary zeros.
  if (buffer.byteLength >= 64 && view.getUint32(0, true) === 0 && view.getUint32(4, true) === 1) {
    const table = Number(view.getBigUint64(40, true)) - 0x50000000;
    const capacity = view.getUint16(48, true),
      count = view.getUint16(50, true);
    raw =
      buffer.byteLength % 512 === 0 &&
      capacity > 0 &&
      capacity <= 4096 &&
      count > 0 &&
      count <= 256 &&
      table >= 64 &&
      table + capacity * 8 <= buffer.byteLength;
  }
  if (view.getUint32(0, true) !== 0x37435352 && !raw) {
    const bytes = new Uint8Array(buffer, 0, Math.min(16, buffer.byteLength));
    const signature = [...bytes.slice(0, 4)].map((b) => b.toString(16).padStart(2, '0')).join(' ');
    const ascii = String.fromCharCode(...bytes.slice(0, 4));
    if (ascii === 'RSC8')
      fail('resource RSC8 bukan YCD RSC7 Legacy yang didukung. Gunakan ekspor YCD GTA V Legacy.');
    if (ascii === 'FXAP')
      fail(
        'file FiveM Asset Escrow (FXAP) tidak dapat dibaca sebagai YCD sumber. Gunakan file sumber tidak dilindungi dari pembuat aset.',
      );
    if (
      ascii.startsWith('PK') ||
      ascii.startsWith('Rar!') ||
      (bytes[0] === 0x37 && bytes[1] === 0x7a)
    )
      fail('file ini arsip, bukan YCD binary. Ekstrak .ycd asli dari ZIP/RAR/7z terlebih dahulu.');
    if (ascii.startsWith('<?xm') || ascii.startsWith('<Cli'))
      fail('file XML, bukan YCD binary. Konversikan XML ke YCD Legacy sebelum impor.');
    fail(
      'header bukan RSC7 Legacy (signature ' +
        signature +
        '). Format file belum dikenali; file sumber diperlukan untuk pemeriksaan.',
    );
  }
  const r = raw
      ? Object.assign(Object.create(Resource.prototype), {
          sys: buffer.byteLength,
          bytes: new Uint8Array(buffer),
          v: view,
        })
      : new Resource(buffer, 46, 128 * 1024 ** 2),
    animations = new Map(),
    clips = [],
    listClips = [],
    warnings = [],
    budget = { values: 0 };
  function animation(at) {
    if (at === null) fail('animation pointer kosong.');
    if (animations.has(at)) return animations.get(at);
    if (animations.size >= 256) fail('maksimal 256 animation.');
    const frames = bounded(r.u16(at + 20), 1, 16384),
      limit = bounded(r.u16(at + 22), 1, 16384),
      nativeDuration = finite(r.f32(at + 24)),
      duration = nativeDuration === 0 && frames === 1 ? 1 / 30 : nativeDuration;
    if (duration <= 0 || duration > 600) fail('durasi animation di luar 0–600 detik.');
    const count = bounded(r.u16(at + 88), 1, 2048),
      ids = r.ptr(at + 80);
    if (ids === null || ids + count * 4 > r.bytes.length) fail('BoneIds terpotong.');
    const bones = Array.from({ length: count }, (_, i) => ({
      tag: r.u16(ids + i * 4),
      track: r.bytes[ids + i * 4 + 3],
    }));
    const blocks = r
      .list(at + 64, bounded(r.u16(at + 72), 1, 256))
      .map((p) => sequence(r, p, count, budget));
    if (blocks.length < Math.ceil(frames / limit)) fail('sequence tidak lengkap.');
    for (let i = 0; i < blocks.length; i++)
      if (blocks[i].frames < Math.min(limit, frames - i * limit))
        fail('frame sequence tidak lengkap.');
    const anim = { frames, limit, duration, bones, blocks };
    animations.set(at, anim);
    return anim;
  }
  const capacity = bounded(r.u16(48), 1, 4096),
    table = r.ptr(40),
    visited = new Set();
  if (table === null) fail('kamus clip kosong.');
  for (let i = 0; i < capacity; i++) {
    for (let entry = r.ptr(table + i * 8); entry !== null; entry = r.ptr(entry + 16)) {
      if (visited.has(entry)) fail('rantai clip berulang.');
      visited.add(entry);
      if (visited.size > 256) fail('maksimal 256 clip per file.');
      const p = r.ptr(entry + 8);
      if (p === null) fail('clip kosong.');
      const name =
        r.str(r.ptr(p + 24)).replace(/^.*[/:\\]/, '') || 'clip_' + r.u32(entry).toString(16);
      const type = r.u32(p + 16);
      try {
        let anim,
          start,
          end,
          rate,
          duration,
          loopRange = false;
        if (type === 1) {
          anim = animation(r.ptr(p + 80));
          start = finite(r.f32(p + 88));
          end = finite(r.f32(p + 92));
          rate = finite(r.f32(p + 96));
        } else if (type === 2) {
          const count = bounded(r.u16(p + 88), 1, 256),
            entries = r.ptr(p + 80);
          if (entries === null || entries + count * 24 > r.bytes.length)
            fail('daftar animation terpotong.');
          if (count !== 1) {
            warnings.push(name + ': blend beberapa sumber/facial belum didukung; clip dilewati.');
            continue;
          }
          start = finite(r.f32(entries));
          end = finite(r.f32(entries + 4));
          rate = finite(r.f32(entries + 8));
          anim = animation(r.ptr(entries + 16));
          duration = finite(r.f32(p + 96));
          loopRange = true;
        } else {
          warnings.push(name + ': tipe clip ' + type + ' belum didukung; clip dilewati.');
          continue;
        }
        if (start < 0 || start > 3600 || end < start || end > 3600 || rate < 0 || rate > 16)
          fail(
            'rentang waktu/rate clip tidak valid (' + start + '–' + end + ', rate ' + rate + ').',
          );
        const held = end === start || rate === 0 || anim.frames === 1;
        duration ??= held ? 1 / 30 : (end - start) / rate;
        if (duration <= 0 || duration > 3600) fail('durasi clip di luar 0–3600 detik.');
        const clip = { name, duration, animation: anim, start, end, rate, held, loopRange };
        const sampleCount = held
          ? 2
          : Math.min(
              16384,
              Math.max(2, Math.ceil((duration * rate * (anim.frames - 1)) / anim.duration) + 1),
            );
        if (sampleCount * anim.bones.filter((b) => [0, 1].includes(b.track)).length > 2e6)
          fail('clip terlalu besar untuk preview skeletal.');
        (type === 1 ? clips : listClips).push(clip);
      } catch (error) {
        warnings.push(name + ': ' + error.message + ' Clip dilewati.');
      }
    }
  }
  // Append newly supported list clips so numeric IDs of existing single clips stay stable.
  clips.push(...listClips);
  if (!clips.length) {
    const error = Error(
      'YCD: tidak ada clip yang dapat diputar (' + warnings.length + ' clip dilewati).',
    );
    error.details = warnings;
    throw error;
  }
  return {
    clips,
    warnings,
    animations: animations.size,
    values: budget.values,
    memoryBytes: r.bytes.byteLength + budget.values * 4,
  };
}
function evaluate(anim, index, time, quaternion) {
  // Native clip windows may extend beyond one animation cycle (CW GetFramePosition).
  const f = (Math.max(0, time) / anim.duration) * (anim.frames - 1);
  const f0 = Math.floor(f) % anim.frames,
    f1 = (f0 + 1) % anim.frames,
    alpha = f - Math.floor(f);
  const sample = (frame) =>
    anim.blocks[Math.floor(frame / anim.limit)].evaluate(index, frame % anim.limit);
  const a = sample(f0),
    b = sample(f1);
  if (a.length !== b.length || !a.length || ![...a, ...b].every(Number.isFinite))
    fail('sampel track tidak lengkap.');
  if (quaternion) {
    if (a.length < 4 || Math.hypot(...a.slice(0, 4)) < 1e-8 || Math.hypot(...b.slice(0, 4)) < 1e-8)
      fail('rotasi track tidak valid.');
    return new Quaternion(...a.slice(0, 4))
      .normalize()
      .slerp(new Quaternion(...b.slice(0, 4)).normalize(), alpha)
      .toArray();
  }
  return a.map((x, i) => x + (b[i] - x) * alpha);
}
export function ycdAnimationClip(source, root) {
  const boneByTag = new Map();
  root.traverse((b) => {
    if (b.isBone && Number.isInteger(b.userData.tag)) boneByTag.set(b.userData.tag, b);
  });
  const anim = source.animation,
    tracks = [],
    times = [];
  // Preserve native frame cadence and clip start/rate; cap the total import budget.
  const samples = source.held
    ? 2
    : Math.min(
        16384,
        Math.max(
          2,
          Math.ceil(((source.duration * (anim.frames - 1)) / anim.duration) * source.rate) + 1,
        ),
      );
  for (let i = 0; i < samples; i++) times.push((i * source.duration) / (samples - 1));
  for (const [index, id] of anim.bones.entries()) {
    const bone = boneByTag.get(id.tag);
    if (!bone || ![0, 1].includes(id.track)) continue; // no UV, facial scalar, root-motion extraction or props
    if ((tracks.length + 1) * samples > 2e6) fail('terlalu banyak sampel untuk preview skeleton.');
    const values = [];
    let previous;
    for (const time of times) {
      const value = evaluate(
        anim,
        index,
        source.held
          ? source.start
          : source.loopRange
            ? source.start + ((time * source.rate) % (source.end - source.start))
            : Math.min(source.end, source.start + time * source.rate),
        id.track === 1,
      );
      if (!value.length || !value.every(Number.isFinite)) fail('track kosong/tidak valid.');
      if (id.track === 0) {
        if (value.length < 3) fail('track posisi tidak lengkap.');
        values.push(value[0], value[2], -value[1]);
      } else {
        if (value.length < 4 || Math.hypot(...value.slice(0, 4)) < 1e-8)
          fail('track rotasi tidak lengkap.');
        const q = new Quaternion(value[0], value[2], -value[1], value[3]).normalize();
        if (previous && previous.dot(q) < 0) q.set(-q.x, -q.y, -q.z, -q.w);
        values.push(...q.toArray());
        previous = q;
      }
    }
    const Constructor = id.track === 0 ? VectorKeyframeTrack : QuaternionKeyframeTrack;
    tracks.push(
      new Constructor(bone.uuid + (id.track === 0 ? '.position' : '.quaternion'), times, values),
    );
  }
  return new AnimationClip(source.name, source.duration, tracks);
}
