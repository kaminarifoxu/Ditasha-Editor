import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { decodeResource } from './resource-client.js';
import { readDds } from './asset-tools.js';
import { resolveModelTexture, modelAlphaMode, modelPreviewAlpha } from './model-material.js';
import { resolveVehicleLivery, setVehicleLivery } from './vehicle-livery.js';
import { createModelMaterial, resolveSurfaceMaps, setSurfaceMaps } from './vehicle-surface.js';

// One owned preview at a time; selecting a different file releases its WebGL
// context, controls, decoded resources and observer before displaying the next.
export function createFilePreview(container) {
  let generation = 0,
    release = () => {};
  function clear() {
    generation++;
    release();
    release = () => {};
  }
  async function show(file, api) {
    clear();
    const version = generation;
    container.textContent = 'Memuat preview…';
    try {
      const data = await api.read(file.id);
      if (version !== generation) return;
      const buffer = new Uint8Array(data.data).buffer;
      if (/\.(ytd|dds)$/i.test(file.name)) {
        const textures = /\.dds$/i.test(file.name)
          ? [readDds(buffer, file.name)]
          : (await decodeResource('ytd', buffer)).textures;
        if (version !== generation) return;
        const root = document.createElement('div');
        root.className = 'fm-texture-preview';
        const select = document.createElement('select');
        select.id = 'fmTextureChoice';
        select.setAttribute('aria-label', 'Pilih tekstur preview');
        textures.forEach((t, i) => {
          const o = document.createElement('option');
          o.value = i;
          o.textContent = t.name;
          select.append(o);
        });
        const canvas = document.createElement('canvas');
        canvas.setAttribute('aria-label', 'Preview tekstur');
        function draw() {
          const t = textures[Number(select.value)],
            source = document.createElement('canvas');
          source.width = t.w;
          source.height = t.h;
          source
            .getContext('2d')
            .putImageData(new ImageData(new Uint8ClampedArray(t.out), t.w, t.h), 0, 0);
          const ratio = Math.min(1, 512 / t.w, 512 / t.h);
          canvas.width = Math.max(1, Math.round(t.w * ratio));
          canvas.height = Math.max(1, Math.round(t.h * ratio));
          canvas.getContext('2d').drawImage(source, 0, 0, canvas.width, canvas.height);
          source.width = source.height = 1;
        }
        select.onchange = draw;
        root.append(canvas, select);
        container.replaceChildren(root);
        draw();
        release = () => {
          canvas.width = canvas.height = 1;
          root.remove();
        };
        return;
      }
      const ext = file.name.split('.').at(-1).toLowerCase();
      const drawables = await decodeResource(ext, buffer);
      let external = [];
      if (data.companion)
        try {
          const companion = await api.read(data.companion.id);
          external = (await decodeResource('ytd', new Uint8Array(companion.data).buffer)).textures;
        } catch {
          /* An unavailable companion must not hide readable geometry. */
        }
      if (version !== generation) return;
      const drawable = drawables[0],
        level = drawable?.lods?.[0];
      if (!level?.geometries.length) throw Error('Geometri model tidak tersedia.');
      const host = document.createElement('div');
      host.className = 'fm-model-preview';
      container.replaceChildren(host);
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
      host.append(renderer.domElement);
      const scene = new THREE.Scene(),
        group = new THREE.Group(),
        camera = new THREE.PerspectiveCamera(35, 1, 0.001, 10000),
        maps = [];
      scene.add(group, new THREE.HemisphereLight(0xffffff, 0x677182, 2));
      const light = new THREE.DirectionalLight(0xffeee2, 3);
      light.position.set(3, 5, 4);
      scene.add(light);
      const mapCache = new Map();
      for (const g of level.geometries) {
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(g.positions, 3));
        if (g.uvs) geometry.setAttribute('uv', new THREE.BufferAttribute(g.uvs, 2));
        geometry.setIndex(new THREE.BufferAttribute(g.indices, 1));
        if (g.normals) geometry.setAttribute('normal', new THREE.BufferAttribute(g.normals, 3));
        else geometry.computeVertexNormals();
        const t = resolveModelTexture(
          g.diffuseTexture,
          external,
          drawable.embeddedTextures || [],
          file.name,
        );
        const textureMap = (t, role = 'color') => {
          if (!t) return null;
          if (mapCache.get(t)?.has(role)) return mapCache.get(t).get(role);
          const map = new THREE.DataTexture(t.out, t.w, t.h, THREE.RGBAFormat);
          map.flipY = false;
          map.colorSpace = role === 'data' ? THREE.NoColorSpace : THREE.SRGBColorSpace;
          map.needsUpdate = true;
          maps.push(map);
          if (!mapCache.has(t)) mapCache.set(t, new Map());
          mapCache.get(t).set(role, map);
          return map;
        };
        const map = textureMap(t),
          livery = resolveVehicleLivery(g, external, drawable.embeddedTextures || [], file.name);
        const opaque =
          modelAlphaMode(g) === 'opaque' ||
          /^(sbase|head_diff|uppr_diff|body_diff)/i.test(g.diffuseTexture || '');
        const mesh = new THREE.Mesh(
          geometry,
          createModelMaterial(g, {
            map,
            color: map ? 0xffffff : 0xb6bfcc,
            roughness: 0.8,
            side: THREE.DoubleSide,
            transparent: !!map && !opaque,
            alphaTest: opaque ? 0 : (modelPreviewAlpha(g)?.cutoff ?? 0.01),
            depthWrite: opaque || !map,
          }),
        );
        setSurfaceMaps(
          mesh.material,
          g.uvs ? resolveSurfaceMaps(g, external, drawable.embeddedTextures || [], file.name) : {},
          textureMap,
        );
        if (livery && g.uvs2) {
          geometry.setAttribute('ditashaLiveryUv', new THREE.BufferAttribute(g.uvs2, 2));
          setVehicleLivery(mesh.material, textureMap(livery));
        }
        group.add(mesh);
      }
      const box = new THREE.Box3().setFromObject(group),
        center = box.getCenter(new THREE.Vector3()),
        size = box.getSize(new THREE.Vector3()),
        d = Math.max(size.x, size.y, size.z, 0.01);
      camera.near = d / 1000;
      camera.far = d * 1000;
      camera.position.copy(center).add(new THREE.Vector3(d * 0.85, d * 0.4, d * 1.8));
      camera.updateProjectionMatrix();
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.target.copy(center);
      controls.update();
      const draw = () => {
        if (!host.isConnected) return;
        const w = host.clientWidth,
          h = host.clientHeight;
        if (!w || !h) return;
        renderer.setSize(w, h);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.render(scene, camera);
      };
      controls.addEventListener('change', draw);
      const observer = new ResizeObserver(draw);
      observer.observe(host);
      draw();
      release = () => {
        observer.disconnect();
        controls.dispose();
        group.traverse((o) => {
          if (o.isMesh) {
            o.geometry.dispose();
            o.material.dispose();
          }
        });
        maps.forEach((m) => m.dispose());
        renderer.dispose();
        renderer.forceContextLoss();
        host.remove();
      };
    } catch (error) {
      if (version === generation) {
        clear();
        container.textContent = 'Preview tidak tersedia: ' + error.message;
      }
    }
  }
  return { show, clear };
}
