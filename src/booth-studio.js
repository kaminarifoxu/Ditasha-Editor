import * as THREE from 'three';
export const BOOTH_STUDIOS = [
  ['catalogue', 'Studio Katalog · warm'],
  ['loft', 'Editorial Loft · daylight'],
  ['neon', 'Neon Gallery · midnight'],
  ['plain', 'Polos / grid'],
];
// Original offline geometry, no game assets or remote studio downloads.
export function createBoothStudio(id) {
  if (!BOOTH_STUDIOS.some(([key]) => key === id)) throw Error('Studio tidak dikenal.');
  const root = new THREE.Group();
  root.name = 'DITASHA studio ' + id;
  if (id === 'plain') return root;
  const material = (color, extra = {}) =>
    new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...extra });
  const light = (color) => material(color, { emissive: color, emissiveIntensity: 1.5 });
  const mesh = (geometry, mat, x = 0, y = 0, z = 0) => {
    const m = new THREE.Mesh(geometry, mat);
    m.position.set(x, y, z);
    m.receiveShadow = true;
    root.add(m);
    return m;
  };
  const box = (w, h, d, mat, x, y, z) => mesh(new THREE.BoxGeometry(w, h, d), mat, x, y, z);
  const cylinder = (radius, height, mat, x, y, z) =>
    mesh(new THREE.CylinderGeometry(radius, radius, height, 32), mat, x, y, z);
  const palette =
    id === 'neon'
      ? { wall: 0x151b31, floor: 0x171d2b, accent: 0x8a77ff }
      : id === 'loft'
        ? { wall: 0xddd7ce, floor: 0x856b54, accent: 0x637a69 }
        : { wall: 0xd9cdbd, floor: 0xc8b8a1, accent: 0x9c7354 };
  const wall = material(palette.wall, { side: THREE.DoubleSide }),
    accent = material(palette.accent),
    metal = material(0x292e38, { metalness: 0.5, roughness: 0.3 });
  // Continuous curved cyclorama: floor, quarter-circle sweep, tall rear wall.
  const path = [
    [-25, -0.035],
    [3, -0.035],
  ];
  for (let i = 1; i <= 32; i++) {
    const t = ((i / 32) * Math.PI) / 2;
    path.push([3 + 2 * Math.sin(t), 2 - 2 * Math.cos(t) - 0.035]);
  }
  path.push([5, 12]);
  const positions = [],
    indices = [];
  for (const [z, y] of path) positions.push(-30, y, z, 30, y, z);
  for (let i = 0; i < path.length - 1; i++) {
    const n = i * 2;
    indices.push(n, n + 2, n + 1, n + 1, n + 2, n + 3);
  }
  const sweep = new THREE.BufferGeometry();
  sweep.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  sweep.setIndex(indices);
  sweep.computeVertexNormals();
  mesh(sweep, wall);
  if (id === 'loft') {
    const wood = material(palette.floor),
      trim = material(0x353a3e),
      daylight = light(0xcde8f5);
    box(60, 0.035, 35, wood, 0, -0.025, -12.5);
    const seam = material(0x5f4e40);
    for (let i = -28; i <= 28; i++) box(0.012, 0.004, 34, seam, i, -0.004, -12);
    box(3.7, 3.8, 0.08, trim, -1.3, 2.6, 4.65);
    box(3.5, 3.6, 0.09, daylight, -1.3, 2.6, 4.57);
    for (let i = -1; i <= 1; i++) box(0.055, 3.6, 0.12, trim, -1.3 + i * 1.15, 2.6, 4.48);
    for (let i = 0; i <= 2; i++) box(3.5, 0.055, 0.12, trim, -1.3, 0.85 + i * 1.7, 4.48);
    box(2.0, 0.15, 0.7, accent, 2.0, 0.65, 2.3);
    for (const x of [1.2, 2.8]) box(0.07, 0.6, 0.45, metal, x, 0.28, 2.3);
    const pot = material(0xa58066),
      leaves = material(0x3d644b);
    cylinder(0.25, 0.5, pot, 2.3, 0.25, 3.3);
    for (let i = 0; i < 11; i++) {
      const a = i * 2.4,
        r = 0.15 + (i % 3) * 0.12;
      const leaf = mesh(
        new THREE.SphereGeometry(0.25, 12, 8),
        leaves,
        2.3 + Math.cos(a) * r,
        0.8 + (i % 4) * 0.2,
        3.3 + Math.sin(a) * r,
      );
      leaf.scale.set(0.6, 2, 0.6);
      leaf.rotation.z = Math.sin(a) * 0.5;
    }
  } else if (id === 'neon') {
    const cyan = light(0x35d9eb),
      violet = light(0xa565fa);
    for (const [x, mat] of [
      [-2.6, cyan],
      [2.6, violet],
    ]) {
      box(0.045, 3.4, 0.07, mat, x, 1.85, 3.8);
      box(0.35, 0.08, 0.3, metal, x, 0.02, 3.8);
    }
    const ring = mesh(new THREE.TorusGeometry(1.45, 0.025, 12, 96), violet, 0, 2.1, 4.7);
    ring.scale.y = 1.12;
    box(4, 0.04, 0.1, cyan, 0, 0.08, 3.7);
    const stageMat = material(0x262d42, { metalness: 0.4, roughness: 0.3 });
    cylinder(1.5, 0.025, stageMat, 0, -0.0125, 0);
    for (let x = -3; x <= 3; x += 0.5) box(0.012, 5, 0.02, accent, x, 2.5, 4.9);
  } else {
    const ivory = material(0xe8ded0),
      fabric = material(0xc4a687),
      glow = light(0xffe7bc);
    // Architectural panels and warm strip lighting behind the subjects.
    for (const x of [-2.4, 2.4]) {
      box(1.15, 3.8, 0.14, fabric, x, 1.9, 4.5);
      box(0.035, 3.5, 0.18, glow, x - 0.59, 1.85, 4.4);
    }
    box(1.4, 0.04, 0.8, ivory, -2.1, 0.32, 2.5);
    for (const x of [-2.65, -1.55]) box(0.05, 0.3, 0.6, metal, x, 0.15, 2.5);
  }
  // Visible softboxes on stands make the scene a photo studio, with no UI-only assets.
  for (const side of [-1, 1]) {
    const x = side * 3.5,
      z = 1.2;
    cylinder(0.025, 2.5, metal, x, 1.25, z);
    for (let j = 0; j < 3; j++) {
      const foot = box(0.7, 0.025, 0.04, metal, x, 0.02, z);
      foot.rotation.y = (j * Math.PI) / 3;
    }
    const lamp = box(0.75, 1.1, 0.12, metal, x, 2.6, z);
    lamp.rotation.y = -side * 0.45;
    const face = box(
      0.68,
      1.03,
      0.035,
      light(id === 'neon' ? (side < 0 ? 0x76e4ed : 0xcaa5ff) : 0xfff4e3),
      x,
      2.6,
      z - 0.09,
    );
    face.rotation.y = lamp.rotation.y;
  }
  return root;
}
export function disposeBoothStudio(root) {
  const geometries = new Set(),
    materials = new Set();
  root?.traverse((o) => {
    if (o.isMesh) {
      geometries.add(o.geometry);
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) materials.add(m);
    }
  });
  geometries.forEach((g) => g.dispose());
  materials.forEach((m) => m.dispose());
  root?.removeFromParent();
}
