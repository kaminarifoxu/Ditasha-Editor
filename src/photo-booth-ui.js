import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { decodeResource } from './resource-client.js';
import { defaultDrawableSelection } from './drawable-selection.js';
import { createModelMaterial, resolveSurfaceMaps, setSurfaceMaps } from './vehicle-surface.js';
import { resolveModelTexture, modelPreviewAlpha, modelAlphaMode } from './model-material.js';
import {
  loadVehicleTextures,
  modelTextureReferences,
  mergeVehicleTextures,
} from './vehicle-textures.js';
import { imageData } from './converter.js';
import {
  BOOTH_POSES,
  boothBoneRole,
  captureBoothRest,
  applyBoothPose,
} from './photo-booth-pose.js';
import { ICON_CODES } from './ui-icons.js';

export function mountPhotoBooth({ nav, activate, download, toast }) {
  const button = document.createElement('button');
  button.dataset.page = 'photobooth';
  button.innerHTML = `<i class="di-icon" aria-hidden="true" data-icon="camera" data-glyph="${String.fromCodePoint(parseInt(ICON_CODES.camera, 16))}"></i><span>Photo Booth</span>`;
  button.onclick = () => activate('photobooth');
  nav.append(button);
  const root = document.createElement('section');
  root.className = 'photo-booth-workspace';
  root.hidden = true;
  root.innerHTML = `<div class="pb-heading"><div><span class="eyebrow">DITASHA / OFFLINE PHOTO BOOTH</span><h1>Photo Booth</h1><p class="muted">Ped, outfit dan aksesori · pose, atur kamera, ambil foto.</p></div><button id="pbCapture" class="primary" disabled>▣ Simpan PNG</button></div>
  <div class="pb-layout"><aside class="pb-panel pb-assets"><h2>Model & outfit</h2><div class="pb-buttons"><button id="pbPed">+ Ped / tubuh</button><button id="pbClothes">+ Baju</button><button id="pbAccessory">+ Aksesori</button><button id="pbTextures">+ Tekstur</button></div><input id="pbInput" type="file" accept=".ydd,.ydr,.yft,.ytd,.glb" multiple hidden><input id="pbTextureInput" type="file" accept=".ytd,.dds,.png,.jpg,.jpeg,.webp" multiple hidden><p class="muted">Masukkan YDD + YTD. YFT skeleton pendamping dapat ditambahkan. GLB rigged juga didukung.</p><div id="pbAssets"></div><p id="pbEmpty">Belum ada model. Mulai dari ped / tubuh milikmu.</p><button id="pbClear">Kosongkan booth</button></aside>
  <section class="pb-stage"><div class="pb-stage-toolbar"><button id="pbFit">Fit tubuh</button><button id="pbFront">Depan</button><button id="pbBack">Belakang</button><label class="check"><input id="pbFloor" type="checkbox" checked>Lantai</label><span>Drag: orbit · scroll: zoom</span></div><div id="pbViewport"></div><p id="pbStatus" role="status">Siap untuk sesi foto offline.</p></section>
  <aside class="pb-panel pb-settings"><h2>Pose & emote</h2><label>Pose<select id="pbPose">${BOOTH_POSES.map(([id, label]) => `<option value="${id}">${label}</option>`).join('')}<option value="clip">Clip GLB</option></select></label><div class="pb-buttons"><button id="pbPlay" disabled>▶ Putar</button><button id="pbResetPose">Reset pose</button></div><label>Frame / waktu <output id="pbTimeLabel">0.00 s</output><input id="pbTime" type="range" min="0" max="4" step="0.01" value="0"></label><button id="pbImportClip">+ Animasi GLB</button><input id="pbClipInput" type="file" accept=".glb" hidden><label id="pbClipField" hidden>Clip<select id="pbClip"></select></label><p id="pbRigStatus" class="muted" role="status">Pose memerlukan skeleton dan skin weights yang cocok.</p><h2>Studio</h2><label>Background<input id="pbBackground" type="color" value="#242938"></label><label class="check"><input id="pbTransparent" type="checkbox">PNG transparan</label><label>Cahaya<input id="pbLight" type="range" min="0.3" max="3" value="1" step="0.05"></label><label>Resolusi foto<select id="pbSize"><option value="1080x1350">1080 × 1350 · katalog</option><option value="1920x1080">1920 × 1080 · landscape</option><option value="2048x2048">2048 × 2048 · square</option><option value="3000x4000">3000 × 4000 · portrait</option></select></label><p class="muted">Pose/emote bawaan dibuat untuk preview. Animasi GLB memakai nama bone yang cocok; binary YCD belum didukung di booth.</p></aside></div>`;
  nav.after(root);
  const $ = (id) => root.querySelector('#' + id);
  let renderer,
    scene,
    camera,
    controls,
    stage,
    floor,
    key,
    fill,
    active = false,
    playing = false,
    busy = false,
    kind = 'ped',
    last = 0,
    raf = 0,
    assets = [],
    textures = [],
    maps = [],
    rest = [],
    mixers = [],
    externalClips = [],
    animatedMeshes = 0,
    time = 0,
    token = 0;
  const setStatus = (s) => {
    $('pbStatus').textContent = s;
  };
  const guard = async (fn) => {
    if (busy) return;
    busy = true;
    setControls();
    try {
      await fn();
    } catch (e) {
      setStatus(e.message);
      toast('Photo Booth: ' + e.message);
    } finally {
      busy = false;
      setControls();
    }
  };
  function setControls() {
    for (const id of ['pbPed', 'pbClothes', 'pbAccessory', 'pbTextures', 'pbClear', 'pbImportClip'])
      $(id).disabled = busy;
    $('pbAssets')
      .querySelectorAll('button,input,select')
      .forEach((e) => (e.disabled = busy));
    const movable =
      $('pbPose').value === 'clip'
        ? mixers.length > 0
        : animatedMeshes > 0 && rest.some((r) => r.role);
    $('pbCapture').disabled = busy || !assets.length;
    $('pbPlay').disabled = busy || !movable;
    $('pbTime').disabled = busy || !movable;
  }
  function ensure() {
    if (renderer) return;
    renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    $('pbViewport').append(renderer.domElement);
    scene = new THREE.Scene();
    stage = new THREE.Group();
    scene.add(stage);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x777987, 2));
    key = new THREE.DirectionalLight(0xfff1df, 3);
    key.position.set(3, 5, 4);
    scene.add(key);
    fill = new THREE.DirectionalLight(0xcbdcff, 1.5);
    fill.position.set(-4, 2, -3);
    scene.add(fill);
    floor = new THREE.GridHelper(10, 40, 0x717785, 0x414858);
    scene.add(floor);
    camera = new THREE.PerspectiveCamera(35, 1, 0.001, 1000);
    camera.position.set(0, 1.3, -4);
    controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 1, 0);
    controls.addEventListener('change', render);
    new ResizeObserver(resize).observe($('pbViewport'));
    renderer.domElement.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      playing = false;
      setStatus('Konteks 3D terputus. Buka ulang aplikasi untuk memulihkan booth.');
    });
    resize();
  }
  function resize() {
    if (!renderer || !active) return;
    const w = $('pbViewport').clientWidth,
      h = $('pbViewport').clientHeight;
    if (!w || !h) return;
    const [sw, sh] = $('pbSize').value.split('x').map(Number),
      ratio = sw / sh;
    const rw = Math.min(w, h * ratio),
      rh = rw / ratio;
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    renderer.setSize(rw, rh);
    camera.aspect = ratio;
    camera.updateProjectionMatrix();
    render();
  }
  function render() {
    if (!renderer || !active) return;
    renderer.setClearColor($('pbBackground').value, $('pbTransparent').checked ? 0 : 1);
    floor.visible = $('pbFloor').checked && !$('pbTransparent').checked;
    key.intensity = 3 * Number($('pbLight').value);
    fill.intensity = 1.5 * Number($('pbLight').value);
    renderer.render(scene, camera);
  }
  function fit(direction) {
    if (!stage?.children.length) return;
    stage.updateMatrixWorld(true);
    stage.traverse((o) => {
      if (o.isSkinnedMesh) o.computeBoundingBox();
    });
    const box = new THREE.Box3().setFromObject(stage);
    if (box.isEmpty()) return;
    const center = box.getCenter(new THREE.Vector3()),
      size = box.getSize(new THREE.Vector3());
    const dir = direction || camera.position.clone().sub(controls.target).normalize();
    const radius = Math.max(size.length() / 2, 0.05),
      distance =
        (radius / Math.sin((camera.fov * Math.PI) / 360) / Math.min(1, camera.aspect)) * 1.08;
    camera.position.copy(center).addScaledVector(dir, distance);
    camera.near = Math.max(0.0001, distance / 10000);
    camera.far = Math.max(100, distance * 20);
    camera.updateProjectionMatrix();
    controls.target.copy(center);
    controls.update();
    render();
  }
  function textureMap(t, role = 'color') {
    if (!t) return null;
    let found = maps.find((m) => m.source === t && m.role === role);
    if (found) return found.map;
    const map = new THREE.DataTexture(new Uint8Array(t.out), t.w, t.h, THREE.RGBAFormat);
    map.colorSpace = role === 'color' ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    map.flipY = false;
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.needsUpdate = true;
    maps.push({ source: t, role, map });
    return map;
  }
  function nativeRig(data) {
    const holder = new THREE.Group(),
      bones = data.map((b) => {
        const bone = new THREE.Bone();
        bone.name = b.name;
        bone.userData.tag = b.tag;
        new THREE.Matrix4()
          .fromArray(b.matrix)
          .decompose(bone.position, bone.quaternion, bone.scale);
        return bone;
      });
    bones.forEach((bone, i) => (data[i].parent < 0 ? holder : bones[data[i].parent]).add(bone));
    holder.updateMatrixWorld(true);
    return { holder, bones, skeleton: new THREE.Skeleton(bones) };
  }
  function clearStage() {
    applyBoothPose(rest, 'rest', 0);
    mixers.forEach((m) => {
      m.stopAllAction();
      m.uncacheRoot(m.getRoot());
    });
    mixers = [];
    rest = [];
    stage.traverse((o) => {
      if (o.isMesh && o.userData.boothNative) {
        o.geometry.dispose();
        o.material.dispose();
      }
      if (o.isSkinnedMesh && o.userData.boothNative) o.skeleton.dispose();
    });
    stage.clear();
    maps.forEach((m) => m.map.dispose());
    maps = [];
  }
  function rebuild() {
    ensure();
    playing = false;
    clearStage();
    const warnings = [];
    let skinned = 0,
      staticMeshes = 0;
    const fallback = assets
      .flatMap((a) => a.drawables || [])
      .map((d) => d.rig)
      .filter((r) => r?.length)
      .sort((a, b) => b.length - a.length)[0];
    for (const a of assets) {
      a.root = new THREE.Group();
      a.root.name = a.name;
      a.root.visible = a.visible;
      stage.add(a.root);
      if (a.gltf) {
        a.root.add(a.gltf.scene);
        continue;
      }
      const selected =
        a.drawable === -1 ? a.drawables : a.drawables.filter((_, i) => i === a.drawable);
      for (const d of selected) {
        const part = new THREE.Group();
        part.name = d.name;
        part.visible = !a.hiddenSlots.has(d.componentSlot);
        a.root.add(part);
        const data = d.rig?.length ? d.rig : fallback;
        const rig = data?.length ? nativeRig(data) : null;
        if (rig) part.add(rig.holder);
        for (const g of (d.lods.find((l) => l.name === 'High') || d.lods[0]).geometries) {
          const geom = new THREE.BufferGeometry();
          geom.setAttribute('position', new THREE.BufferAttribute(g.positions, 3));
          if (g.uvs) geom.setAttribute('uv', new THREE.BufferAttribute(g.uvs, 2));
          geom.setIndex(new THREE.BufferAttribute(g.indices, 1));
          if (g.normals) geom.setAttribute('normal', new THREE.BufferAttribute(g.normals, 3));
          else geom.computeVertexNormals();
          const embedded = d.embeddedTextures || [],
            t = resolveModelTexture(g.diffuseTexture, textures, embedded, a.name);
          if (g.diffuseTexture && !t)
            warnings.push(a.name + ': tekstur ' + g.diffuseTexture + ' belum ditemukan');
          const alpha = modelPreviewAlpha(g) || {
            mode: /^(sbase|head_diff|uppr_diff|lowr_diff|body_diff)/i.test(g.diffuseTexture || '')
              ? 'opaque'
              : modelAlphaMode(g),
            cutoff: 0.02,
          };
          const material = createModelMaterial(g, {
            color: t ? 0xffffff : 0xa7b1c0,
            map: textureMap(t),
            side: THREE.DoubleSide,
            roughness: 0.75,
            transparent: alpha.mode === 'blend',
            alphaTest: alpha.mode === 'opaque' ? 0 : alpha.cutoff,
          });
          setSurfaceMaps(material, resolveSurfaceMaps(g, textures, embedded, a.name), textureMap);
          let mesh;
          const valid =
            g.skin &&
            rig &&
            g.skin.indices.every((id, i) => !g.skin.weights[i] || id < rig.bones.length);
          if (valid) {
            geom.setAttribute('skinIndex', new THREE.BufferAttribute(g.skin.indices, 4));
            geom.setAttribute('skinWeight', new THREE.BufferAttribute(g.skin.weights, 4));
            mesh = new THREE.SkinnedMesh(geom, material);
            part.add(mesh);
            part.updateMatrixWorld(true);
            mesh.bind(rig.skeleton, new THREE.Matrix4());
            mesh.frustumCulled = false;
            skinned++;
          } else {
            mesh = new THREE.Mesh(geom, material);
            part.add(mesh);
            staticMeshes++;
            if (g.skin) warnings.push(a.name + ': skin tidak cocok dengan skeleton');
          }
          mesh.name = g.name;
          mesh.userData.boothNative = true;
          if (!g.skin && rig && rig.bones[g.boneIndex]) {
            part.updateMatrixWorld(true);
            rig.bones[g.boneIndex].attach(mesh);
          }
          if (g.skinWarning) warnings.push(g.skinWarning);
        }
      }
    }
    stage.updateMatrixWorld(true);
    // Rigid accessories can be attached to an explicitly selected body bone.
    const ped = assets.find((a) => a.kind === 'ped' && a.visible),
      targets = [];
    ped?.root.traverse((o) => {
      if (o.isBone) targets.push(o);
    });
    for (const a of assets)
      if (a.kind !== 'ped' && a.attach !== 'auto') {
        const bone = targets.find((b) => b.name === a.attach);
        if (bone) {
          bone.attach(a.root);
          a.attached = true;
        } else warnings.push(a.name + ': bone tujuan tidak ditemukan');
      }
    for (const a of assets) {
      a.root.position.add(new THREE.Vector3(...a.offset));
      a.root.scale.multiplyScalar(a.scale);
    }
    animatedMeshes = 0;
    stage.traverse((o) => {
      if (!o.isMesh) return;
      let bound = o.isSkinnedMesh;
      for (let p = o.parent; p && p !== stage; p = p.parent)
        if (p.isBone && boothBoneRole(p.name)) bound = true;
      if (bound) animatedMeshes++;
    });
    rest = captureBoothRest(stage);
    const roles = new Set(rest.map((b) => b.role).filter(Boolean));
    $('pbRigStatus').textContent =
      roles.size && animatedMeshes
        ? `${roles.size} bagian rig dikenali · ${skinned} mesh GTA skinned. ${staticMeshes} mesh statis/rigid.`
        : 'Model statis: pose tidak dapat mengubah mesh tanpa rig/weights. Gunakan ped rigged atau GLB dari Auto Rig.';
    updateClips();
    applyPose();
    assetList(targets);
    setControls();
    setStatus(
      warnings.length
        ? [...new Set(warnings)].slice(0, 10).join(' · ')
        : `${assets.length} aset · siap foto. File sumber tetap utuh.`,
    );
    fit();
  }
  function updateClips() {
    const old = $('pbClip').value;
    const clips = [
      ...assets.flatMap((a) =>
        (a.gltf?.animations || []).map((clip, i) => ({
          clip,
          id: a.id + ':' + i,
          label: a.name + ' / ' + clip.name,
        })),
      ),
      ...externalClips,
    ];
    $('pbClip').replaceChildren(
      ...clips.map((c) => {
        const o = document.createElement('option');
        o.value = c.id;
        o.textContent = c.label;
        return o;
      }),
    );
    if (clips.some((c) => c.id === old)) $('pbClip').value = old;
    $('pbClipField').hidden = !clips.length;
    const selected = clips.find((c) => c.id === $('pbClip').value);
    mixers.forEach((m) => {
      m.stopAllAction();
      m.uncacheRoot(m.getRoot());
    });
    mixers = [];
    if (selected)
      for (const a of assets.filter((a) => a.gltf)) {
        const names = new Set();
        a.root.traverse((o) => names.add(o.name));
        const tracks = selected.clip.tracks.filter((track) => {
          try {
            return names.has(THREE.PropertyBinding.parseTrackName(track.name).nodeName);
          } catch {
            return false;
          }
        });
        if (tracks.length) {
          const mixer = new THREE.AnimationMixer(a.gltf.scene);
          mixer
            .clipAction(new THREE.AnimationClip(selected.clip.name, selected.clip.duration, tracks))
            .play();
          mixers.push(mixer);
        }
      }
    $('pbTime').max = String(
      $('pbPose').value === 'clip' && selected ? Math.max(0.01, selected.clip.duration) : 4,
    );
    if ($('pbPose').value === 'clip' && !mixers.length)
      setStatus('Clip tidak memiliki nama bone yang cocok dengan GLB di booth.');
  }
  function applyPose() {
    if (!stage) return;
    if ($('pbPose').value === 'clip') {
      applyBoothPose(rest, 'rest', 0);
      mixers.forEach((m) => m.setTime(time));
    } else {
      mixers.forEach((m) => m.stopAllAction());
      applyBoothPose(rest, $('pbPose').value, time);
    }
    stage.updateMatrixWorld(true);
    $('pbTime').value = String(time);
    $('pbTimeLabel').textContent = time.toFixed(2) + ' s';
    $('pbPlay').textContent = playing ? 'Ⅱ Jeda' : '▶ Putar';
    render();
  }
  function assetList(targets = []) {
    $('pbAssets').replaceChildren();
    $('pbEmpty').hidden = !!assets.length;
    for (const a of assets) {
      const card = document.createElement('article');
      card.className = 'pb-asset';
      const name = document.createElement('strong');
      name.textContent = a.name;
      card.append(name);
      const label = document.createElement('label');
      label.className = 'check';
      const visible = document.createElement('input');
      visible.type = 'checkbox';
      visible.checked = a.visible;
      visible.onchange = () => {
        a.visible = visible.checked;
        rebuild();
      };
      label.append(visible, document.createTextNode('Tampilkan · ' + a.kind));
      card.append(label);
      if (a.drawables?.length > 1) {
        const select = document.createElement('select');
        select.setAttribute('aria-label', 'Drawable ' + a.name);
        for (const [i, title] of [
          [-1, 'Semua drawable'],
          ...a.drawables.map((d, i) => [i, d.name]),
        ]) {
          const o = document.createElement('option');
          o.value = String(i);
          o.textContent = title;
          select.append(o);
        }
        select.value = String(a.drawable);
        select.onchange = () => {
          a.drawable = Number(select.value);
          rebuild();
        };
        card.append(select);
      }
      for (const slot of new Set((a.drawables || []).map((d) => d.componentSlot).filter(Boolean))) {
        const l = document.createElement('label');
        l.className = 'check';
        const c = document.createElement('input');
        c.type = 'checkbox';
        c.checked = !a.hiddenSlots.has(slot);
        c.onchange = () => {
          if (c.checked) a.hiddenSlots.delete(slot);
          else a.hiddenSlots.add(slot);
          rebuild();
        };
        l.append(c, document.createTextNode(slot));
        card.append(l);
      }
      if (a.kind !== 'ped') {
        const label = document.createElement('label');
        label.textContent = 'Ikuti bone (aksesori rigid)';
        const select = document.createElement('select');
        const auto = document.createElement('option');
        auto.value = 'auto';
        auto.textContent = 'Otomatis / rig sendiri';
        select.append(auto);
        for (const name of new Set(targets.map((b) => b.name))) {
          const o = document.createElement('option');
          o.value = name;
          o.textContent = name;
          select.append(o);
        }
        select.value = a.attach;
        select.onchange = () => {
          a.attach = select.value;
          rebuild();
        };
        label.append(select);
        card.append(label);
        const fields = document.createElement('div');
        fields.className = 'pb-offsets';
        for (let k = 0; k < 4; k++) {
          const l = document.createElement('label');
          l.textContent = ['X', 'Y', 'Z', 'Skala'][k];
          const input = document.createElement('input');
          input.type = 'number';
          input.step = '0.01';
          input.value = String(k < 3 ? a.offset[k] : a.scale);
          input.setAttribute('aria-label', l.textContent + ' ' + a.name);
          input.onchange = () => {
            const v = Number(input.value);
            if (!Number.isFinite(v) || Math.abs(v) > 100 || (k === 3 && v <= 0)) return;
            if (k < 3) a.offset[k] = v;
            else a.scale = v;
            rebuild();
          };
          l.append(input);
          fields.append(l);
        }
        card.append(fields);
      }
      const remove = document.createElement('button');
      remove.textContent = 'Hapus';
      remove.onclick = () => {
        assets = assets.filter((b) => b !== a);
        rebuild();
        disposeGlb(a);
      };
      card.append(remove);
      $('pbAssets').append(card);
    }
  }
  function disposeGlb(a) {
    if (!a.gltf) return;
    const disposed = new Set();
    a.gltf.scene.traverse((o) => {
      o.geometry?.dispose();
      if (o.skeleton && !disposed.has(o.skeleton)) {
        disposed.add(o.skeleton);
        o.skeleton.dispose();
      }
      for (const m of Array.isArray(o.material) ? o.material : [o.material])
        if (m) {
          for (const v of Object.values(m))
            if (v?.isTexture && !disposed.has(v)) {
              disposed.add(v);
              v.dispose();
            }
          m.dispose();
        }
    });
  }
  async function parseGlb(file) {
    if (file.size > 64 * 1024 ** 2) throw Error('GLB maksimal 64 MB.');
    const buffer = await file.arrayBuffer();
    if (buffer.byteLength < 20 || new DataView(buffer).getUint32(0, true) !== 0x46546c67)
      throw Error('Pilih GLB binary yang valid.');
    const manager = new THREE.LoadingManager();
    manager.setURLModifier((url) => {
      if (!/^(blob:|data:)/.test(url))
        throw Error('GLB harus menyertakan gambar/buffer di dalam file.');
      return url;
    });
    return new GLTFLoader(manager).parseAsync(buffer, '');
  }
  async function importFiles(files, assetKind) {
    if (!files.length) return;
    ensure();
    const models = files.filter((f) => /\.(ydd|ydr|yft|glb)$/i.test(f.name)),
      images = files.filter((f) => /\.(ytd|dds|png|jpg|jpeg|webp)$/i.test(f.name));
    if (assets.length + models.length > 20) throw Error('Maksimal 20 model per sesi.');
    const pending = [];
    try {
      for (const file of models) {
        if (file.size > 64 * 1024 ** 2) throw Error('Model maksimal 64 MB.');
        setStatus('Membaca ' + file.name + '…');
        const a = {
          id: ++token,
          name: file.name,
          kind: assetKind,
          visible: true,
          offset: [0, 0, 0],
          scale: 1,
          attach: 'auto',
          hiddenSlots: new Set(),
        };
        if (/\.glb$/i.test(file.name)) a.gltf = await parseGlb(file);
        else {
          a.drawables = await decodeResource(
            file.name.split('.').pop().toLowerCase(),
            await file.arrayBuffer(),
          );
          a.drawable = defaultDrawableSelection(a.drawables);
        }
        pending.push(a);
      }
      const all = [...assets, ...pending];
      const refs = modelTextureReferences(all.flatMap((a) => a.drawables || []));
      const loaded = await loadVehicleTextures(images, refs, {
        decode: decodeResource,
        image: imageData,
        existing: textures,
      });
      textures = mergeVehicleTextures(textures, loaded.textures);
      assets.push(...pending);
      rebuild();
      if (loaded.warnings.length) setStatus(loaded.warnings.join(' · '));
    } catch (e) {
      pending.filter((a) => !assets.includes(a)).forEach(disposeGlb);
      throw e;
    }
  }
  for (const [id, value] of [
    ['pbPed', 'ped'],
    ['pbClothes', 'clothing'],
    ['pbAccessory', 'accessory'],
  ])
    $(id).onclick = () => {
      kind = value;
      $('pbInput').click();
    };
  $('pbInput').onchange = (e) => {
    const files = [...e.target.files];
    e.target.value = '';
    guard(() => importFiles(files, kind));
  };
  $('pbTextures').onclick = () => $('pbTextureInput').click();
  $('pbTextureInput').onchange = (e) => {
    const files = [...e.target.files];
    e.target.value = '';
    guard(() => importFiles(files, 'texture'));
  };
  $('pbImportClip').onclick = () => $('pbClipInput').click();
  $('pbClipInput').onchange = (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (file)
      guard(async () => {
        const gltf = await parseGlb(file);
        try {
          if (!gltf.animations.length) throw Error('GLB tidak berisi animasi.');
          externalClips = gltf.animations.map((clip, i) => ({
            clip,
            id: 'external:' + i,
            label: file.name + ' / ' + clip.name,
          }));
          $('pbPose').value = 'clip';
          updateClips();
          time = 0;
          applyPose();
          setControls();
        } finally {
          disposeGlb({ gltf });
        }
      });
  };
  $('pbClear').onclick = () => {
    playing = false;
    if (stage) clearStage();
    assets.forEach(disposeGlb);
    assets = [];
    textures = [];
    animatedMeshes = 0;
    externalClips = [];
    time = 0;
    assetList();
    setControls();
    setStatus('Booth kosong.');
    render();
  };
  $('pbPose').onchange = () => {
    playing = false;
    time = 0;
    updateClips();
    applyPose();
    setControls();
  };
  $('pbClip').onchange = () => {
    time = 0;
    updateClips();
    applyPose();
  };
  $('pbPlay').onclick = () => {
    playing = !playing;
    if ($('pbPose').value === 'clip') updateClips();
    last = 0;
    applyPose();
  };
  $('pbResetPose').onclick = () => {
    playing = false;
    time = 0;
    $('pbPose').value = 'relaxed';
    applyPose();
    fit();
  };
  $('pbTime').oninput = () => {
    playing = false;
    time = Number($('pbTime').value);
    applyPose();
  };
  $('pbSize').onchange = () => {
    resize();
    fit();
  };
  $('pbFit').onclick = () => fit();
  $('pbFront').onclick = () => fit(new THREE.Vector3(0, 0, -1));
  $('pbBack').onclick = () => fit(new THREE.Vector3(0, 0, 1));
  for (const id of ['pbBackground', 'pbTransparent', 'pbFloor', 'pbLight']) $(id).oninput = render;
  $('pbCapture').onclick = () =>
    guard(async () => {
      playing = false;
      applyPose();
      const [w, h] = $('pbSize').value.split('x').map(Number);
      const aspect = camera.aspect;
      try {
        renderer.setPixelRatio(1);
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        render();
        const blob = await new Promise((r) => renderer.domElement.toBlob(r, 'image/png'));
        if (!blob) throw Error('Gagal membuat PNG.');
        setStatus(
          (await download(blob, 'ditasha-photo-booth.png', 'image/png'))
            ? 'Foto tersimpan.'
            : 'Simpan dibatalkan.',
        );
      } finally {
        camera.aspect = aspect;
        resize();
      }
    });
  root.addEventListener('dragover', (e) => e.preventDefault());
  root.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    guard(() => importFiles([...e.dataTransfer.files], kind));
  });
  function tick(now) {
    if (!active) {
      raf = 0;
      return;
    }
    raf = requestAnimationFrame(tick);
    if (playing && !busy && now - last > 33) {
      const delta = last ? Math.min((now - last) / 1000, 0.1) : 0;
      last = now;
      time = (time + delta) % Number($('pbTime').max);
      applyPose();
    }
  }
  return {
    root,
    setActive(value) {
      active = value;
      if (value) {
        ensure();
        resize();
        if (!raf) raf = requestAnimationFrame(tick);
      } else {
        playing = false;
        last = 0;
        if (raf) cancelAnimationFrame(raf);
        raf = 0;
      }
    },
    importFiles,
  };
}
