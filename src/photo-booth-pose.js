import { Quaternion, Vector3 } from 'three';

export const BOOTH_POSES = [
  ['relaxed', 'Santai · tangan turun'],
  ['catalog', 'Pose katalog'],
  ['wave', 'Melambaikan tangan'],
  ['walk', 'Langkah berjalan'],
  ['dance', 'Dance ringan'],
  ['rest', 'Pose asli / T-pose'],
];
const axes = { x: new Vector3(1, 0, 0), y: new Vector3(0, 1, 0), z: new Vector3(0, 0, 1) };
export function boothBoneRole(name) {
  const n = name.toLowerCase().replace(/[^a-z0-9]/g, '');
  const side = /(skell|left|mixamorigleft)/.test(n)
    ? 'left'
    : /(skelr|right|mixamorigright)/.test(n)
      ? 'right'
      : '';
  if (/upperarm|leftarm|rightarm/.test(n) && !/forearm/.test(n)) return side + 'Arm';
  if (/forearm|lowerarm/.test(n)) return side + 'Forearm';
  if (/thigh|upleg/.test(n)) return side + 'Thigh';
  if (/calf|lowerleg|leftleg|rightleg/.test(n)) return side + 'Calf';
  if (/skelhead|^head$|mixamorighead/.test(n)) return 'head';
  if (/spine2|spine3|spine02/.test(n)) return 'chest';
  return '';
}
export function boothPoseAngles(pose, time = 0) {
  if (!BOOTH_POSES.some(([id]) => id === pose)) throw Error('Pose tidak dikenal.');
  if (!Number.isFinite(time)) throw Error('Waktu pose tidak valid.');
  if (pose === 'rest') return {};
  const angles = {
    leftArm: { z: -68 },
    rightArm: { z: 68 },
    leftForearm: { x: -6 },
    rightForearm: { x: -6 },
  };
  if (pose === 'catalog')
    Object.assign(angles, {
      chest: { y: -8 },
      head: { y: 12 },
      leftArm: { z: -48 },
      leftForearm: { x: -35 },
      rightThigh: { x: 8 },
    });
  if (pose === 'wave')
    Object.assign(angles, {
      rightArm: { z: -118 },
      rightForearm: { x: -30, z: Math.sin(time * 5) * 18 },
      head: { z: 5 },
    });
  if (pose === 'walk') {
    const s = Math.sin(time * Math.PI * 2);
    Object.assign(angles, {
      leftThigh: { x: s * 24 },
      rightThigh: { x: -s * 24 },
      leftCalf: { x: Math.max(0, -s) * 35 },
      rightCalf: { x: Math.max(0, s) * 35 },
      leftArm: { z: -68, x: -s * 15 },
      rightArm: { z: 68, x: s * 15 },
    });
  }
  if (pose === 'dance') {
    const s = Math.sin(time * 4);
    Object.assign(angles, {
      leftArm: { z: -40 + s * 15 },
      rightArm: { z: 40 + s * 15 },
      chest: { y: s * 12, z: s * 5 },
      head: { y: -s * 10 },
    });
  }
  return angles;
}
export function captureBoothRest(root) {
  const bones = [];
  root.updateMatrixWorld(true);
  root.traverse((o) => {
    if (o.isBone) bones.push({ bone: o, rest: o.quaternion.clone(), role: boothBoneRole(o.name) });
  });
  return bones;
}
export function applyBoothPose(bones, pose, time, worldBasis = new Quaternion()) {
  const angles = boothPoseAngles(pose, time);
  for (const { bone, rest } of bones) bone.quaternion.copy(rest);
  for (const { bone, role } of bones) {
    const rotations = angles[role];
    if (!rotations) continue;
    bone.parent?.updateWorldMatrix(true, false);
    const parentRotation = bone.parent
      ? bone.parent.getWorldQuaternion(new Quaternion()).invert()
      : new Quaternion();
    const forearmRole =
      role === 'leftArm' ? 'leftForearm' : role === 'rightArm' ? 'rightForearm' : '';
    let elbow;
    if (forearmRole)
      bone.traverse((child) => {
        if (!elbow && child !== bone && boothBoneRole(child.name) === forearmRole) elbow = child;
      });
    if (elbow) {
      bone.updateWorldMatrix(true, true);
      const direction = elbow
        .getWorldPosition(new Vector3())
        .sub(bone.getWorldPosition(new Vector3()))
        .normalize();
      const target = new Vector3(role === 'leftArm' ? 1 : -1, 0, 0).applyQuaternion(worldBasis);
      for (const [axis, angle] of Object.entries(rotations))
        target.applyAxisAngle(
          axes[axis].clone().applyQuaternion(worldBasis),
          (angle * Math.PI) / 180,
        );
      if (direction.lengthSq() > 1e-10) {
        const delta = new Quaternion().setFromUnitVectors(direction, target);
        delta.premultiply(parentRotation).multiply(parentRotation.clone().invert());
        bone.quaternion.premultiply(delta);
        bone.updateMatrix();
        continue;
      }
    }
    for (const [axis, angle] of Object.entries(rotations)) {
      const localAxis = axes[axis]
        .clone()
        .applyQuaternion(worldBasis)
        .applyQuaternion(parentRotation);
      bone.quaternion.premultiply(
        new Quaternion().setFromAxisAngle(localAxis, (angle * Math.PI) / 180),
      );
    }
    bone.updateMatrix();
  }
}
