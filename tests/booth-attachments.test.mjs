import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {
  createBoothGrip,
  updateBoothGrip,
  findBoothAttachmentBone,
  isRigidBoothProp,
} from '../src/booth-attachments.js';
import { readYcd, ycdAnimationClip } from '../src/ycd.js';
import { boothYcdFixture } from './fixtures/booth-ycd.mjs';

test('Rigid prop follows native YCD hand world transform under translated, rotated and scaled actors without animating its own skeleton', () => {
  const frame = new T.Group(),
    ped = new T.Group(),
    root = new T.Bone(),
    arm = new T.Bone(),
    hand = new T.Bone();
  root.name = 'SKEL_Root';
  root.userData.tag = 0;
  arm.name = 'SKEL_L_UpperArm';
  arm.userData.tag = 1;
  hand.name = 'SKEL_R_Hand';
  hand.userData.tag = 57005;
  arm.position.set(0.2, 1.2, 0);
  hand.position.set(0.5, 0.15, 0.2);
  frame.add(ped);
  ped.add(root);
  root.add(arm);
  arm.add(hand);
  frame.position.set(3, 2, -4);
  frame.rotation.y = 1.2;
  frame.scale.setScalar(1.3);
  const prop = new T.Group(),
    weaponBone = new T.Bone();
  weaponBone.name = arm.name;
  weaponBone.userData.tag = arm.userData.tag;
  prop.add(weaponBone);
  prop.position.set(50, 50, 50);
  const grip = createBoothGrip(prop, hand, frame);
  assert.equal(findBoothAttachmentBone([ped], 'SKEL_R_Hand'), hand);
  assert(!ped.getObjectById(weaponBone.id), 'Prop rig must not enter the ped mixer subtree');
  const clip = ycdAnimationClip(readYcd(boothYcdFixture()).clips[0], ped);
  const mixer = new T.AnimationMixer(ped);
  mixer.clipAction(clip).play();
  const points = [];
  for (const time of [0, 0.25, 0.75]) {
    mixer.setTime(time);
    frame.updateMatrixWorld(true);
    updateBoothGrip(grip);
    const expected = hand.getWorldPosition(new T.Vector3()),
      actual = prop.getWorldPosition(new T.Vector3());
    assert(actual.distanceTo(expected) < 1e-8);
    assert(
      prop
        .getWorldQuaternion(new T.Quaternion())
        .angleTo(hand.getWorldQuaternion(new T.Quaternion())) < 1e-6,
    );
    assert.deepEqual(weaponBone.position.toArray(), [0, 0, 0]);
    points.push(actual);
  }
  assert(points[0].distanceTo(points[2]) > 0.01, 'Fixture must move the hand');
  frame.rotation.y = -1;
  frame.position.x = -5;
  frame.scale.setScalar(0.7);
  updateBoothGrip(grip);
  assert(
    prop.getWorldPosition(new T.Vector3()).distanceTo(hand.getWorldPosition(new T.Vector3())) <
      1e-8,
  );
});

test('Hand lookup accepts GTA bone tags and Mixamo names and reports absent hands', () => {
  const root = new T.Group(),
    hand = new T.Bone();
  root.add(hand);
  hand.name = 'unknown_57005';
  hand.userData.tag = 57005;
  assert.equal(findBoothAttachmentBone([root], 'SKEL_R_Hand'), hand);
  assert.equal(findBoothAttachmentBone([root], 'SKEL_L_Hand'), undefined);
  hand.userData.tag = undefined;
  hand.name = 'mixamorigLeftHand';
  assert.equal(findBoothAttachmentBone([root], 'SKEL_L_Hand'), hand);
  assert(isRigidBoothProp({ category: 'prop' }));
  assert(isRigidBoothProp({ category: 'other', grip: true }));
  assert(!isRigidBoothProp({ category: 'tops' }));
});
