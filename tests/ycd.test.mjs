import test from 'node:test';
import assert from 'node:assert/strict';
import { Group, Bone, AnimationMixer, LoopOnce } from 'three';
import { readYcd, ycdAnimationClip } from '../src/ycd.js';
import { boothYcdFixture } from './fixtures/booth-ycd.mjs';
import { captureBoothRest, applyBoothPose } from '../src/photo-booth-pose.js';
import { inflateRaw } from 'pako';
test('headerless YCD system pages decode without changing source bytes', () => {
  const packed = new Uint8Array(boothYcdFixture());
  const raw = inflateRaw(packed.subarray(16));
  new DataView(raw.buffer).setUint32(4, 1, true);
  const original = raw.slice();
  const source = readYcd(raw.buffer);
  const wrapped = readYcd(packed.buffer);
  assert.equal(source.clips[0].name, wrapped.clips[0].name);
  const { g } = rig();
  assert(ycdAnimationClip(source.clips[0], g).tracks.length > 0);
  assert.deepEqual(raw, original);
  const invalid = raw.slice();
  new DataView(invalid.buffer).setBigUint64(40, 0x50000000n + BigInt(raw.length), true);
  assert.throws(() => readYcd(invalid.buffer), /header bukan RSC7/);
  assert.throws(() => readYcd(new Uint8Array(8192).buffer), /header bukan RSC7/);
});
function rig() {
  const g = new Group(),
    root = new Bone(),
    arm = new Bone();
  root.userData.tag = 0;
  arm.userData.tag = 1;
  root.name = 'SKEL_Root';
  arm.name = 'SKEL_L_UpperArm';
  g.add(root);
  root.add(arm);
  return { g, root, arm };
}
for (const encoding of ['static', 'raw', 'quantized', 'indirect', 'linear'])
  test('YCD decoder: ' + encoding + ' channels produce finite tagged bone tracks', () => {
    const source = boothYcdFixture({ encoding }),
      original = new Uint8Array(source).slice();
    const decoded = readYcd(source),
      { g, arm } = rig(),
      clip = ycdAnimationClip(decoded.clips[0], g);
    assert.deepEqual(new Uint8Array(source), original);
    assert.equal(decoded.clips[0].name, 'synthetic_emote');
    assert.equal(clip.tracks.length, 2);
    assert(clip.tracks.every((t) => t.values.every(Number.isFinite)));
    const mixer = new AnimationMixer(g);
    mixer.clipAction(clip).setLoop(LoopOnce, 1).play();
    mixer.setTime(0.999);
    assert(Math.abs(arm.quaternion.length() - 1) < 1e-6);
    assert(Math.abs(encoding === 'static' ? arm.quaternion.y : arm.quaternion.x) > 0.49);
  });
test('YCD cached quaternion 2 and multisequence clips retain frames across blocks', () => {
  const { g } = rig(),
    d = readYcd(boothYcdFixture({ encoding: 'cached', cached: 8, segments: 2 }));
  const clip = ycdAnimationClip(d.clips[0], g);
  assert.equal(clip.duration, 2);
  assert(clip.tracks[1].values.every(Number.isFinite));
});
test('YCD unmatched skeleton stays unbound; malformed resource/version are rejected', () => {
  const b = boothYcdFixture(),
    d = readYcd(b);
  assert.equal(ycdAnimationClip(d.clips[0], new Group()).tracks.length, 0);
  assert.throws(() => readYcd(b.slice(0, 20)));
  const wrong = b.slice(0);
  new DataView(wrong).setUint32(4, 99, true);
  assert.throws(() => readYcd(wrong), /Versi/);
});
test('Leaving imported emote restores bone position, scale and rotation', () => {
  const { g, arm } = rig(),
    rest = captureBoothRest(g);
  arm.position.set(2, 3, 4);
  arm.scale.setScalar(2);
  arm.rotation.x = 0.5;
  applyBoothPose(rest, 'rest', 0);
  assert.deepEqual(arm.position.toArray(), [0, 0, 0]);
  assert.deepEqual(arm.scale.toArray(), [1, 1, 1]);
  assert.equal(arm.quaternion.x, 0);
});

// Mutate synthetic resource records, never uploaded emotes.
async function edited(edit) {
  const { inflateRaw, deflateRaw } = await import('pako');
  const input = new Uint8Array(boothYcdFixture());
  const data = inflateRaw(input.subarray(16)),
    view = new DataView(data.buffer);
  const ptr = (at, value) => view.setBigUint64(at, BigInt(0x50000000 + value), true);
  edit(view, data, ptr);
  const compressed = deflateRaw(data),
    out = new Uint8Array(16 + compressed.length);
  out.set(input.subarray(0, 16));
  out.set(compressed, 16);
  return out.buffer;
}
test('YCD isolates an invalid time window without discarding a valid sibling clip', async () => {
  const b = await edited((v, data, ptr) => {
    data.copyWithin(2080, 192, 304);
    ptr(176, 2048);
    ptr(2056, 2080);
    ptr(2104, 2250);
    data.set(new TextEncoder().encode('valid_sibling\0'), 2250);
    v.setFloat32(280, 2, true);
    v.setFloat32(284, 1, true);
  });
  const d = readYcd(b);
  assert.equal(d.clips.length, 1);
  assert.equal(d.clips[0].name, 'valid_sibling');
  assert.match(d.warnings[0], /rentang waktu/);
});
test('YCD accepts held poses, zero-rate clips and single-frame animations', async () => {
  for (const mode of ['held', 'zero-rate', 'one-frame']) {
    const b = await edited((v) => {
      if (mode === 'held') v.setFloat32(284, 0, true);
      if (mode === 'zero-rate') v.setFloat32(288, 0, true);
      if (mode === 'one-frame') {
        v.setUint16(372, 1, true);
        v.setFloat32(376, 0, true);
      }
    });
    const d = readYcd(b),
      { g } = rig(),
      c = ycdAnimationClip(d.clips[0], g);
    assert(c.duration > 0);
    assert(c.tracks.every((t) => t.values.every(Number.isFinite)));
    assert.equal(c.tracks[1].times.length, 2);
  }
});
test('YCD extended native windows wrap source frames instead of freezing the last frame', async () => {
  const b = await edited((v) => v.setFloat32(284, 3, true));
  const d = readYcd(b),
    { g, arm } = rig(),
    c = ycdAnimationClip(d.clips[0], g);
  assert.equal(c.duration, 3);
  const mixer = new AnimationMixer(g);
  mixer.clipAction(c).play();
  mixer.setTime(2.25);
  assert(arm.quaternion.x > 0.05 && arm.quaternion.x < 0.3);
});
test('Single-source animation lists play skeletal tracks with their own duration', async () => {
  const b = await edited((v, _data, ptr) => {
    v.setUint32(208, 2, true);
    ptr(272, 2048);
    v.setUint16(280, 1, true);
    v.setUint16(282, 1, true);
    v.setFloat32(288, 2, true);
    v.setFloat32(2048, 0, true);
    v.setFloat32(2052, 1, true);
    v.setFloat32(2056, 1, true);
    ptr(2064, 352);
  });
  const d = readYcd(b),
    { g } = rig(),
    c = ycdAnimationClip(d.clips[0], g);
  assert.equal(c.duration, 2);
  assert.equal(c.tracks.length, 2);
  assert.equal(d.warnings.length, 0);
});
test('Unsupported lists have bounded summaries and expose details separately', async () => {
  const b = await edited((v, _data, ptr) => {
    v.setUint32(208, 2, true);
    ptr(272, 2048);
    v.setUint16(280, 2, true);
  });
  assert.throws(
    () => readYcd(b),
    (e) => e.message.length < 120 && e.details.length === 1 && /blend/.test(e.details[0]),
  );
  const wrong = boothYcdFixture();
  new DataView(wrong).setUint32(0, 0, true);
  assert.throws(() => readYcd(wrong), /header bukan RSC7 Legacy/);
});

test('YCD header diagnostics distinguish archives, Enhanced, escrow, truncated and unknown signatures', () => {
  const input = (signature) => {
    const bytes = new Uint8Array(32);
    bytes.set(new TextEncoder().encode(signature));
    return bytes.buffer;
  };
  assert.throws(() => readYcd(input('FXAP')), /Asset Escrow/);
  assert.throws(() => readYcd(input('RSC8')), /RSC8/);
  assert.throws(() => readYcd(input('PK\u0003\u0004')), /arsip/);
  assert.throws(() => readYcd(input('????')), /signature 3f 3f 3f 3f/);
  assert.throws(() => readYcd(new ArrayBuffer(4)), /terpotong/);
});
