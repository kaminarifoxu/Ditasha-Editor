// Original Photo Booth camera timeline. No CodeWalker/Rockstar source copied.
export const MOVIE_DEFAULTS = {
  fov: 35,
  roll: 0,
  fisheye: false,
  fill: 1,
  ambient: 1,
  keyColor: '#fff1df',
  fillColor: '#cbdcff',
  height: 5,
  distance: 5,
  shadowBias: -0.0005,
  normalBias: 0.02,
  shadowSize: 1024,
  shadowMode: 'soft',
  shadowRadius: 1,
  power: 1,
  shadowAngle: 37,
  shadowStrength: 1,
  shadows: true,
};
const ranges = {
  fov: [10, 175],
  roll: [-180, 180],
  fill: [0, 4],
  ambient: [0, 4],
  height: [0.1, 30],
  distance: [0.1, 30],
  shadowBias: [-0.02, 0.02],
  normalBias: [0, 0.2],
  shadowRadius: [0, 5],
  power: [0.3, 3],
  shadowAngle: [0, 360],
  shadowStrength: [0, 1],
};
export function validateMovieFrame(f) {
  if (!f || typeof f !== 'object') throw Error('Keyframe kamera tidak valid.');
  for (const k of ['position', 'target'])
    if (
      !Array.isArray(f[k]) ||
      f[k].length !== 3 ||
      !f[k].every((n) => Number.isFinite(n) && Math.abs(n) <= 10000)
    )
      throw Error('Posisi kamera tidak valid.');
  if (Math.hypot(...f.position.map((n, i) => n - f.target[i])) < 0.001)
    throw Error('Posisi kamera harus berbeda dari titik pandang.');
  for (const [k, [min, max]] of Object.entries(ranges))
    if (!Number.isFinite(f[k]) || f[k] < min || f[k] > max)
      throw Error('Pengaturan kamera/cahaya tidak valid: ' + k);
  for (const k of ['keyColor', 'fillColor'])
    if (!/^#[0-9a-f]{6}$/i.test(f[k])) throw Error('Warna cahaya tidak valid.');
  if (
    typeof f.fisheye !== 'boolean' ||
    typeof f.shadows !== 'boolean' ||
    ![512, 1024, 2048].includes(f.shadowSize) ||
    !['soft', 'pcf', 'hard'].includes(f.shadowMode)
  )
    throw Error('Lensa/bayangan tidak valid.');
  return f;
}
export function validateMovie(s) {
  if (
    !s ||
    s.version !== 1 ||
    !Number.isFinite(s.duration) ||
    s.duration < 1 ||
    s.duration > 120 ||
    ![24, 30].includes(s.fps) ||
    !['1280x720', '1920x1080', '1080x1920', '1080x1080'].includes(s.size) ||
    !['linear', 'smooth', 'cut'].includes(s.interpolation) ||
    !Number.isFinite(s.time) ||
    s.time < 0 ||
    s.time > s.duration ||
    (s.animate !== undefined && typeof s.animate !== 'boolean') ||
    !Array.isArray(s.keys) ||
    s.keys.length > 64
  )
    throw Error('Timeline video tidak valid.');
  let previous = -1;
  for (const k of s.keys) {
    if (!Number.isFinite(k.time) || k.time < 0 || k.time > s.duration || k.time <= previous)
      throw Error('Waktu keyframe tidak valid / duplikat.');
    previous = k.time;
    validateMovieFrame(k.frame);
  }
  validateMovieFrame(s.view);
  return s;
}
const copy = (v) => JSON.parse(JSON.stringify(v));
export function setMovieKey(keys, time, frame) {
  validateMovieFrame(frame);
  if (!Number.isFinite(time) || time < 0 || time > 120) throw Error('Waktu keyframe tidak valid.');
  const next = keys.filter((k) => Math.abs(k.time - time) > 1e-5);
  if (next.length >= 64) throw Error('Maksimal 64 keyframe.');
  return [...next, { time, frame: copy(frame) }].sort((a, b) => a.time - b.time);
}
const mix = (a, b, u) => a + (b - a) * u;
const angle = (a, b, u) => a + (((b - a + 540) % 360) - 180) * u;
const color = (a, b, u) =>
  '#' +
  [1, 3, 5]
    .map((i) =>
      Math.round(mix(parseInt(a.slice(i, i + 2), 16), parseInt(b.slice(i, i + 2), 16), u))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('');
export function sampleMovie(keys, time, mode = 'smooth') {
  if (!keys.length) return null;
  if (!Number.isFinite(time)) throw Error('Waktu video tidak valid.');
  if (time <= keys[0].time) return copy(keys[0].frame);
  if (time >= keys.at(-1).time) return copy(keys.at(-1).frame);
  const i = keys.findIndex((k) => k.time > time),
    a = keys[i - 1],
    b = keys[i];
  let u = (time - a.time) / (b.time - a.time);
  if (mode === 'cut') return copy(a.frame);
  if (mode === 'smooth') u = u * u * (3 - 2 * u);
  const f = copy(a.frame);
  for (const k of Object.keys(ranges))
    f[k] = ['roll', 'shadowAngle'].includes(k)
      ? angle(a.frame[k], b.frame[k], u)
      : mix(a.frame[k], b.frame[k], u);
  f.roll = ((f.roll + 540) % 360) - 180;
  f.shadowAngle = ((f.shadowAngle % 360) + 360) % 360;
  for (const k of ['position', 'target']) f[k] = a.frame[k].map((n, j) => mix(n, b.frame[k][j], u));
  for (const k of ['keyColor', 'fillColor']) f[k] = color(a.frame[k], b.frame[k], u);
  // Discrete lens/filter choices change exactly at the next marker.
  return f;
}
