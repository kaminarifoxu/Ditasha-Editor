import { MAX_DECODED_TEXTURE_BYTES } from './texture-memory.js';
import { createBoothLibrary, validateBoothScene } from './booth-library.js';
import { createActorMotion, actorForAsset, advanceActorMotion } from './booth-actors.js';
import * as THREE from 'three';
import { fitPhotoshoot } from './photoshoot-framing.js';
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
  <div class="pb-layout"><aside class="pb-panel pb-assets"><h2>Model & outfit</h2><div class="pb-buttons"><button id="pbPed">+ Ped / tubuh</button><button id="pbClothes">+ Baju</button><button id="pbAccessory">+ Aksesori</button><button id="pbTextures">+ Tekstur</button></div><input id="pbInput" type="file" accept=".ydd,.ydr,.yft,.ytd,.glb" multiple hidden><input id="pbTextureInput" type="file" accept=".ytd,.dds,.png,.jpg,.jpeg,.webp" multiple hidden><p class="muted">Masukkan YDD + YTD. YFT skeleton pendamping dapat ditambahkan. GLB rigged juga didukung.</p><div id="pbAssets"></div><p id="pbEmpty">Belum ada model. Mulai dari ped / tubuh milikmu.</p><button id="pbClear">Kosongkan booth</button><h2 class="pb-library-heading">Library lokal</h2><label>Nama preset<input id="pbLibraryName" maxlength="80" placeholder="Foto grup / outfit favorit"></label><button id="pbLibrarySave">Simpan scene & outfit</button><button id="pbLibraryRefresh">Muat daftar library</button><input id="pbLibrarySearch" placeholder="Cari preset ped / outfit…" aria-label="Cari library"><div id="pbLibraryList"></div></aside>
  <section class="pb-stage"><div class="pb-stage-toolbar"><button id="pbFit">Fit tubuh</button><button id="pbFront">Depan</button><button id="pbBack">Belakang</button><label class="check"><input id="pbFloor" type="checkbox" checked>Lantai</label><span>Drag: orbit · scroll: zoom</span></div><div id="pbViewport"></div><p id="pbStatus" role="status">Siap untuk sesi foto offline.</p></section>
  <aside class="pb-panel pb-settings"><h2>Pose & emote per ped</h2><label>Ped yang diatur<select id="pbActor"></select></label><p class="muted">Pose, clip dan frame hanya berubah untuk ped yang dipilih. Outfit mengikuti pemiliknya.</p><label>Pose<select id="pbPose">${BOOTH_POSES.map(([id, label]) => `<option value="${id}">${label}</option>`).join('')}<option value="clip">Clip GLB</option></select></label><div class="pb-buttons"><button id="pbPlay" disabled>▶ Putar</button><button id="pbResetPose">Reset pose</button><button id="pbPlayAll">Putar semua</button><button id="pbPauseAll">Jeda semua</button></div><label>Kecepatan<input id="pbSpeed" type="number" min="0.1" max="3" step="0.1" value="1"></label><label>Frame / waktu <output id="pbTimeLabel">0.00 s</output><input id="pbTime" type="range" min="0" max="4" step="0.01" value="0"></label><button id="pbImportClip">+ Animasi GLB</button><input id="pbClipInput" type="file" accept=".glb" hidden><label id="pbClipField" hidden>Clip<select id="pbClip"></select></label><p id="pbRigStatus" class="muted" role="status">Pose memerlukan skeleton dan skin weights yang cocok.</p><h2>Studio</h2><label>Background<input id="pbBackground" type="color" value="#242938"></label><label class="check"><input id="pbTransparent" type="checkbox">PNG transparan</label><label>Cahaya<input id="pbLight" type="range" min="0.3" max="3" value="1" step="0.05"></label><label>Resolusi foto<select id="pbSize"><option value="1080x1350">1080 × 1350 · katalog</option><option value="1920x1080">1920 × 1080 · landscape</option><option value="2048x2048">2048 × 2048 · square</option><option value="3000x4000">3000 × 4000 · portrait</option></select></label><p class="muted">Pose/emote bawaan dibuat untuk preview. Animasi GLB memakai nama bone yang cocok; binary YCD belum didukung di booth.</p></aside></div>`;
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
    token = 0,
    selectedActor = null,
    actorFrames = new Map(),
    textureFiles = [],
    textureOwners = [],
    clipFiles = [],
    clipSerial = 0;
  const library = createBoothLibrary();
  const actors = () => assets.filter((a) => actorForAsset(assets, a) === a);
  const currentActor = () => actors().find((a) => a.id === selectedActor) || actors()[0];
  function saveMotion() {
    const a = currentActor();
    if (a)
      Object.assign(a.motion, {
        pose: $('pbPose').value,
        clip: $('pbClip').value,
        time,
        playing,
        speed: Number($('pbSpeed').value) || 1,
      });
  }
  function loadMotion() {
    const a = currentActor();
    if (!a) {
      time = 0;
      playing = false;
      return;
    }
    selectedActor = a.id;
    const m = a.motion;
    $('pbPose').value = m.pose;
    $('pbSpeed').value = m.speed;
    time = m.time;
    playing = m.playing;
  }
  function actorPicker() {
    const a = currentActor();
    selectedActor = a?.id ?? null;
    $('pbActor').replaceChildren(
      ...actors().map((a, index) => {
        const o = document.createElement('option');
        o.value = a.id;
        o.textContent = index + 1 + ' · ' + a.name;
        return o;
      }),
    );
    $('pbActor').value = String(selectedActor);
    loadMotion();
  }
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
    for (const id of [
      'pbPed',
      'pbClothes',
      'pbAccessory',
      'pbTextures',
      'pbClear',
      'pbImportClip',
      'pbActor',
      'pbPlayAll',
      'pbPauseAll',
      'pbLibrarySave',
      'pbLibraryRefresh',
    ])
      $(id).disabled = busy;
    $('pbAssets')
      .querySelectorAll('button,input,select')
      .forEach((e) => (e.disabled = busy));
    $('pbLibrarySave').disabled = busy || !assets.length;
    const owner = currentActor(),
      frame = owner && actorFrames.get(owner.id);
    let ownAnimated = false;
    frame?.traverse((o) => {
      if (o.isSkinnedMesh) ownAnimated = true;
    });
    const movable =
      $('pbPose').value === 'clip'
        ? mixers.some((m) => m.userData.actor === owner?.id)
        : ownAnimated && rest.some((r) => r.role && frame?.getObjectById(r.bone.id));
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
    const dir = direction || camera.position.clone().sub(controls.target).normalize();
    const corners = [];
    for (const x of [box.min.x, box.max.x])
      for (const y of [box.min.y, box.max.y])
        for (const z of [box.min.z, box.max.z]) corners.push(x, y, z);
    const { center, distance, depth } = fitPhotoshoot(
      corners,
      dir,
      camera.up,
      camera.aspect,
      camera.fov,
      0.98,
    );
    camera.position.copy(center).addScaledVector(dir, distance);
    camera.near = Math.max(0.0001, distance / 10000);
    camera.far = Math.max(100, distance + depth * 2 + 1);
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
    clearStage();
    actorFrames = new Map();
    for (const a of actors()) {
      const frame = new THREE.Group();
      actorFrames.set(a.id, frame);
      stage.add(frame);
    }
    const warnings = [];
    let skinned = 0,
      staticMeshes = 0;
    for (const a of assets) {
      a.root = new THREE.Group();
      a.root.name = a.name;
      a.root.visible = a.visible;
      const owner = actorForAsset(assets, a);
      actorFrames.get(owner.id).add(a.root);
      const fallback = assets
        .filter((b) => actorForAsset(assets, b) === owner)
        .flatMap((b) => b.drawables || [])
        .map((d) => d.rig)
        .filter((r) => r?.length)
        .sort((a, b) => b.length - a.length)[0];
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
          const ownTextures = textures.filter(
            (t) => t.boothOwner == null || t.boothOwner === a.id || t.boothOwner === owner.id,
          );
          const embedded = d.embeddedTextures || [],
            t = resolveModelTexture(g.diffuseTexture, ownTextures, embedded, a.name);
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
          setSurfaceMaps(
            material,
            resolveSurfaceMaps(g, ownTextures, embedded, a.name),
            textureMap,
          );
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
    // Bind each accessory to its own actor, never to another ped's skeleton.
    for (const a of assets)
      if (a.kind !== 'ped' && a.attach !== 'auto') {
        const owner = actorForAsset(assets, a);
        let bone;
        owner.root.traverse((o) => {
          if (!bone && o.isBone && o.name === a.attach) bone = o;
        });
        if (bone) bone.attach(a.root);
        else warnings.push(a.name + ': bone tujuan tidak ditemukan');
      }
    for (const a of assets) {
      const owner = actorForAsset(assets, a);
      if (a !== owner) {
        a.root.position.add(new THREE.Vector3(...a.offset));
        a.root.scale.multiplyScalar(a.scale);
        a.root.rotateY(((a.yaw || 0) * Math.PI) / 180);
      }
    }
    for (const a of actors()) {
      const frame = actorFrames.get(a.id);
      frame.position.set(...a.offset);
      frame.rotation.y = ((a.yaw || 0) * Math.PI) / 180;
      frame.scale.setScalar(a.scale);
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
    actorPicker();
    updateClips();
    applyPose();
    assetList();
    setControls();
    setStatus(
      warnings.length
        ? [...new Set(warnings)].slice(0, 10).join(' · ')
        : `${assets.length} aset · siap foto. File sumber tetap utuh.`,
    );
    fit();
  }
  function clipsFor(actor) {
    return [
      ...assets
        .filter((a) => actorForAsset(assets, a) === actor)
        .flatMap((a) =>
          (a.gltf?.animations || []).map((clip, i) => ({
            clip,
            id: a.id + ':' + i,
            label: a.name + ' / ' + clip.name,
          })),
        ),
      ...externalClips,
    ];
  }
  function updateClips() {
    const actor = currentActor(),
      clips = actor ? clipsFor(actor) : [];
    $('pbClip').replaceChildren(
      ...clips.map((c) => {
        const o = document.createElement('option');
        o.value = c.id;
        o.textContent = c.label;
        return o;
      }),
    );
    if (actor && clips.some((c) => c.id === actor.motion.clip))
      $('pbClip').value = actor.motion.clip;
    if (actor) actor.motion.clip = $('pbClip').value;
    $('pbClipField').hidden = !clips.length;
    mixers.forEach((m) => {
      m.stopAllAction();
      m.uncacheRoot(m.getRoot());
    });
    mixers = [];
    for (const owner of actors()) {
      const selected = clipsFor(owner).find((c) => c.id === owner.motion.clip);
      if (!selected) continue;
      for (const a of assets.filter((a) => a.gltf && actorForAsset(assets, a) === owner)) {
        const names = new Set();
        a.gltf.scene.traverse((o) => names.add(o.name));
        const tracks = selected.clip.tracks.filter((t) => {
          try {
            return names.has(THREE.PropertyBinding.parseTrackName(t.name).nodeName);
          } catch {
            return false;
          }
        });
        if (tracks.length) {
          const mixer = new THREE.AnimationMixer(a.gltf.scene);
          mixer.userData = { actor: owner.id };
          mixer
            .clipAction(new THREE.AnimationClip(selected.clip.name, selected.clip.duration, tracks))
            .play();
          mixers.push(mixer);
        }
      }
    }
    const selected = actor && clips.find((c) => c.id === actor.motion.clip);
    $('pbTime').max = String(
      actor?.motion.pose === 'clip' && selected ? Math.max(0.01, selected.clip.duration) : 4,
    );
  }
  function applyPose() {
    if (!stage) return;
    for (const actor of actors()) {
      const m = actor.motion;
      const bones = rest.filter((r) => {
        let o = r.bone;
        while (o && o !== actorFrames.get(actor.id)) o = o.parent;
        return !!o;
      });
      const ownMixers = mixers.filter((m) => m.userData.actor === actor.id);
      if (m.pose === 'clip') {
        applyBoothPose(bones, 'rest', 0);
        ownMixers.forEach((mixer) => mixer.setTime(m.time));
      } else {
        ownMixers.forEach((mixer) => mixer.stopAllAction());
        applyBoothPose(
          bones,
          m.pose,
          m.time,
          actorFrames.get(actor.id).getWorldQuaternion(new THREE.Quaternion()),
        );
      }
    }
    stage.updateMatrixWorld(true);
    loadMotion();
    $('pbTime').value = String(time);
    $('pbTimeLabel').textContent = time.toFixed(2) + ' s';
    $('pbPlay').textContent = playing ? 'Ⅱ Jeda' : '▶ Putar';
    render();
  }
  function assetList() {
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
        const ownerLabel = document.createElement('label');
        ownerLabel.textContent = 'Pemilik outfit / aksesori';
        const ownerSelect = document.createElement('select');
        ownerSelect.dataset.owner = a.id;
        for (const ped of assets.filter((a) => a.kind === 'ped')) {
          const o = document.createElement('option');
          o.value = ped.id;
          o.textContent =
            assets.filter((b) => b.kind === 'ped').indexOf(ped) + 1 + ' · ' + ped.name;
          ownerSelect.append(o);
        }
        ownerSelect.value = String(a.owner);
        ownerSelect.onchange = () => {
          a.owner = Number(ownerSelect.value);
          a.attach = 'auto';
          rebuild();
        };
        ownerLabel.append(ownerSelect);
        card.append(ownerLabel);
        const targets = [];
        actorForAsset(assets, a).root.traverse((o) => {
          if (o.isBone) targets.push(o);
        });
        const label = document.createElement('label');
        label.textContent = 'Ikuti bone (aksesori rigid)';
        const select = document.createElement('select');
        select.dataset.bone = a.id;
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
      }
      {
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
        const turn = document.createElement('input');
        turn.type = 'number';
        turn.min = '-360';
        turn.max = '360';
        turn.step = '5';
        turn.value = a.yaw || 0;
        turn.setAttribute('aria-label', 'Rotasi ' + a.name);
        turn.onchange = () => {
          const v = Number(turn.value);
          if (!Number.isFinite(v) || Math.abs(v) > 360) return;
          a.yaw = v;
          rebuild();
        };
        if (a.kind === 'ped') {
          const label = document.createElement('label');
          label.textContent = 'Arah ped · derajat';
          label.append(turn);
          card.append(label);
          const select = document.createElement('button');
          select.textContent = 'Atur emote ped ini';
          select.onclick = () => {
            saveMotion();
            selectedActor = a.id;
            actorPicker();
            updateClips();
            applyPose();
            setControls();
          };
          card.append(select);
        }
        card.append(fields);
      }
      const remove = document.createElement('button');
      remove.textContent = 'Hapus';
      remove.onclick = () => {
        const dependents = assets.filter((b) => b.owner === a.id);
        for (const b of dependents) {
          b.owner = null;
          b.motion = { ...a.motion, playing: false };
        }
        const kept = textureFiles
          .map((file, i) => ({ file, owner: textureOwners[i] }))
          .filter((row) => row.owner !== a.id);
        textureFiles = kept.map((row) => row.file);
        textureOwners = kept.map((row) => row.owner);
        textures = textures.filter((t) => t.boothOwner !== a.id);
        assets = assets.filter((b) => b !== a);
        loadMotion();
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
          file,
          offset: [
            assetKind === 'ped'
              ? (assets.filter((a) => a.kind === 'ped').length +
                  pending.filter((a) => a.kind === 'ped').length) *
                1.5
              : 0,
            0,
            0,
          ],
          yaw: 0,
          owner: assetKind === 'ped' ? null : currentActor()?.id,
          motion: createActorMotion(),
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
      if (assetKind === 'ped') {
        const primaries = pending.filter((a) => !/\.yft$/i.test(a.name));
        for (const a of pending.filter((a) => /\.yft$/i.test(a.name))) {
          const stem = a.name.replace(/\.[^.]+$/, '').toLowerCase();
          const owner =
            primaries.find((b) => b.name.replace(/\.[^.]+$/, '').toLowerCase() === stem) ||
            (primaries.length === 1 ? primaries[0] : null);
          if (owner) {
            a.kind = 'accessory';
            a.owner = owner.id;
            a.offset = [0, 0, 0];
          }
        }
        pending
          .filter((a) => a.kind === 'ped')
          .forEach((a, i) => {
            a.offset[0] = (assets.filter((b) => b.kind === 'ped').length + i) * 1.5;
          });
      }
      const all = [...assets, ...pending];
      const refs = modelTextureReferences(all.flatMap((a) => a.drawables || []));
      const warnings = [];
      for (const file of images) {
        const stem = file.name.replace(/\.[^.]+$/, '').toLowerCase();
        const target =
          pending.find((a) => a.name.replace(/\.[^.]+$/, '').toLowerCase() === stem) ||
          pending[0] ||
          currentActor();
        const loaded = await loadVehicleTextures([file], refs, {
          decode: decodeResource,
          image: imageData,
          existing: textures,
        });
        const ownerId = target?.id ?? null;
        const merged = [
          ...textures.filter((t) => t.boothOwner !== ownerId),
          ...mergeVehicleTextures(
            textures.filter((t) => t.boothOwner === ownerId),
            loaded.textures.map((t) => ({ ...t, boothOwner: ownerId })),
          ),
        ];
        if (merged.reduce((n, t) => n + t.out.length, 0) > MAX_DECODED_TEXTURE_BYTES)
          throw Error('Tekstur booth melebihi batas decoded 1024 MB.');
        textures = merged;
        textureFiles.push(file);
        textureOwners.push(ownerId);
        warnings.push(...loaded.warnings);
      }
      saveMotion();
      assets.push(...pending);
      if (pending.some((a) => a.kind === 'ped'))
        selectedActor = pending.find((a) => a.kind === 'ped').id;
      loadMotion();
      rebuild();
      if (warnings.length) setStatus(warnings.join(' · '));
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
        if (clipFiles.length >= 32) throw Error('Maksimal 32 file emote dalam satu sesi.');
        const gltf = await parseGlb(file);
        try {
          if (gltf.animations.length > 256) throw Error('GLB emote maksimal 256 clip.');
          if (!gltf.animations.length) throw Error('GLB tidak berisi animasi.');
          const prefix = 'external:' + ++clipSerial;
          externalClips.push(
            ...gltf.animations.map((clip, i) => ({
              clip,
              id: prefix + ':' + i,
              label: file.name + ' / ' + clip.name,
            })),
          );
          clipFiles.push({ file, prefix });
          $('pbPose').value = 'clip';
          time = 0;
          saveMotion();
          if (currentActor()) currentActor().motion.clip = prefix + ':0';
          updateClips();
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
    textureFiles = [];
    textureOwners = [];
    clipFiles = [];
    time = 0;
    selectedActor = null;
    actorPicker();
    assetList();
    setControls();
    setStatus('Booth kosong.');
    render();
  };
  $('pbPose').onchange = () => {
    playing = false;
    time = 0;
    saveMotion();
    updateClips();
    applyPose();
    setControls();
  };
  $('pbClip').onchange = () => {
    time = 0;
    saveMotion();
    updateClips();
    applyPose();
  };
  $('pbPlay').onclick = () => {
    playing = !playing;
    if ($('pbPose').value === 'clip') updateClips();
    last = 0;
    saveMotion();
    applyPose();
  };
  $('pbResetPose').onclick = () => {
    playing = false;
    time = 0;
    $('pbPose').value = 'relaxed';
    saveMotion();
    applyPose();
    fit();
  };
  $('pbTime').oninput = () => {
    playing = false;
    time = Number($('pbTime').value);
    saveMotion();
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
      for (const a of actors()) a.motion.playing = false;
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
    if (!busy && now - last > 33) {
      const delta = last ? Math.min((now - last) / 1000, 0.1) : 0;
      last = now;
      let changed = false;
      for (const a of actors())
        if (a.motion.playing) {
          const clip = clipsFor(a).find((c) => c.id === a.motion.clip);
          advanceActorMotion(
            a.motion,
            delta,
            a.motion.pose === 'clip' && clip ? Math.max(0.01, clip.clip.duration) : 4,
          );
          changed = true;
        }
      if (changed) applyPose();
    }
  }
  $('pbActor').onchange = () => {
    saveMotion();
    selectedActor = Number($('pbActor').value);
    loadMotion();
    updateClips();
    applyPose();
    setControls();
  };
  $('pbSpeed').onchange = () => {
    const speed = Number($('pbSpeed').value);
    if (!Number.isFinite(speed) || speed < 0.1 || speed > 3) {
      $('pbSpeed').value = currentActor()?.motion.speed || 1;
      return;
    }
    saveMotion();
  };
  $('pbPlayAll').onclick = () => {
    saveMotion();
    for (const a of actors()) a.motion.playing = true;
    last = 0;
    updateClips();
    applyPose();
  };
  $('pbPauseAll').onclick = () => {
    for (const a of actors()) a.motion.playing = false;
    applyPose();
  };

  async function refreshLibrary() {
    const rows = await library.list();
    $('pbLibraryList').replaceChildren();
    for (const row of rows.filter((row) =>
      row.name.toLowerCase().includes($('pbLibrarySearch').value.trim().toLowerCase()),
    )) {
      const card = document.createElement('article');
      card.className = 'pb-asset';
      if (row.thumbnail) {
        const img = document.createElement('img');
        img.src = row.thumbnail;
        img.alt = 'Preview ' + row.name;
        img.width = 128;
        card.append(img);
      }
      const name = document.createElement('strong');
      name.textContent = row.name;
      card.append(name);
      const load = document.createElement('button');
      load.textContent = 'Buka preset';
      load.dataset.libraryLoad = row.id;
      load.onclick = () =>
        guard(async () => {
          await restoreScene(await library.get(row.id));
        });
      const remove = document.createElement('button');
      remove.textContent = 'Hapus preset';
      remove.onclick = () =>
        guard(async () => {
          await library.remove(row.id);
          await refreshLibrary();
        });
      card.append(load, remove);
      $('pbLibraryList').append(card);
    }
  }
  function snapshotScene() {
    saveMotion();
    const small = document.createElement('canvas');
    small.width = 160;
    small.height = 200;
    small.getContext('2d').drawImage(renderer.domElement, 0, 0, 160, 200);
    return {
      version: 1,
      name: $('pbLibraryName').value,
      thumbnail: small.toDataURL('image/png'),
      assets: assets.map((a) => ({
        file: a.file,
        kind: a.kind,
        oldId: a.id,
        ownerIndex: a.owner == null ? null : assets.findIndex((b) => b.id === a.owner),
        offset: [...a.offset],
        yaw: a.yaw || 0,
        scale: a.scale,
        visible: a.visible,
        motion: { ...a.motion, playing: false },
        drawable: a.drawable,
        hiddenSlots: [...a.hiddenSlots],
        attach: a.attach,
      })),
      textureFiles,
      textureOwners: textureOwners.map((id) =>
        id == null ? null : assets.findIndex((a) => a.id === id),
      ),
      clipFiles,
    };
  }
  async function restoreScene(record) {
    validateBoothScene(record);
    const pending = [],
      newClips = [];
    try {
      for (const source of record.assets) {
        const a = {
          ...source,
          id: ++token,
          name: source.file.name,
          hiddenSlots: new Set(source.hiddenSlots || []),
          motion: { ...source.motion, playing: false },
        };
        if (/\.glb$/i.test(a.name)) a.gltf = await parseGlb(a.file);
        else
          a.drawables = await decodeResource(
            a.name.split('.').pop().toLowerCase(),
            await a.file.arrayBuffer(),
          );
        pending.push(a);
      }
      for (const a of pending) {
        a.owner = a.ownerIndex === null ? null : pending[a.ownerIndex].id;
        if (a.motion.clip && !a.motion.clip.startsWith('external:')) {
          const [old, index] = a.motion.clip.split(':');
          const original = record.assets.findIndex((s) => String(s.oldId) === old);
          if (original >= 0) a.motion.clip = pending[original].id + ':' + index;
        }
      }
      const refs = modelTextureReferences(pending.flatMap((a) => a.drawables || []));
      let restoredTextures = [];
      for (const [i, file] of record.textureFiles.entries()) {
        const loaded = await loadVehicleTextures([file], refs, {
          decode: decodeResource,
          image: imageData,
          existing: restoredTextures,
        });
        if (loaded.warnings.length) throw Error(loaded.warnings.join(' · '));
        const ownerIndex = record.textureOwners?.[i],
          ownerId = ownerIndex == null ? null : pending[ownerIndex].id;
        restoredTextures = [
          ...restoredTextures.filter((t) => t.boothOwner !== ownerId),
          ...mergeVehicleTextures(
            restoredTextures.filter((t) => t.boothOwner === ownerId),
            loaded.textures.map((t) => ({ ...t, boothOwner: ownerId })),
          ),
        ];
        if (restoredTextures.reduce((n, t) => n + t.out.length, 0) > MAX_DECODED_TEXTURE_BYTES)
          throw Error('Tekstur preset terlalu besar.');
      }
      for (const c of record.clipFiles) {
        const gltf = await parseGlb(c.file);
        try {
          newClips.push(
            ...gltf.animations.map((clip, i) => ({
              clip,
              id: c.prefix + ':' + i,
              label: c.file.name + ' / ' + clip.name,
            })),
          );
        } finally {
          disposeGlb({ gltf });
        }
      }
      if (stage) clearStage();
      assets.forEach(disposeGlb);
      assets = pending;
      textures = restoredTextures;
      textureFiles = [...record.textureFiles];
      textureOwners = record.textureFiles.map((_, i) =>
        record.textureOwners?.[i] == null ? null : pending[record.textureOwners[i]].id,
      );
      clipFiles = [...record.clipFiles];
      externalClips = newClips;
      clipSerial = Math.max(clipSerial, ...clipFiles.map((c) => Number(c.prefix.split(':')[1])));
      selectedActor = actors()[0]?.id;
      loadMotion();
      rebuild();
      $('pbLibraryName').value = record.name;
      setStatus('Preset dibuka. Pose tiap ped dipertahankan; playback dijeda.');
    } catch (e) {
      pending.filter((a) => !assets.includes(a)).forEach(disposeGlb);
      throw e;
    }
  }
  $('pbLibrarySave').onclick = () =>
    guard(async () => {
      await library.save(snapshotScene());
      await refreshLibrary();
      setStatus('Scene, outfit dan emote tersimpan di library lokal.');
    });
  $('pbLibraryRefresh').onclick = () => guard(refreshLibrary);
  $('pbLibrarySearch').oninput = () => refreshLibrary().catch((e) => setStatus(e.message));
  return {
    root,
    setActive(value) {
      active = value;
      if (value) {
        ensure();
        setControls();
        resize();
        if (!raf) raf = requestAnimationFrame(tick);
      } else {
        for (const a of actors()) a.motion.playing = false;
        playing = false;
        last = 0;
        if (raf) cancelAnimationFrame(raf);
        raf = 0;
      }
    },
    importFiles,
  };
}
