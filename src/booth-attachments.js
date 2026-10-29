import { Group, Matrix4 } from 'three';

export function isRigidBoothProp(asset) {
  return asset.category === 'prop' || asset.grip === true;
}
export function findBoothAttachmentBone(roots, name) {
  const side = /(?:^SKEL_R_Hand$|rightHand$)/i.test(name)
    ? 'R'
    : /(?:^SKEL_L_Hand$|leftHand$)/i.test(name)
      ? 'L'
      : null;
  let target;
  for (const root of roots) {
    root?.traverse((o) => {
      if (target || !o.isBone) return;
      if (
        o.name === name ||
        (side &&
          (o.userData.tag === (side === 'R' ? 57005 : 18905) ||
            new RegExp((side === 'R' ? 'right' : 'left') + 'hand$', 'i').test(o.name)))
      )
        target = o;
    });
    if (target) break;
  }
  return target;
}
// Keep prop skeletons outside the actor's animation roots. The anchor follows the
// hand world matrix after animation, expressed in the actor frame exactly once.
export function createBoothGrip(root, bone, frame) {
  const anchor = new Group();
  anchor.name = 'Rigid prop grip';
  frame.add(anchor);
  anchor.add(root);
  root.position.set(0, 0, 0);
  root.quaternion.identity();
  root.scale.setScalar(1);
  const grip = { anchor, bone };
  updateBoothGrip(grip);
  return grip;
}
export function updateBoothGrip({ anchor, bone }) {
  bone.updateWorldMatrix(true, false);
  anchor.parent.updateWorldMatrix(true, false);
  new Matrix4()
    .copy(anchor.parent.matrixWorld)
    .invert()
    .multiply(bone.matrixWorld)
    .decompose(anchor.position, anchor.quaternion, anchor.scale);
  anchor.updateMatrixWorld(true);
}
