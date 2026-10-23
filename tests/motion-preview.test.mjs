import test from 'node:test';
import assert from 'node:assert/strict';
import { createMotionClock, decodeMotion, sampleMotion } from '../src/motion-preview.js';
const encoded = (values) => {
  const bytes = new Uint8Array(values.length * 4);
  const view = new DataView(bytes.buffer);
  values.forEach((v, i) => view.setFloat32(i * 4, v, true));
  return Buffer.from(bytes).toString('base64');
};
const fixture = () => ({
  version: 1,
  floatCount: 3,
  fps: 4,
  frames: [encoded([0, 1, 2]), encoded([2, 3, 4]), encoded([4, 5, 6]), encoded([6, 7, 8])],
});
test('Motion decoding preserves GTA basis, interpolates frames and loops without mutating source frames', () => {
  const motion = decodeMotion(fixture(), 3),
    out = new Float32Array(3);
  assert.deepEqual([...motion.frames[0]], [0, 2, -1]);
  sampleMotion(motion, 0.125, out);
  assert.deepEqual([...out], [1, 3, -2]);
  sampleMotion(motion, 1.125, out);
  assert.deepEqual([...out], [1, 3, -2]);
  sampleMotion(motion, 0.875, out);
  assert.deepEqual([...out], [3, 5, -4]);
  assert.deepEqual([...motion.frames[0]], [0, 2, -1]);
});
test('Malformed, oversized, non-finite or mismatched motion buffers are rejected', () => {
  for (const overrides of [
    { floatCount: 6 },
    { fps: NaN },
    { fps: 120 },
    { frames: [] },
    { frames: ['@@@@', '@@@@', '@@@@', '@@@@'] },
    { frames: Array(4).fill(encoded([NaN, 0, 0])) },
    { frames: Array(17).fill(encoded([0, 0, 0])) },
  ])
    assert.throws(() => decodeMotion({ ...fixture(), ...overrides }, 3));
  assert.equal(decodeMotion(null, 3), null);
  assert.throws(() => sampleMotion(decodeMotion(fixture(), 3), 0, new Float32Array(6)));
});

test('Playback rate changes preserve the current pose and seeking resumes from the chosen time', () => {
  const clock = createMotionClock();
  clock.seek(0, 1000);
  assert.equal(clock.at(2000), 1);
  clock.setSpeed(0.5, 2000);
  assert.equal(clock.at(2000), 1);
  assert.equal(clock.at(4000), 2);
  clock.setSpeed(1.5, 4000);
  assert.equal(clock.at(4000), 2);
  assert.equal(clock.at(5000), 3.5);
  clock.seek(0.25, 6000);
  assert.equal(clock.at(6000), 0.25);
  assert.equal(clock.at(7000), 1.75);
  clock.seek(0, 8000);
  assert.equal(clock.at(8000), 0);
  for (const value of [NaN, Infinity, -1]) assert.throws(() => clock.seek(value, 8000));
  for (const value of [NaN, Infinity, 0, -1]) assert.throws(() => clock.setSpeed(value, 8000));
});
