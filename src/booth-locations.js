import * as THREE from 'three';
export const LOCATION_STUDIOS = [
  ['hood', 'Hood · urban block'],
  ['living', 'Ruang tamu'],
  ['office', 'Kantor'],
  ['police', 'Kantor polisi'],
  ['beach', 'Pantai'],
  ['bedroom', 'Ruang tidur'],
  ['bathroom', 'Kamar mandi'],
];
// Original stylised sets made from local geometry; no remote/game assets.
export function createBoothLocation(id) {
  const root = new THREE.Group();
  root.name = 'DITASHA location ' + id;
  const mat = (color, extra = {}) =>
    new THREE.MeshStandardMaterial({ color, roughness: 0.9, ...extra });
  const mesh = (g, m, x = 0, y = 0, z = 0) => {
    const o = new THREE.Mesh(g, m);
    o.position.set(x, y, z);
    o.receiveShadow = true;
    o.castShadow = true;
    root.add(o);
    return o;
  };
  const box = (w, h, d, m, x, y, z) => mesh(new THREE.BoxGeometry(w, h, d), m, x, y, z);
  const cyl = (r, h, m, x, y, z) => mesh(new THREE.CylinderGeometry(r, r, h, 20), m, x, y, z);
  const ball = (r, m, x, y, z) => mesh(new THREE.SphereGeometry(r, 16, 12), m, x, y, z);
  const wood = mat(0x8b674c),
    dark = mat(0x2c3440),
    white = mat(0xe8e4dc),
    green = mat(0x3e6950),
    blue = mat(0x344f6f),
    metal = mat(0x7b8991, { metalness: 0.5, roughness: 0.4 });
  const sign = (text, x, y, z, w = 2, h = 0.5, color = '#e9eef5', bg = '#22354d') => {
    if (!globalThis.document) return;
    const c = document.createElement('canvas');
    c.width = 1024;
    c.height = 256;
    const ctx = c.getContext('2d');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 1024, 256);
    ctx.fillStyle = color;
    ctx.font = 'bold 88px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 512, 128, 950);
    const texture = new THREE.CanvasTexture(c);
    texture.colorSpace = THREE.SRGBColorSpace;
    const o = mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide }),
      x,
      y,
      z,
    );
    o.rotation.y = Math.PI;
    o.castShadow = false;
  };
  const plant = (x, z, height = 1.5) => {
    cyl(0.25, 0.5, mat(0x98705a), x, 0.25, z);
    for (let i = 0; i < 8; i++) {
      const a = i * 2.4;
      const o = ball(
        0.25,
        green,
        x + Math.cos(a) * 0.25,
        0.65 + ((i % 4) * height) / 5,
        z + Math.sin(a) * 0.25,
      );
      o.scale.set(0.6, 1.8, 0.6);
      o.rotation.z = Math.sin(a) * 0.5;
    }
  };
  const window = (x, y, z, w = 2, h = 2) => {
    const glow = mat(0xb7dbea, { emissive: 0x9ec7db, emissiveIntensity: 0.5 });
    box(w + 0.12, h + 0.12, 0.1, dark, x, y, z);
    box(w, h, 0.12, glow, x, y, z - 0.07);
    box(0.05, h, 0.15, white, x, y, z - 0.15);
    box(w, 0.05, 0.15, white, x, y, z - 0.15);
  };
  const chair = (x, z) => {
    box(0.6, 0.12, 0.6, dark, x, 0.55, z);
    box(0.6, 0.65, 0.1, blue, x, 0.9, z + 0.25);
    for (const dx of [-0.22, 0.22])
      for (const dz of [-0.22, 0.22]) box(0.04, 0.5, 0.04, metal, x + dx, 0.25, z + dz);
  };
  const desk = (x, z) => {
    box(2, 0.1, 0.85, wood, x, 0.8, z);
    for (const dx of [-0.85, 0.85]) box(0.07, 0.8, 0.7, dark, x + dx, 0.4, z);
    box(0.85, 0.48, 0.06, dark, x, 1.15, z + 0.13);
    box(
      0.73,
      0.36,
      0.07,
      mat(0x446c85, { emissive: 0x31516a, emissiveIntensity: 0.4 }),
      x,
      1.15,
      z + 0.09,
    );
    box(0.1, 0.2, 0.1, metal, x, 0.91, z + 0.13);
    box(0.7, 0.03, 0.22, dark, x, 0.87, z - 0.22);
    chair(x, z - 0.8);
  };
  if (id === 'beach') {
    const sand = mat(0xdcc28c),
      water = mat(0x339bb6, { roughness: 0.35, metalness: 0.15 }),
      sky = mat(0x9fd3ee, { emissive: 0x9fd3ee, emissiveIntensity: 0.25 });
    box(90, 0.08, 70, sand, 0, -0.06, 0);
    box(90, 0.04, 30, water, 0, -0.01, 20);
    box(100, 30, 0.1, sky, 0, 13, 38);
    const foam = mat(0xe3f0e9);
    for (let i = 0; i < 8; i++) box(70, 0.005, 0.08, foam, 0, 0.017, 5 + i * 0.3);
    ball(1.5, mat(0xffe3a2, { emissive: 0xffdc8a, emissiveIntensity: 1 }), -8, 8, 30);
    for (const x of [-5, 5]) {
      const trunk = cyl(0.14, 4.5, wood, x, 2.25, 3.8);
      trunk.rotation.z = x < 0 ? 0.1 : -0.1;
      for (let i = 0; i < 7; i++) {
        const leaf = ball(0.6, green, x, 4.35, 3.8);
        leaf.scale.set(3, 0.1, 0.5);
        leaf.rotation.y = (i * Math.PI) / 3.5;
        leaf.rotation.z = 0.2;
      }
    }
    const pole = cyl(0.035, 2.6, white, -3, 1.3, 2);
    const umbrella = mesh(new THREE.ConeGeometry(1.3, 0.65, 16), mat(0xd68b66), -3, 2.7, 2);
    umbrella.rotation.y = 0.3;
    box(1.3, 0.05, 2, mat(0xf4e7cf), -3, 0.025, 0.8);
    return root;
  }
  if (id === 'hood') {
    box(70, 0.08, 60, mat(0x4b4e53), 0, -0.06, 0);
    const concrete = mat(0xa6a29a),
      brick = mat(0x7e5449),
      yellow = mat(0xe5bb54);
    for (const x of [-6, 6]) {
      box(7, 6, 3, brick, x, 3, 8);
      box(7.3, 0.25, 3.3, concrete, x, 6, 8);
      for (let y = 0.5; y < 6; y += 0.35) box(7, 0.018, 0.02, mat(0x5e443e), x, y, 6.48);
      for (const dx of [-2, 0, 2]) for (const y of [2, 4.3]) window(x + dx, y, 6.42, 1.2, 1.5);
      box(8, 0.15, 3, concrete, x, -0.015, 4);
    }
    for (let z = -15; z < 15; z += 3) box(0.07, 0.008, 1.4, yellow, 0, 0.004, z);
    cyl(0.14, 4, dark, -4.5, 2, 2);
    box(1, 0.07, 0.3, metal, -4.1, 4, 2);
    ball(0.13, mat(0xffd895, { emissive: 0xffce74 }), -3.7, 3.9, 2);
    cyl(0.35, 0.9, green, 4, 0.45, 2.4);
    cyl(0.38, 0.08, dark, 4, 0.94, 2.4);
    box(1.1, 0.7, 0.07, white, -4.7, 2.6, 3.8);
    const hoop = mesh(new THREE.TorusGeometry(0.23, 0.025, 8, 24), mat(0xe47949), -4.7, 2.3, 3.5);
    hoop.rotation.x = Math.PI / 2;
    sign('THE BLOCK', -4.6, 1.3, 6.36, 2.7, 0.7, '#e0bf79', '#503f46');
    return root;
  }
  const palette =
    id === 'police'
      ? 0x9aabba
      : id === 'bathroom'
        ? 0xb7c9ca
        : id === 'bedroom'
          ? 0xc1b3ae
          : 0xd7d1c7;
  const floor = id === 'bathroom' ? mat(0xe3e6e2) : wood;
  box(30, 0.08, 30, floor, 0, -0.06, 0);
  box(16, 5, 0.15, mat(palette), 0, 2.5, 5.5);
  box(0.15, 5, 14, mat(palette), -8, 2.5, -1.5);
  box(0.15, 5, 14, mat(palette), 8, 2.5, -1.5);
  if (id === 'bathroom') {
    const grout = mat(0x8d9fa1);
    for (let x = -8; x <= 8; x += 0.5) box(0.012, 4.5, 0.015, grout, x, 2.25, 5.41);
    for (let y = 0.5; y < 4.6; y += 0.5) box(16, 0.012, 0.015, grout, 0, y, 5.41);
    box(2.5, 0.65, 1.3, white, -3, 0.35, 3.2);
    box(2.25, 0.05, 1.1, mat(0xaed1d4), -3, 0.69, 3.2);
    for (const x of [-4.2, -1.8]) box(0.15, 0.2, 1.3, white, x, 0.75, 3.2);
    box(1.9, 0.8, 0.7, wood, 3, 0.4, 4.2);
    box(2, 0.08, 0.8, white, 3, 0.85, 4.2);
    ball(0.28, white, 3, 0.91, 4.1).scale.set(1, 0.2, 0.8);
    box(1.5, 1.3, 0.05, metal, 3, 1.8, 5.34);
    cyl(0.025, 0.35, metal, 3, 1.02, 4.45);
    cyl(0.25, 0.45, white, -5, 0.23, 1.8);
    ball(0.32, white, -5, 0.48, 1.7).scale.set(1, 0.3, 1.3);
    box(0.5, 0.7, 0.2, white, -5, 0.7, 2.1);
    sign('STUDIO BATH', 0, 3.2, 5.37, 2.5, 0.45, '#47666b', '#e0e7e3');
  } else if (id === 'bedroom') {
    box(2.6, 0.4, 3.2, dark, -2.5, 0.2, 3);
    box(2.5, 0.28, 3.1, white, -2.5, 0.53, 3);
    box(2.55, 0.1, 2, mat(0x718997), -2.5, 0.72, 2.55);
    box(2.7, 1.25, 0.13, wood, -2.5, 0.8, 4.65);
    for (const x of [-3.1, -1.9]) box(1, 0.18, 0.65, mat(0xe6ddd1), x, 0.8, 4.05);
    box(0.7, 0.75, 0.7, wood, -4.3, 0.38, 3.8);
    cyl(0.04, 0.5, metal, -4.3, 1.0, 3.8);
    mesh(new THREE.ConeGeometry(0.28, 0.4, 16), white, -4.3, 1.45, 3.8);
    box(2, 2.8, 0.9, mat(0x70665e), 4, 1.4, 4.8);
    box(0.02, 2.7, 0.05, metal, 4, 1.4, 4.32);
    window(1.3, 2.2, 5.35, 2, 2.2);
    plant(3, 1.7);
  } else if (id === 'living') {
    const fabric = mat(0x73827b);
    box(3.4, 0.45, 1.1, fabric, 0, 0.42, 3.8);
    box(3.4, 0.75, 0.25, fabric, 0, 1, 4.22);
    for (const x of [-1.8, 1.8]) box(0.3, 0.7, 1.1, fabric, x, 0.7, 3.8);
    for (const x of [-0.85, 0.85]) box(1.5, 0.16, 0.9, mat(0x8b9a8e), x, 0.73, 3.65);
    box(5, 0.015, 3, mat(0xb39c80), 0, 0.008, 2.2);
    box(1.7, 0.09, 0.8, wood, 0, 0.45, 2.2);
    for (const x of [-0.65, 0.65]) box(0.05, 0.4, 0.6, dark, x, 0.2, 2.2);
    window(-4.2, 2.3, 5.35, 2.2, 2.5);
    plant(3.3, 4, 2);
    box(1.2, 1.3, 0.45, wood, 4.5, 0.65, 4.8);
    cyl(0.035, 2.3, metal, -3.1, 1.15, 3);
    mesh(new THREE.ConeGeometry(0.5, 0.6, 16), mat(0xd6c6a1), -3.1, 2.35, 3);
    sign('HOME / STUDIO', 0, 2.65, 5.36, 2.6, 0.5, '#e8dfcf', '#66756b');
  } else {
    for (const x of [-3.4, 3.4]) desk(x, 3.5);
    window(-4.5, 2.7, 5.35, 2.3, 1.7);
    window(4.5, 2.7, 5.35, 2.3, 1.7);
    if (id === 'police') {
      box(16, 0.35, 0.05, blue, 0, 1.6, 5.37);
      sign('POLICE / BRIEFING', 0, 3.25, 5.35, 3.8, 0.65, '#f2d388', '#263e59');
      const badge = mesh(
        new THREE.CylinderGeometry(0.48, 0.48, 0.08, 6),
        mat(0xc8a45e, { metalness: 0.5, roughness: 0.4 }),
        0,
        2.3,
        5.3,
      );
      badge.rotation.x = Math.PI / 2;
      box(2, 1.2, 0.08, dark, 0, 1.1, 5.25);
      box(1.85, 1.05, 0.09, mat(0xd1d5c9), 0, 1.1, 5.18);
      for (let i = 0; i < 3; i++)
        box(0.45, 0.25, 0.02, mat([0x6f8994, 0xbaab87, 0x9b7171][i]), -0.55 + i * 0.55, 1.1, 5.12);
    } else {
      box(2.3, 2.4, 0.4, wood, 0, 1.2, 5.2);
      for (let y = 0.5; y < 2.4; y += 0.55) box(2.3, 0.06, 0.5, dark, 0, y, 5.15);
      for (let i = 0; i < 12; i++)
        box(
          0.12,
          0.35,
          0.28,
          mat([0x526e82, 0x8c6c61, 0x869179][i % 3]),
          -1 + i * 0.18,
          0.75 + (i % 3) * 0.55,
          5.0,
        );
      sign('CREATIVE OFFICE', 0, 3.2, 5.35, 3.2, 0.55);
      plant(-6, 2.8);
      plant(6, 2.8);
    }
  }
  return root;
}
