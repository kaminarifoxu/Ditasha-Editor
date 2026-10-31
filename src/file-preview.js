import { applyMorphPack } from './freemode-morph-pack.js';
import { deformFacePositions } from './offline-face-deform.js';
import { defaultDrawableSelection, drawableView } from './drawable-selection.js';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { decodeResource } from './resource-client.js';
import { readDds } from './asset-tools.js';
import { resolveModelTexture, textureNameMatches, modelAlphaMode, modelPreviewAlpha } from './model-material.js';
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
  async function show(file, api, { snapshot = false, facePreview = false, morphPack = null, highPerformance = false, textureId = null } = {}) {
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
      if (textureId || data.companion)
        try {
          const companion = await api.read(textureId || data.companion.id);
          external = (await decodeResource('ytd', new Uint8Array(companion.data).buffer)).textures;
        } catch {
          /* An unavailable companion must not hide readable geometry. */
        }
      if (version !== generation) return;
      const drawable = drawableView(drawables, defaultDrawableSelection(drawables)),
        level = drawable?.lods?.[0];
      if (!level?.geometries.length) throw Error('Geometri model tidak tersedia.');
      // A drawable may have many YTD variants. The first sorted YTD is not
      // necessarily the one containing its diffuse textures. Probe alternatives
      // without replacing exact-name/hash matching with unreliable guesses.
      const textureScore = textures => level.geometries.reduce((score, geometry) => {
        if (!geometry.diffuseTexture) return score;
        // Count YTD coverage only: embedded YDD textures should not make every
        // candidate look equally good and prevent a better YTD from being chosen.
        return score + Number(textures.some(texture =>
          textureNameMatches(geometry.diffuseTexture, texture)));
      }, 0);
      if (!textureId && Array.isArray(file.textures) && file.textures.length > 1) {
        // Keep one coherent primary variant. Supplement only missing diffuse
        // names that have exactly one alternative match across other YTD files.
        // Never combine conflicting texture variants or choose by array order.
        let bestScore = textureScore(external);
        const alternate = [];
        for (const candidate of file.textures.slice(0, 16)) {
          if (version !== generation) return;
          if (candidate.id === data.companion?.id) continue;
          try {
            const result = await api.read(candidate.id);
            const textures = (await decodeResource('ytd', new Uint8Array(result.data).buffer)).textures;
            alternate.push({id:candidate.id, textures});
            const score = textureScore(textures);
            if (score > bestScore) { external = textures; bestScore = score; }
          } catch { /* A corrupt YTD cannot hide the drawable. */ }
        }
        const requiredNames = [...new Set(level.geometries
          .map(g => g.diffuseTexture).filter(Boolean))];
        // The original companion may supply a texture missing from the chosen
        // primary variant, so include it in the conflict check too.
        const allDictionaries = [...alternate.map(item => item.textures)];
        if (data.companion && data.companion.id !== alternate.find(item => item.textures === external)?.id) {
          try {
            const original = await api.read(data.companion.id);
            allDictionaries.push((await decodeResource('ytd', new Uint8Array(original.data).buffer)).textures);
          } catch { /* Optional companion. */ }
        }
        for (const name of requiredNames) {
          if (external.some(texture => textureNameMatches(name, texture))) continue;
          const matches = allDictionaries.flatMap(textures =>
            textures.filter(texture => textureNameMatches(name, texture)));
          // Different dictionaries with the same material name are ambiguous.
          if (matches.length === 1) external = [...external, matches[0]];
        }
      }
      // Report the exact unresolved diffuse names instead of silently showing grey.
      // The same strict material matching used by the main texture-search pipeline
      // is used here; ambiguous names are never assigned an arbitrary YTD image.
      const missingTextures = [...new Set(level.geometries
        .filter(geometry => geometry.diffuseTexture && !resolveModelTexture(
          geometry.diffuseTexture, external,
          geometry.sourceEmbeddedTextures || drawable.embeddedTextures || [], file.name))
        .map(geometry => geometry.diffuseTexture))];
      const host = document.createElement('div');
      host.className = 'fm-model-preview';
      container.replaceChildren(host);
      if (missingTextures.length && !snapshot) {
        const notice = document.createElement('details');
        notice.className = 'fm-missing-textures';
        notice.style.cssText = 'position:absolute;left:8px;bottom:8px;z-index:2;max-width:calc(100% - 16px);padding:6px 9px;background:rgba(14,19,30,.92);color:#f8d9aa;border:1px solid #8b6843;border-radius:8px;font-size:11px;line-height:1.4;overflow-wrap:anywhere';
        const label = document.createElement('summary');
        label.textContent = missingTextures.length + ' nama tekstur belum ditemukan · detail';
        const content = document.createElement('div');
        content.textContent = missingTextures.slice(0, 24).join(', ') +
          (missingTextures.length > 24 ? ' …' : '') +
          '. Pilih variasi YTD lain atau pastikan dictionary tekstur asli tersedia.';
        notice.append(label, content);
        host.style.position = 'relative';
        host.append(notice);
      }
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: snapshot, powerPreference: highPerformance ? 'high-performance' : 'default' });
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
      const faceMeshes = [];
      const materialBindings = [];
      for (const g of level.geometries) {
        const embedded = g.sourceEmbeddedTextures || drawable.embeddedTextures || [];
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(g.positions, 3));
        if (g.uvs) geometry.setAttribute('uv', new THREE.BufferAttribute(g.uvs, 2));
        geometry.setIndex(new THREE.BufferAttribute(g.indices, 1));
        if (g.normals) geometry.setAttribute('normal', new THREE.BufferAttribute(g.normals, 3));
        else geometry.computeVertexNormals();
        const t = resolveModelTexture(g.diffuseTexture, external, embedded, file.name);
        const textureMap = (t, role = 'color') => {
          if (!t) return null;
          if (mapCache.get(t)?.has(role)) return mapCache.get(t).get(role);
          const map = new THREE.DataTexture(t.out, t.w, t.h, THREE.RGBAFormat);
          map.flipY = false;
          map.wrapS = map.wrapT = THREE.RepeatWrapping;
          map.colorSpace = role === 'data' ? THREE.NoColorSpace : THREE.SRGBColorSpace;
          map.needsUpdate = true;
          maps.push(map);
          if (!mapCache.has(t)) mapCache.set(t, new Map());
          mapCache.get(t).set(role, map);
          return map;
        };
        const map = textureMap(t),
          livery = resolveVehicleLivery(g, external, embedded, file.name);
        // GTA clothing often carries alpha bytes in nominally opaque fabrics.
        // Treat clothing fabric as solid unless its shader explicitly identifies cutout/blend.
        const alpha = modelPreviewAlpha(g);
        const clothing = /(?:^|[\\^])(jbib|uppr|lowr|hand|feet|accs|task|decl|hair|head)_(?:diff_)?\d/i.test(file.name);
        const outerGarment = /(?:^|[\\^])(jbib|uppr|lowr|accs|task)_(?:diff_)?\d/i.test(file.name);
        // Opaque garments should never retain an accidental alpha-blend shader.
        // Hair, skin and intentional cutouts keep their original alpha behavior.
        const solidFabric = outerGarment || (clothing && (!alpha || alpha.mode === 'opaque'));
        const opaque = solidFabric || (alpha
          ? alpha.mode === 'opaque'
          : modelAlphaMode(g) === 'opaque' ||
            /^(sbase|head_diff|uppr_diff|body_diff)/i.test(g.diffuseTexture || ''));
        const mesh = new THREE.Mesh(
          geometry,
          createModelMaterial(g, {
            map,
            color: map ? 0xffffff : 0xb6bfcc,
            roughness: 0.8,
            side: THREE.DoubleSide,
            transparent: !!map && !solidFabric && (alpha ? alpha.mode === 'blend' : !opaque),
            alphaTest: opaque ? 0 : (alpha?.cutoff ?? 0.01),
            depthWrite: solidFabric || !map || (alpha ? alpha.mode !== 'blend' : opaque),
          }),
        );
        // Freemode body sections often overlap back-facing triangles. With DoubleSide,
        // the internal faces may compete with the outer skin and produce jagged holes.
        // Cull backfaces for ordinary opaque skin/body geometry; keep intentional cutouts two-sided.
        if (solidFabric && !/hair|eyelash/i.test(g.diffuseTexture || '')) {
          mesh.material.side = THREE.FrontSide;
          mesh.material.depthWrite = true;
          mesh.material.transparent = false;
          mesh.material.alphaTest = 0;
          mesh.material.needsUpdate = true;
        }
        setSurfaceMaps(
          mesh.material,
          g.uvs ? resolveSurfaceMaps(g, external, embedded, file.name) : {},
          textureMap,
        );
        if (livery && g.uvs2) {
          geometry.setAttribute('ditashaLiveryUv', new THREE.BufferAttribute(g.uvs2, 2));
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
      let characterRequest = 0;
      let bodyMaps = [];
      const disposeBody = (node, textures = []) => {
        node?.traverse(o => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
        textures.forEach(texture => texture.dispose());
      };
      const setCharacterModel = async (reference) => {
        const request = ++characterRequest;
        if (bodyReference) {
          group.remove(bodyReference);
          disposeBody(bodyReference, bodyMaps);
          bodyMaps = [];
          bodyReference = null;
        }
        if (!reference || version !== generation) { draw(); return false; }
        const nextReference = new THREE.Group();
        const nextMaps = [];
        const discardNext = () => disposeBody(nextReference, nextMaps);
        nextReference.name = 'body-reference';
        const parts = Array.isArray(reference.parts) && reference.parts.length
          ? reference.parts : [reference];
        const failures = [];
        for (const part of parts) {
          try {
            if (version !== generation || request !== characterRequest) { discardNext(); return false; }
            const bytes = await api.read(part.id);
            const kind = part.name.split('.').at(-1).toLowerCase();
            if (!['ydd','ydr'].includes(kind)) continue;
            const parsed = await decodeResource(kind, new Uint8Array(bytes.data).buffer);
            let referenceTextures = [];
            if (bytes.companion) {
              try {
                const ytd = await api.read(bytes.companion.id);
                referenceTextures = (await decodeResource('ytd', new Uint8Array(ytd.data).buffer)).textures;
              } catch { /* A missing YTD must not discard readable geometry. */ }
            }
            if (version !== generation || request !== characterRequest) { discardNext(); return false; }
            const refDrawable = drawableView(parsed, defaultDrawableSelection(parsed));
            const refLevel = refDrawable?.lods?.[0];
            if (!refLevel?.geometries?.length) { failures.push(part.name); continue; }
            const section = new THREE.Group();
            section.name = part.slot || part.name;
            for (const g of refLevel.geometries) {
              const geometry = new THREE.BufferGeometry();
              geometry.setAttribute('position', new THREE.BufferAttribute(g.positions, 3));
              if (g.uvs) geometry.setAttribute('uv', new THREE.BufferAttribute(g.uvs, 2));
              geometry.setIndex(new THREE.BufferAttribute(g.indices, 1));
              if (g.normals) geometry.setAttribute('normal', new THREE.BufferAttribute(g.normals, 3));
              else geometry.computeVertexNormals();
              const embedded = g.sourceEmbeddedTextures || refDrawable.embeddedTextures || [];
              const tex = resolveModelTexture(g.diffuseTexture, referenceTextures, embedded, part.name);
              const map = tex ? new THREE.DataTexture(tex.out, tex.w, tex.h, THREE.RGBAFormat) : null;
              if (map) { map.flipY = false; map.colorSpace = THREE.SRGBColorSpace; map.needsUpdate = true; nextMaps.push(map); }
              const material = new THREE.MeshStandardMaterial({
                map, color: map ? 0xffffff : 0xb9b6ad, roughness: .9,
                side: THREE.FrontSide, depthWrite: true
              });
              section.add(new THREE.Mesh(geometry, material));
            }
            nextReference.add(section);
          } catch (error) { failures.push(part.name + ': ' + error.message); }
        }
        if (version !== generation || request !== characterRequest) {
          discardNext();
          return false;
        }
        if (!nextReference.children.length) {
          discardNext();
          throw Error('Tidak ada mesh freemode yang dapat dibaca. ' + failures.slice(0, 2).join('; '));
        }
        bodyMaps = nextMaps;
        bodyReference = nextReference;
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
          updated++;
          const attribute=item.geometry.getAttribute('position');
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
          const diffuse = resolveModelTexture(g.diffuseTexture, variant, embedded, file.name) ||
            (variant.length === 1 && g.uvs ? variant[0] : null);
          // Keep the current diffuse if the selected dictionary lacks a match.
          if (!diffuse) continue;
          const texture = textureMapForVariant(diffuse);
          mesh.material.map = texture;
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
      controls.addEventListener('change', draw);
      const observer = new ResizeObserver(draw);
      observer.observe(host);
      draw();
      const thumbnail = snapshot ? await new Promise(resolve => renderer.domElement.toBlob(resolve, 'image/png')) : null;
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
      return snapshot ? thumbnail : { applyFace, supported:faceMeshes.length>0, setTextureVariant, setCharacterModel };
    } catch (error) {
      if (version === generation) {
        clear();
        container.textContent = 'Preview tidak tersedia: ' + error.message;
      }
    }
  }
  return { show, clear };
}
