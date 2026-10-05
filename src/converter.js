import * as THREE from 'three';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { readYtd, readYdd, readYdr, readYft } from './resource.js';
import { readDds, writeDds, createYtd, MAX_EXPORT } from './asset-tools.js';
export const conversionModes = [
  ['ytd', 'Pictures → YTD', 'PNG · JPG · WebP · DDS → satu YTD Legacy'],
  ['dds', 'Pictures / YTD → DDS', 'DDS RGBA 32-bit, satu mipmap'],
  ['png', 'Pictures / DDS / YTD → PNG', 'PNG transparan'],
  ['jpg', 'Pictures / DDS / YTD → JPG', 'JPG; transparansi menjadi putih'],
  ['webp', 'Pictures / DDS / YTD → WebP', 'WebP, kualitas 92%'],
  ['glb', 'Model → GLB', 'YDD · YDR · YFT · OBJ · STL → geometri statis'],
];
export function accepts(mode, name) {
  const ext = name.split('.').at(-1).toLowerCase();
  return (
    mode === 'glb'
      ? ['ydd', 'ydr', 'yft', 'obj', 'stl']
      : mode === 'ytd'
        ? ['png', 'jpg', 'jpeg', 'webp', 'dds']
        : ['png', 'jpg', 'jpeg', 'webp', 'dds', 'ytd']
  ).includes(ext);
}
export async function imageData(file) {
  const ext = file.name.split('.').at(-1).toLowerCase();
  if (ext === 'dds') return [readDds(await file.arrayBuffer(), file.name)];
  if (ext === 'ytd') return readYtd(await file.arrayBuffer()).textures;
  const bitmap = await createImageBitmap(file);
  try {
    if (bitmap.width * bitmap.height > 16777216) throw Error('Gambar maksimum 16 megapixel.');
    const c = document.createElement('canvas');
    c.width = bitmap.width;
    c.height = bitmap.height;
    c.getContext('2d').drawImage(bitmap, 0, 0);
    return [
      {
        name: file.name,
        w: c.width,
        h: c.height,
        out: c.getContext('2d').getImageData(0, 0, c.width, c.height).data,
      },
    ];
  } finally {
    bitmap.close();
  }
}
async function picture(t, mode) {
  const c = document.createElement('canvas');
  c.width = t.w;
  c.height = t.h;
  const ctx = c.getContext('2d');
  ctx.putImageData(new ImageData(new Uint8ClampedArray(t.out), t.w, t.h), 0, 0);
  if (mode === 'jpg') {
    ctx.globalCompositeOperation = 'destination-over';
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, c.width, c.height);
  }
  const blob = await new Promise((r) =>
    c.toBlob(r, 'image/' + (mode === 'jpg' ? 'jpeg' : mode), 0.92),
  );
  if (!blob || blob.type !== 'image/' + (mode === 'jpg' ? 'jpeg' : mode))
    throw Error('Format gambar tidak tersedia.');
  return new Uint8Array(await blob.arrayBuffer());
}
export async function convertFile(file, mode) {
  if (file.size > 64 * 1024 * 1024) throw Error('File maksimum 64 MB.');
  if (!accepts(mode, file.name)) throw Error('Format input tidak sesuai konversi.');
  const base = file.name.replace(/\.[^.]+$/, '');
  if (mode === 'glb') {
    const ext = file.name.split('.').at(-1).toLowerCase();
    let object;
    if (ext === 'obj') object = new OBJLoader().parse(await file.text());
    else if (ext === 'stl')
      object = new THREE.Mesh(
        new STLLoader().parse(await file.arrayBuffer()),
        new THREE.MeshStandardMaterial(),
      );
    else {
      object = new THREE.Group();
      for (const d of { ydd: readYdd, ydr: readYdr, yft: readYft }[ext](await file.arrayBuffer())) {
        const group = new THREE.Group();
        group.name = d.name;
        for (const g of d.geometries) {
          const geo = new THREE.BufferGeometry();
          geo.setAttribute('position', new THREE.BufferAttribute(g.positions, 3));
          if (g.uvs) geo.setAttribute('uv', new THREE.BufferAttribute(g.uvs, 2));
          geo.setIndex(new THREE.BufferAttribute(g.indices, 1));
          geo.computeVertexNormals();
          group.add(
            new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ side: THREE.DoubleSide })),
          );
        }
        object.add(group);
      }
    }
    try {
      let vertices = 0;
      object.traverse((o) => {
        if (o.isMesh) vertices += o.geometry.attributes.position?.count || 0;
      });
      if (!vertices || vertices > 1000000) throw Error('Model harus memiliki 1–1.000.000 vertex.');
      const out = await new GLTFExporter().parseAsync(object, { binary: true });
      if (out.byteLength > MAX_EXPORT) throw Error('GLB melebihi 128 MB.');
      return [{ name: base + '.glb', data: new Uint8Array(out) }];
    } finally {
      object.traverse((o) => {
        o.geometry?.dispose();
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) m?.dispose();
      });
    }
  }
  const textures = await imageData(file);
  const output = [];
  for (let i = 0; i < textures.length; i++) {
    const t = textures[i],
      name =
        (textures.length > 1 || file.name.toLowerCase().endsWith('.ytd')
          ? base + '/' + t.name.replace(/[\\/<>:"|?*]/g, '_')
          : base) +
        '.' +
        mode;
    output.push({ name, data: mode === 'dds' ? writeDds(t) : await picture(t, mode) });
  }
  return output;
}
export async function picturesToYtd(files, name) {
  const textures = [];
  for (const f of files) {
    if (f.size > 64 * 1024 * 1024 || !accepts('ytd', f.name))
      throw Error('Input YTD harus gambar/DDS maksimum 64 MB.');
    textures.push(...(await imageData(f)));
    if (textures.reduce((n, t) => n + t.out.length, 0) > MAX_EXPORT)
      throw Error('Tekstur melebihi 128 MB.');
  }
  return [{ name: name + '.ytd', data: createYtd(textures) }];
}
