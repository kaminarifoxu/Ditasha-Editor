import { applyMorphPack } from './freemode-morph-pack.js';
import { deformFacePositions } from './offline-face-deform.js';
import { defaultDrawableSelection, drawableView } from './drawable-selection.js';
import * as THREE from 'three';
import { previewMaterialAlpha } from './preview-texture-material.js';
import { scorePreviewDictionary, shouldTryPreviewFallback } from './file-preview-texture-selection.js';
import { automaticPairedDiffuse, availableDiffuseTextures } from './file-preview-force-ytd.js';
import { createSafeGeometry } from './safe-model-geometry.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { decodeResource } from './resource-client.js';
import { readDds } from './asset-tools.js';
import { resolveModelTexture, modelAlphaMode, modelPreviewAlpha } from './model-material.js';
import { resolveVehicleLivery, setVehicleLivery } from './vehicle-livery.js';
import { createModelMaterial, resolveSurfaceMaps, setSurfaceMaps } from './vehicle-surface.js';

// A single renderer is reused for static File Manager thumbnail snapshots.
// Recreating a WebGL context for every YDD causes repeated shader compilation,
// context creation and GPU data uploads; never share with an interactive preview.
let thumbnailRenderer = null;
function snapshotRenderer() {
  if (!thumbnailRenderer) {
    thumbnailRenderer = new THREE.WebGLRenderer({
      antialias: true, alpha: true,
      preserveDrawingBuffer: true, powerPreference: 'high-performance',
    });
    thumbnailRenderer.outputColorSpace = THREE.SRGBColorSpace;
    thumbnailRenderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  }
  return thumbnailRenderer;
}

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
  async function show(file, api, { snapshot = false, facePreview = false, morphPack = null, highPerformance = false, textureId = null, textureCandidateIds = [], onTextureResolved = null, uvCalibration = null } = {}) {
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
      if (version !== generation) return;
      const drawable = drawableView(drawables, defaultDrawableSelection(drawables)),
        level = drawable?.lods?.[0];
      if (!level?.geometries.length) throw Error('Geometri model tidak tersedia.');
      let external = [];
      let resolvedTextureId = null;
      // Only consider YTDs already paired to this YDD by family/collection.
      // Exact internal sampler coverage wins; when names differ, prefer a
      // dictionary with one unambiguous diffuse image.
      const candidateIds = [...new Set([
        textureId || data.companion?.id,
        ...textureCandidateIds.slice(0, 12),
      ].filter(Boolean))].slice(0, 8);
      const geometric = level.geometries;
      let bestScore = -1;
      for (const id of candidateIds) {
        try {
          const dictionary = await api.read(id);
          if (version !== generation) return;
          const decoded = (await decodeResource('ytd', new Uint8Array(dictionary.data).buffer)).textures;
          if (version !== generation) return;
          const matched = scorePreviewDictionary(geometric, decoded, file.name);
          const score = matched * 100 + (availableDiffuseTextures(decoded).length === 1 ? 1 : 0);
          if (score > bestScore) {
            bestScore = score;
            external = decoded;
            resolvedTextureId = id;
          }
          if (matched && matched === geometric.filter((g) => g.diffuseTexture).length) break;
        } catch {
          // Missing or corrupt paired YTDs cannot hide valid model geometry.
        }
      }
      if (resolvedTextureId && typeof onTextureResolved === 'function')
        onTextureResolved(resolvedTextureId);
      const host = document.createElement('div');
      host.className = 'fm-model-preview';
      container.replaceChildren(host);
      const renderer = snapshot ? snapshotRenderer() : new THREE.WebGLRenderer({
        antialias: true, alpha: true, preserveDrawingBuffer: false,
        powerPreference: highPerformance ? 'high-performance' : 'default',
      });
      if (!snapshot) {
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
      }
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
      const faceMeshes = [];
      const materialBindings = [];
      for (const g of level.geometries) {
        const embedded = g.sourceEmbeddedTextures || drawable.embeddedTextures || [];
        let geometry;
        try { geometry = createSafeGeometry(g); }
        catch (error) { console.warn('[DITASHA 3D] Skipping invalid submesh:', error.message); continue; }
        const t = resolvedTextureId
          ? automaticPairedDiffuse(g.diffuseTexture, external, embedded, file.name, resolveModelTexture)
          : resolveModelTexture(g.diffuseTexture, external, embedded, file.name);
        const textureMap = (t, role = 'color') => {
          if (!t) return null;
          if (mapCache.get(t)?.has(role)) return mapCache.get(t).get(role);
          const map = new THREE.DataTexture(t.out, t.w, t.h, THREE.RGBAFormat);
          map.flipY = false;
          map.wrapS = map.wrapT = THREE.RepeatWrapping;
          // Optional Character Maker-only atlas adjustment. Other preview
          // callers omit this option and preserve their original UV behavior.
          if (facePreview && Array.isArray(uvCalibration) &&
              uvCalibration.length === 4 &&
              uvCalibration.every(v => typeof v === 'number' && Number.isFinite(v)) &&
              Math.abs(uvCalibration[0]) <= 1 && Math.abs(uvCalibration[1]) <= 1 &&
              uvCalibration[2] >= 0.1 && uvCalibration[2] <= 4 &&
              uvCalibration[3] >= 0.1 && uvCalibration[3] <= 4) {
            map.offset.set(uvCalibration[0], uvCalibration[1]);
            map.repeat.set(uvCalibration[2], uvCalibration[3]);
          }
          map.colorSpace = role === 'data' ? THREE.NoColorSpace : THREE.SRGBColorSpace;
          map.needsUpdate = true;
          maps.push(map);
          if (!mapCache.has(t)) mapCache.set(t, new Map());
          mapCache.get(t).set(role, map);
          return map;
        };
        const map = textureMap(t),
          livery = resolveVehicleLivery(g, external, embedded, file.name);
        // Derive cutout/blend from actual loaded YTD alpha; placeholder grey
        // material remains opaque when a sampler has no matching texture.
        const alpha = previewMaterialAlpha(g, t, file.name, modelPreviewAlpha(g));
        const mesh = new THREE.Mesh(
          geometry,
          createModelMaterial(g, {
            map,
            color: map ? 0xffffff : 0xb6bfcc,
            roughness: 0.8,
            side: alpha.side === 'double' ? THREE.DoubleSide : THREE.FrontSide,
            transparent: alpha.transparent,
            alphaTest: alpha.alphaTest,
            depthWrite: alpha.depthWrite,
          }),
        );
        setSurfaceMaps(
          mesh.material,
          g.uvs ? resolveSurfaceMaps(g, external, embedded, file.name) : {},
          textureMap,
        );
        if (livery && geometry.hasAttribute('ditashaLiveryUv')) {
          setVehicleLivery(mesh.material, textureMap(livery));
        }
        group.add(mesh);
        materialBindings.push({ mesh, g, embedded });
        if (facePreview && /head|face|skin/i.test(file.name+' '+(g.diffuseTexture||''))) {
          faceMeshes.push({ geometry, original: new Float32Array(g.positions), indices: g.indices });
        }
      }
      // Optional body reference uses actual user-supplied YDD/ YDR geometry,
      // not a synthetic GTA freemode character or a guessed skeleton.
      let bodyReference = null;
      const setCharacterModel = async (reference) => {
        if (bodyReference) {
          group.remove(bodyReference);
          bodyReference.traverse(o => {
            if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); }
          });
          bodyReference = null;
        }
        if (!reference || version !== generation) { draw(); return false; }
        const bytes = await api.read(reference.id);
        const kind = reference.name.split('.').at(-1).toLowerCase();
        if (!['ydd','ydr'].includes(kind)) throw Error('Referensi karakter harus YDD atau YDR.');
        const parsed = await decodeResource(kind, new Uint8Array(bytes.data).buffer);
        let referenceTextures = [];
        if(bytes.companion) {
          try {
            const ytd=await api.read(bytes.companion.id);
            referenceTextures=(await decodeResource('ytd',new Uint8Array(ytd.data).buffer)).textures;
          }catch { /* Preserve reference geometry if the YTD is missing. */ }
        }
        if (version !== generation) return false;
        const refDrawable=drawableView(parsed,defaultDrawableSelection(parsed));
        const refLevel=refDrawable?.lods?.[0];
        if(!refLevel?.geometries?.length)throw Error('Mesh karakter tidak ditemukan pada referensi.');
        bodyReference = new THREE.Group();
        bodyReference.name='body-reference';
        for(const g of refLevel.geometries){
          let geometry;
          try { geometry = createSafeGeometry(g); }
          catch (error) { console.warn('[DITASHA 3D] Skipping invalid character reference:', error.message); continue; }
          const embedded = g.sourceEmbeddedTextures || refDrawable.embeddedTextures || [];
          const tex=resolveModelTexture(g.diffuseTexture,referenceTextures,embedded,reference.name);
          const map=tex?new THREE.DataTexture(tex.out,tex.w,tex.h,THREE.RGBAFormat):null;
          if(map){map.flipY=false;map.colorSpace=THREE.SRGBColorSpace;map.needsUpdate=true;maps.push(map);}
          const material=new THREE.MeshStandardMaterial({map,color:map?0xffffff:0xb9b6ad,roughness:.9,side:THREE.FrontSide,depthWrite:true});
          bodyReference.add(new THREE.Mesh(geometry,material));
        }
        group.add(bodyReference);
        const bounds = new THREE.Box3().setFromObject(group);
        const midpoint=bounds.getCenter(new THREE.Vector3());
        const extent=bounds.getSize(new THREE.Vector3());
        const diameter=Math.max(extent.x,extent.y,extent.z,.01);
        camera.near=diameter/1000;
        camera.far=diameter*1000;
        camera.position.copy(midpoint).add(new THREE.Vector3(diameter*.85,diameter*.4,diameter*1.8));
        controls.target.copy(midpoint);
        controls.update();
        camera.updateProjectionMatrix();
        draw();
        return true;
      };
      if (!materialBindings.length) throw Error('Tidak ada submesh valid. Periksa format model dan decoder YDD/YDR.');
      const box = new THREE.Box3().setFromObject(group),
        center = box.getCenter(new THREE.Vector3()),
        size = box.getSize(new THREE.Vector3()),
        d = Math.max(size.x, size.y, size.z, 0.01);
      camera.near = d / 1000;
      camera.far = d * 1000;
      camera.position.copy(center).add(new THREE.Vector3(d * 0.85, d * 0.4, d * 1.8));
      camera.updateProjectionMatrix();
      // Snapshot thumbnails are static: OrbitControls allocates event
      // handlers and gesture listeners only needed by the inspector.
      const controls = snapshot
        ? { target: new THREE.Vector3(), update() {}, dispose() {}, addEventListener() {} }
        : new OrbitControls(camera, renderer.domElement);
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
      const applyFace = (appearance) => {
        if (!faceMeshes.length) return false;
        let updated=0;
        for (const item of faceMeshes) {
          let altered;
          if(morphPack){
            try { altered=applyMorphPack(item.original,morphPack,appearance,item.indices); }
            catch { altered=null; }
          }else altered=deformFacePositions(item.original, appearance?.features, appearance?.shapeMix);
          if(!altered)continue;
          const attribute=item.geometry.getAttribute('position');
          if (altered.length !== attribute.array.length) continue;
          let finite = true;
          for (let i = 0; i < altered.length; i++) if (!Number.isFinite(altered[i])) { finite = false; break; }
          if (!finite) continue;
          updated++;
          attribute.array.set(altered); attribute.needsUpdate=true;
          item.geometry.computeVertexNormals();
          item.geometry.computeBoundingSphere();
        }
        draw();
        return updated>0;
      };
      // Switch YTD variants in-place: materials update without recreating model,
      // camera, controls or renderer. Source files remain untouched.
      let textureRequest = 0;
      const setTextureVariant = async (textureId) => {
        const request = ++textureRequest;
        if (version !== generation) return false;
        const selected = await api.read(textureId);
        if (version !== generation || request !== textureRequest) return false;
        const variant = (await decodeResource('ytd', new Uint8Array(selected.data).buffer)).textures;
        if (version !== generation || request !== textureRequest) return false;
        for (const { mesh, g, embedded } of materialBindings) {
          // Filename-paired YTDs automatically supply a single diffuse when
          // their internal sampler name differs from this YDD's reference.
          const diffuse = automaticPairedDiffuse(g.diffuseTexture, variant, embedded, file.name, resolveModelTexture);
          if (!diffuse) continue;
          const texture = textureMapForVariant(diffuse);
          mesh.material.map = texture;
          const alpha = previewMaterialAlpha(g, diffuse, file.name, modelPreviewAlpha(g));
          mesh.material.transparent = alpha.transparent;
          mesh.material.alphaTest = alpha.alphaTest;
          mesh.material.depthWrite = alpha.depthWrite;
          mesh.material.side = alpha.side === 'double' ? THREE.DoubleSide : THREE.FrontSide;
          mesh.material.color.setHex(0xffffff);
          mesh.material.needsUpdate = true;
        }
        draw();
        return true;
      };
      function textureMapForVariant(t) {
        const map = new THREE.DataTexture(t.out, t.w, t.h, THREE.RGBAFormat);
        map.flipY = false;
        map.wrapS = map.wrapT = THREE.RepeatWrapping;
        map.colorSpace = THREE.SRGBColorSpace;
        map.needsUpdate = true;
        maps.push(map);
        return map;
      }
      if (!snapshot) controls.addEventListener('change', draw);
      const observer = snapshot ? null : new ResizeObserver(draw);
      observer?.observe(host);
      draw();
      const thumbnail = snapshot ? await new Promise(resolve => renderer.domElement.toBlob(resolve, 'image/png')) : null;
      release = () => {
        observer?.disconnect();
        controls.dispose();
        group.traverse((o) => {
          if (o.isMesh) {
            o.geometry.dispose();
            o.material.dispose();
          }
        });
        maps.forEach((m) => m.dispose());
        if (snapshot) {
          // Release per-model references while retaining the shared GPU context.
          renderer.renderLists.dispose();
        } else {
          renderer.dispose();
          renderer.forceContextLoss();
        }
        host.remove();
      };
      return snapshot ? thumbnail : { applyFace, supported:faceMeshes.length>0, setTextureVariant, setCharacterModel, selectedTextureId: resolvedTextureId };
    } catch (error) {
      if (version === generation) {
        clear();
        container.textContent = 'Preview tidak tersedia: ' + error.message;
      }
    }
  }
  return { show, clear };
}
