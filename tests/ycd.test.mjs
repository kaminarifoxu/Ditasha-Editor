import test from 'node:test';
import assert from 'node:assert/strict';
import { Group, Bone, AnimationMixer, LoopOnce } from 'three';
import { readYcd, ycdAnimationClip } from '../src/ycd.js';
import { boothYcdFixture } from './fixtures/booth-ycd.mjs';
import { captureBoothRest, applyBoothPose } from '../src/photo-booth-pose.js';
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
