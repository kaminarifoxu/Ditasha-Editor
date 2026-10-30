import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MOVIE_DEFAULTS,
  validateMovie,
  validateMovieFrame,
  setMovieKey,
  sampleMovie,
} from '../src/booth-movie.js';
import { muxBoothWebm } from '../src/booth-webm.js';
import { fixWebmDuration } from '../src/webm-duration.js';
const frame = () => ({ ...MOVIE_DEFAULTS, position: [0, 1, 5], target: [0, 1, 0] });
const movie = () => ({
  version: 1,
  duration: 10,
  fps: 24,
  size: '1280x720',
  interpolation: 'smooth',
  time: 0,
  keys: [],
  view: frame(),
});
test('Movie keys sort, replace one timestamp and preserve input camera ownership', () => {
  const f = frame();
  let keys = setMovieKey([], 5, f);
  f.position[0] = 99;
  assert.equal(keys[0].frame.position[0], 0);
  keys = setMovieKey(keys, 0, frame());
  keys = setMovieKey(keys, 5, { ...frame(), fov: 90 });
  assert.deepEqual(
    keys.map((k) => k.time),
    [0, 5],
  );
  assert.equal(keys[1].frame.fov, 90);
  for (let i = 0; i < 64; i++) keys = setMovieKey(keys, i, frame());
  assert.throws(() => setMovieKey(keys, 100, frame()), /64/);
  assert.equal(setMovieKey(keys, 1, frame()).length, 64);
});
test('Camera interpolation includes FOV, light/color, short-angle roll and discrete lens cuts', () => {
  const a = { ...frame(), roll: 170, shadowAngle: 350, keyColor: '#ff0000' },
    b = {
      ...frame(),
      position: [4, 1, 5],
      fov: 90,
      roll: -170,
      shadowAngle: 10,
      keyColor: '#0000ff',
      fisheye: true,
    };
  const keys = [
      { time: 0, frame: a },
      { time: 10, frame: b },
    ],
    mid = sampleMovie(keys, 5, 'linear');
  assert.deepEqual(mid.position, [2, 1, 5]);
  assert.equal(mid.fov, 62.5);
  assert.equal(Math.abs(mid.roll), 180);
  assert.equal(mid.shadowAngle, 0);
  assert.equal(mid.keyColor, '#800080');
  assert.equal(mid.fisheye, false);
  assert.equal(sampleMovie(keys, 10).fisheye, true);
  assert.equal(sampleMovie(keys, 2.5, 'linear').position[0], 1);
  assert.equal(sampleMovie(keys, 2.5, 'smooth').position[0], 0.625);
  assert.deepEqual(sampleMovie(keys, 9, 'cut'), a);
  assert.equal(sampleMovie([], 0), null);
});
test('Movie presets reject invalid cameras, timestamps, lens/shadow limits and export budgets', () => {
  const s = movie();
  s.keys = setMovieKey([], 0, frame());
  assert.equal(validateMovie(s), s);
  assert.throws(() => validateMovie({ ...s, duration: 121 }), /Timeline/);
  assert.throws(() => validateMovie({ ...s, keys: [...s.keys, ...s.keys] }), /Waktu/);
  assert.throws(() => validateMovie({ ...s, animate: 'yes' }), /Timeline/);
  assert.throws(() => validateMovieFrame({ ...frame(), position: [0, 1, 0] }), /berbeda/);
  assert.throws(() => validateMovieFrame({ ...frame(), shadowSize: 16384 }), /bayangan/);
  assert.throws(() => validateMovieFrame({ ...frame(), fov: NaN }), /tidak valid/);
});
test('WebM muxer records finite duration and preserves VP8 packet payloads and geometry', async () => {
  const chunks = [
    { bytes: new Uint8Array([1, 2, 3, 4]), timestamp: 0, key: true },
    { bytes: new Uint8Array([5, 6, 7]), timestamp: 6e6, key: true },
  ];
  const blob = muxBoothWebm(chunks, { width: 1280, height: 720, fps: 24, duration: 7 });
  const bytes = new Uint8Array(await blob.arrayBuffer());
  assert.equal(blob.type, 'video/webm');
  assert.deepEqual([...bytes.slice(0, 4)], [0x1a, 0x45, 0xdf, 0xa3]);
  assert(new TextDecoder().decode(bytes).includes('V_VP8'));
  const changed = fixWebmDuration(bytes, 9);
  assert.equal(changed.length, bytes.length);
  assert.notDeepEqual(changed, bytes);
  assert.deepEqual([...bytes.slice(-7)], [0x81, 0, 0, 0x80, 5, 6, 7]);
  assert.throws(
    () =>
      muxBoothWebm([{ ...chunks[0], key: false }], {
        width: 1280,
        height: 720,
        fps: 24,
        duration: 1,
      }),
    /Frame/,
  );
});
test('MediaRecorder duration insertion preserves data and rejects truncated headers', () => {
  const bytes = new Uint8Array([
    0x18, 0x53, 0x80, 0x67, 0xff, 0x15, 0x49, 0xa9, 0x66, 0x87, 0x2a, 0xd7, 0xb1, 0x83, 0x0f, 0x42,
    0x40,
  ]);
  const out = fixWebmDuration(bytes, 2);
  assert.equal(out.length, bytes.length + 11);
  assert.equal(new DataView(out.buffer).getFloat64(out.length - 8, false), 2000);
  assert.deepEqual([...out.slice(10, 17)], [0x2a, 0xd7, 0xb1, 0x83, 0x0f, 0x42, 0x40]);
  assert.throws(() => fixWebmDuration(bytes.slice(0, -1), 2), /lengkap|terpotong/);
});
