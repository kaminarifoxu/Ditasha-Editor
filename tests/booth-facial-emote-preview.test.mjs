import test from 'node:test';
import assert from 'node:assert/strict';
import { Bone, Quaternion } from 'three';
import { emotePreviewKind, canPreviewFacialEmote, applyFacialEmotePreview } from '../src/booth-facial-emote-preview.js';

function sampleBones() {
  return ['head', 'chest'].map(role => {
    const bone = new Bone();
    bone.name = role;
    return { bone, role, rest: bone.quaternion.clone() };
  });
}
test('facial cough label is recognized but unrelated expressions are not spoofed', () => {
  assert.equal(emotePreviewKind('facials@gen_male@base.ycd / coughing_1.clip'), 'cough');
  assert.equal(emotePreviewKind('facials@gen_male@base.ycd / blinking_2.clip'), null);
});
test('facial-only YCD cough preview visibly moves a skeleton when bone tags do not match', () => {
  const bones=sampleBones(), label='facials@gen_male@base.ycd / coughing_1.clip';
  assert.equal(canPreviewFacialEmote(bones,label),true);
  assert.equal(applyFacialEmotePreview(bones,label,0.1),true);
  const moved=bones[0].bone.quaternion.clone();
  assert.ok(moved.angleTo(new Quaternion())>0.001);
  applyFacialEmotePreview(bones,label,0);
  assert.ok(bones[0].bone.quaternion.angleTo(new Quaternion())<1e-6);
  assert.equal(applyFacialEmotePreview(bones,'unrelated_clip',0.1),false);
});
test('unsupported facial clips and meshes without head/chest remain unavailable', () => {
  const bones=sampleBones();
  assert.equal(canPreviewFacialEmote(bones,'smile_1.clip'),false);
  assert.equal(canPreviewFacialEmote([{...bones[0],role:'leftArm'}],'coughing_1.clip'),false);
});
