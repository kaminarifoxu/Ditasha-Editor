import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
export async function boothGlbFixture() {
  if (!globalThis.FileReader)
    globalThis.FileReader = class {
      async readAsArrayBuffer(blob) {
        this.result = await blob.arrayBuffer();
        this.onloadend?.();
      }
    };
  const scene = new THREE.Scene(),
    root = new THREE.Bone();
  root.name = 'SKEL_Root';
  scene.add(root);
  const chest = new THREE.Bone();
  chest.name = 'SKEL_Spine2';
  chest.position.y = 1.25;
  root.add(chest);
  const head = new THREE.Bone();
  head.name = 'SKEL_Head';
  head.position.y = 0.42;
  chest.add(head);
  const left = new THREE.Bone();
  left.name = 'SKEL_L_UpperArm';
  left.position.set(0.22, 0.16, 0);
  chest.add(left);
  const right = new THREE.Bone();
  right.name = 'SKEL_R_UpperArm';
  right.position.set(-0.22, 0.16, 0);
  chest.add(right);
  const leftLeg = new THREE.Bone();
  leftLeg.name = 'SKEL_L_Thigh';
  leftLeg.position.set(0.12, 0.9, 0);
  root.add(leftLeg);
  const rightLeg = new THREE.Bone();
  rightLeg.name = 'SKEL_R_Thigh';
  rightLeg.position.set(-0.12, 0.9, 0);
  root.add(rightLeg);
  const leftHand = new THREE.Bone(),
    rightHand = new THREE.Bone();
  leftHand.name = 'SKEL_L_Hand';
  rightHand.name = 'SKEL_R_Hand';
  leftHand.position.x = 0.45;
  rightHand.position.x = -0.45;
  left.add(leftHand);
  right.add(rightHand);
  scene.updateMatrixWorld(true);
  const bones = [root, chest, head, left, right, leftLeg, rightLeg, leftHand, rightHand],
    positions = [],
    normals = [],
    colors = [],
    indices = [],
    weights = [];
  for (const [bone, size, center, color] of [
    [0, [0.35, 0.2, 0.22], [0, 0.9, 0], 0x35415a],
    [1, [0.43, 0.52, 0.24], [0, 1.23, 0], 0xdfa95c],
    [2, [0.25, 0.29, 0.24], [0, 1.7, 0], 0xc1a181],
    [3, [0.5, 0.14, 0.16], [0.5, 1.41, 0], 0xdfa95c],
    [4, [0.5, 0.14, 0.16], [-0.5, 1.41, 0], 0xdfa95c],
    [5, [0.16, 0.76, 0.2], [0.12, 0.48, 0], 0x35415a],
    [6, [0.16, 0.76, 0.2], [-0.12, 0.48, 0], 0x35415a],
  ]) {
    const box = new THREE.BoxGeometry(...size).toNonIndexed();
    box.translate(...center);
    positions.push(...box.attributes.position.array);
    normals.push(...box.attributes.normal.array);
    const c = new THREE.Color(color);
    for (let i = 0; i < box.attributes.position.count; i++) {
      colors.push(c.r, c.g, c.b);
      indices.push(bone, 0, 0, 0);
      weights.push(1, 0, 0, 0);
    }
    box.dispose();
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(indices, 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(weights, 4));
  const mesh = new THREE.SkinnedMesh(
    geometry,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 }),
  );
  mesh.name = 'Booth QA mannequin';
  scene.add(mesh);
  mesh.bind(new THREE.Skeleton(bones));
  const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -0.8);
  const clip = new THREE.AnimationClip('Arm emote', 1, [
    new THREE.QuaternionKeyframeTrack(
      'SKEL_L_UpperArm.quaternion',
      [0, 0.5, 1],
      [0, 0, 0, 1, ...q.toArray(), 0, 0, 0, 1],
    ),
  ]);
  const result = await new GLTFExporter().parseAsync(scene, { binary: true, animations: [clip] });
  geometry.dispose();
  mesh.material.dispose();
  mesh.skeleton.dispose();
  return result;
}
export async function boothVehicleFixture() {
  const root = new THREE.Group();
  root.name = 'Synthetic studio vehicle';
  const paint = new THREE.MeshStandardMaterial({
      color: 0x356d96,
      metalness: 0.45,
      roughness: 0.3,
    }),
    tyre = new THREE.MeshStandardMaterial({ color: 0x202329, roughness: 1 }),
    glass = new THREE.MeshStandardMaterial({ color: 0x293b4b, roughness: 0.15 });
  const add = (g, m, x, y, z) => {
    const o = new THREE.Mesh(g, m);
    o.position.set(x, y, z);
    root.add(o);
    return o;
  };
  add(new THREE.BoxGeometry(1.8, 0.65, 3.8), paint, 0, 0.7, 0);
  add(new THREE.BoxGeometry(1.55, 0.7, 1.8), glass, 0, 1.3, 0.2);
  add(new THREE.BoxGeometry(1.65, 0.1, 1.9), paint, 0, 1.7, 0.2);
  for (const x of [-0.93, 0.93])
    for (const z of [-1.2, 1.2]) {
      const o = add(new THREE.CylinderGeometry(0.4, 0.4, 0.23, 24), tyre, x, 0.4, z);
      o.rotation.z = Math.PI / 2;
    }
  return new GLTFExporter().parseAsync(root, { binary: true });
}
