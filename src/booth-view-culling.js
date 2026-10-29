import { Frustum, Matrix4 } from 'three';
// Three performs per-camera frustum rejection, including a separate shadow pass.
// Do not set visible=false: offscreen casters may still cast visible shadows.
export function createBoothViewCulling() {
  const frustum = new Frustum(),
    matrix = new Matrix4();
  return (root, camera, enabled = true) => {
    let visible = 0,
      total = 0;
    if (!root) return { visible, total };
    camera.updateMatrixWorld();
    root.updateWorldMatrix(true, true);
    frustum.setFromProjectionMatrix(
      matrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse),
    );
    root.traverseVisible((o) => {
      if (!o.isMesh || o.isSkinnedMesh) return;
      o.frustumCulled = enabled;
      total++;
      if (!enabled || frustum.intersectsObject(o)) visible++;
    });
    return { visible, total };
  };
}
