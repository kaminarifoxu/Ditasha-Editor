// Minimal seek-less WebM muxer for our own ordered VP8 VideoEncoder chunks.
const text = new TextEncoder();
const join = (parts) => {
  const out = new Uint8Array(parts.reduce((n, b) => n + b.length, 0));
  let at = 0;
  for (const b of parts) {
    out.set(b, at);
    at += b.length;
  }
  return out;
};
function id(n) {
  const bytes = [];
  while (n) {
    bytes.unshift(n & 255);
    n = Math.floor(n / 256);
  }
  return new Uint8Array(bytes);
}
function size(n) {
  let width = 1;
  while (BigInt(n) >= (1n << BigInt(7 * width)) - 1n) width++;
  const bytes = new Uint8Array(width);
  let value = BigInt(n) | (1n << BigInt(7 * width));
  for (let i = width - 1; i >= 0; i--) {
    bytes[i] = Number(value & 255n);
    value >>= 8n;
  }
  return bytes;
}
const elem = (key, bytes) => join([id(key), size(bytes.length), bytes]);
const uint = (n) => {
  if (!Number.isSafeInteger(n) || n < 0) throw Error('Bilangan WebM tidak valid.');
  const bytes = [];
  do {
    bytes.unshift(n % 256);
    n = Math.floor(n / 256);
  } while (n);
  return new Uint8Array(bytes);
};
const u = (key, n) => elem(key, uint(n));
const str = (key, s) => elem(key, text.encode(s));
export function muxBoothWebm(chunks, { width, height, fps, duration }) {
  if (
    !Array.isArray(chunks) ||
    !chunks.length ||
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 1 ||
    height < 1 ||
    width > 1920 ||
    height > 1920 ||
    ![24, 30].includes(fps) ||
    !Number.isFinite(duration) ||
    duration < 1 ||
    duration > 120
  )
    throw Error('Pengaturan WebM tidak valid.');
  const head = elem(
    0x1a45dfa3,
    join([
      u(0x4286, 1),
      u(0x42f7, 1),
      u(0x42f2, 4),
      u(0x42f3, 8),
      str(0x4282, 'webm'),
      u(0x4287, 4),
      u(0x4285, 2),
    ]),
  );
  const d = new Uint8Array(8);
  new DataView(d.buffer).setFloat64(0, duration * 1000, false);
  const info = elem(
    0x1549a966,
    join([u(0x2ad7b1, 1e6), elem(0x4489, d), str(0x4d80, 'DITASHA'), str(0x5741, 'DITASHA')]),
  );
  const track = elem(
    0x1654ae6b,
    elem(
      0xae,
      join([
        u(0xd7, 1),
        u(0x73c5, 1),
        u(0x83, 1),
        str(0x86, 'V_VP8'),
        u(0x23e383, Math.round(1e9 / fps)),
        elem(0xe0, join([u(0xb0, width), u(0xba, height)])),
      ]),
    ),
  );
  const clusters = [];
  let clusterTime = 0,
    blocks = [],
    total = 0,
    last = -1;
  const flush = () => {
    if (blocks.length) clusters.push(elem(0x1f43b675, join([u(0xe7, clusterTime), ...blocks])));
    blocks = [];
  };
  for (const c of chunks) {
    if (
      !(c.bytes instanceof Uint8Array) ||
      !Number.isSafeInteger(c.timestamp) ||
      c.timestamp < last ||
      c.timestamp < 0 ||
      c.timestamp > duration * 1e6 ||
      (!blocks.length && !clusters.length && !c.key)
    )
      throw Error('Frame WebM tidak valid.');
    last = c.timestamp;
    total += c.bytes.length;
    if (total > 120 * 1024 ** 2) throw Error('Video melebihi 120 MB.');
    const ms = Math.round(c.timestamp / 1000);
    if (blocks.length && ms - clusterTime > 5000) {
      flush();
      clusterTime = ms;
    }
    const h = new Uint8Array(4);
    h[0] = 0x81;
    new DataView(h.buffer).setInt16(1, ms - clusterTime, false);
    h[3] = c.key ? 0x80 : 0;
    blocks.push(elem(0xa3, join([h, c.bytes])));
  }
  flush();
  return new Blob([head, elem(0x18538067, join([info, track, ...clusters]))], {
    type: 'video/webm',
  });
}
