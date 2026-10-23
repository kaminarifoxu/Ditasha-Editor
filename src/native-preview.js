import { decodeMotion, sampleMotion } from './motion-preview.js';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { managePreview } from './performance.js';
export function nativeOffsetFromThree(position) {
  return [position.x, -position.z, position.y].map(
    (v) => Math.round(Math.max(-20, Math.min(20, v)) * 1000) / 1000,
  );
}
export function mountNativePreview({ container, toast, onPick, onTransform }) {
  container.innerHTML = `<div class="viewer-button-row"><button id="nbPreviewLoad">Muat preview 3D</button><button id="nbPreviewFit">Fit</button><button id="nbMotionPlay" disabled>Play walk test</button><label id="nbMotionSpeedLabel" hidden>Speed<select id="nbMotionSpeed"><option value="0.5">0.5×</option><option value="1" selected>1×</option><option value="1.5">1.5×</option></select></label><button id="nbPreviewPlace">Letakkan strobo</button><label class="check"><input id="nbPreviewRemoved" type="checkbox">Lihat tanpa badge</label></div><div id="nbViewport"><p class="muted">Pilih YFT dan engine, lalu muat preview. Klik badge untuk memilih; geser sumbu untuk memindahkan strobo.</p></div><p id="nbPreviewStatus" class="muted" role="status"></p>`;
  const $ = (id) => container.querySelector('#' + id),
    viewport = $('nbViewport');
  let renderer,
    controls,
    gizmo,
    budget,
    mode = 'debadge',
    selected = new Set(),
    placing = false,
    serial = 0,
    sourcePreview = false,
    motion = null,
    motionFrame = null,
    motionStart = 0,
    motionLast = 0,
    motionBuffer = null,
    motionRest = [];
  const scene = new THREE.Scene(),
    camera = new THREE.PerspectiveCamera(40, 1, 0.01, 1000);
  const base = new THREE.Group(),
    donor = new THREE.Group(),
    donorAnchor = new THREE.Vector3();
  scene.background = new THREE.Color(0x202128);
  scene.add(base, donor, new THREE.HemisphereLight(0xffffff, 0x526079, 2.5));
  const light = new THREE.DirectionalLight(0xffffff, 3);
  light.position.set(3, 5, 4);
  scene.add(light);
  let maps = [],
    down = null;
  const render = () => budget?.invalidate();
  function init() {
    if (renderer) return;
    renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    viewport.replaceChildren(renderer.domElement);
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    budget = managePreview({ renderer, camera, scene, controls, container: viewport, toast });
    gizmo = new TransformControls(camera, renderer.domElement);
    gizmo.setMode('translate');
    scene.add(gizmo.getHelper());
    gizmo.addEventListener('dragging-changed', (e) => (controls.enabled = !e.value));
    gizmo.addEventListener('objectChange', () => {
      const offset = nativeOffsetFromThree(
        donor.position
          .clone()
          .sub(donorAnchor.clone().applyQuaternion(donor.quaternion).multiplyScalar(donor.scale.x)),
      );
      donor.position
        .copy(donorAnchor.clone().applyQuaternion(donor.quaternion).multiplyScalar(donor.scale.x))
        .add(new THREE.Vector3(offset[0], offset[2], -offset[1]));
      onTransform(offset);
      render();
    });
    renderer.domElement.addEventListener(
      'pointerdown',
      (e) => (down = { x: e.clientX, y: e.clientY }),
    );
    renderer.domElement.addEventListener('pointerup', (e) => {
      if (
        !down ||
        Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5 ||
        gizmo.dragging ||
        gizmo.axis ||
        e.button !== 0
      )
        return;
      const rect = renderer.domElement.getBoundingClientRect(),
        ray = new THREE.Raycaster();
      ray.setFromCamera(
        new THREE.Vector2(
          ((e.clientX - rect.left) / rect.width) * 2 - 1,
          (-(e.clientY - rect.top) / rect.height) * 2 + 1,
        ),
        camera,
      );
      const hit = ray.intersectObjects(base.children).find((h) => h.object.visible);
      if (!hit) return;
      if (['strobo', 'parts'].includes(mode) && placing && donor.children.length) {
        const anchor = donorAnchor
          .clone()
          .applyQuaternion(donor.quaternion)
          .multiplyScalar(donor.scale.x);
        const offset = nativeOffsetFromThree(hit.point.clone().sub(anchor));
        donor.position
          .copy(donorAnchor.clone().applyQuaternion(donor.quaternion).multiplyScalar(donor.scale.x))
          .add(new THREE.Vector3(offset[0], offset[2], -offset[1]));
        onTransform(offset);
        placing = false;
        showMode();
      } else if (mode === 'debadge' && hit.object.userData.candidate)
        onPick(hit.object.userData.candidate);
      else if (mode === 'ped')
        $('nbPreviewStatus').textContent =
          hit.object.name +
          (sourcePreview
            ? ' · model sumber, belum dirig.'
            : ' · periksa deformasi pada setiap pose.');
      else
        $('nbPreviewStatus').textContent =
          hit.object.name + ' · bukan kandidat badge dari analisis engine.';
    });
  }
  function clear() {
    stopMotion();
    motion = null;
    motionBuffer = null;
    motionRest = [];
    $('nbMotionPlay').disabled = true;
    $('nbMotionSpeedLabel').hidden = true;
    serial++;
    for (const root of [base, donor]) {
      for (const m of [...root.children]) {
        root.remove(m);
        m.geometry.dispose();
        m.material.dispose();
      }
    }
    for (const m of maps) m.dispose();
    maps = [];
    gizmo?.detach();
    donorAnchor.set(0, 0, 0);
    donor.position.set(0, 0, 0);
    donor.scale.setScalar(1);
    selected.clear();
    placing = false;
    $('nbPreviewStatus').textContent = 'Preview belum dimuat untuk file ini.';
    render();
  }
  function fit() {
    if (!controls || !base.children.length) return;
    const box = new THREE.Box3().setFromObject(base);
    if (donor.visible && donor.children.length) box.union(new THREE.Box3().setFromObject(donor));
    const center = box.getCenter(new THREE.Vector3()),
      distance = Math.max(...box.getSize(new THREE.Vector3()).toArray(), 0.1) * 2;
    controls.target.copy(center);
    camera.position.copy(center).add(new THREE.Vector3(distance * 0.6, distance * 0.35, distance));
    camera.near = Math.max(0.001, distance / 1000);
    camera.far = distance * 1000;
    camera.updateProjectionMatrix();
    controls.update();
    render();
  }
  function showMode() {
    donor.visible = ['strobo', 'parts'].includes(mode);
    $('nbPreviewPlace').hidden = !['strobo', 'parts'].includes(mode);
    $('nbPreviewPlace').classList.toggle('active', placing);
    $('nbPreviewRemoved').closest('label').hidden = mode !== 'debadge';
    if (gizmo) {
      gizmo.detach();
      if (['strobo', 'parts'].includes(mode) && donor.children.length) gizmo.attach(donor);
    }
    updateSelection(selected);
    render();
  }
  function updateSelection(names) {
    selected = new Set(names);
    for (const mesh of base.children) {
      const active = mode === 'debadge' && selected.has(mesh.userData.candidate);
      mesh.visible = !(active && $('nbPreviewRemoved').checked);
      mesh.material.emissive.set(active ? 0xc73249 : 0);
      mesh.material.emissiveIntensity = active ? 0.6 : 0;
    }
    for (const mesh of donor.children) {
      mesh.visible = mode !== 'parts' || selected.has(mesh.name);
      mesh.material.emissive.set(mode === 'parts' && selected.has(mesh.name) ? 0x334477 : 0);
    }
    if (mode === 'parts') {
      const box = new THREE.Box3();
      for (const mesh of donor.children.filter((mesh) => mesh.visible)) {
        mesh.geometry.computeBoundingBox();
        box.union(mesh.geometry.boundingBox);
      }
      if (!box.isEmpty()) {
        const shift = box.getCenter(new THREE.Vector3());
        for (const mesh of donor.children) mesh.geometry.translate(-shift.x, -shift.y, -shift.z);
        donorAnchor.add(shift);
        donor.position.addScaledVector(shift.applyQuaternion(donor.quaternion), donor.scale.x);
      }
    }
    render();
  }
  function setTransform(offset, scale, rotation = [0, 0, 0]) {
    if (
      !offset.every((v) => Number.isFinite(v) && Math.abs(v) <= 20) ||
      !rotation.every((v) => Number.isFinite(v) && Math.abs(v) <= 360) ||
      !Number.isFinite(scale) ||
      scale < 0.1 ||
      scale > 5
    )
      return;
    const basis = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
    const native = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(...rotation.map(THREE.MathUtils.degToRad), 'XYZ'),
    );
    donor.quaternion.copy(basis).multiply(native).multiply(basis.clone().invert());
    donor.position
      .set(offset[0], offset[2], -offset[1])
      .addScaledVector(donorAnchor.clone().applyQuaternion(donor.quaternion), scale);
    donor.scale.setScalar(scale);
    render();
  }
  async function load(data, { preserveCamera = false } = {}) {
    clear();
    sourcePreview = data?.source === true && !data?.pose;
    const revision = serial;
    if (
      data?.version !== 1 ||
      data.basis !== 'gta-z-up' ||
      !Array.isArray(data.meshes) ||
      data.meshes.length > 4096
    )
      throw Error('Format preview engine tidak valid.');
    init();
    const textureData = data.textures || [];
    if (textureData.length > 32) throw Error('Terlalu banyak tekstur preview.');
    const textures = await Promise.all(
      textureData.map(
        (encoded) =>
          new Promise((resolve, reject) => {
            if (typeof encoded !== 'string' || encoded.length > 3 * 1024 * 1024)
              return reject(Error('Tekstur preview terlalu besar.'));
            new THREE.TextureLoader().load(
              'data:image/png;base64,' + encoded,
              resolve,
              undefined,
              reject,
            );
          }),
      ),
    );
    if (revision !== serial) {
      textures.forEach((t) => t.dispose());
      return;
    }
    maps = textures;
    maps.forEach((map) => {
      map.colorSpace = THREE.SRGBColorSpace;
      map.wrapS = map.wrapT = THREE.RepeatWrapping;
    });
    let triangles = 0;
    for (const item of data.meshes) {
      if (
        !Array.isArray(item.positions) ||
        item.positions.length % 9 ||
        !item.positions.every(Number.isFinite) ||
        item.uvs?.length !== (item.positions.length / 3) * 2 ||
        !item.uvs.every(Number.isFinite)
      )
        throw Error('Buffer geometri preview tidak valid.');
      triangles += item.positions.length / 9;
      if (triangles > 250000) throw Error('Preview melebihi 250 ribu triangle.');
      const positions = new Float32Array(item.positions.length);
      for (let i = 0; i < positions.length; i += 3)
        positions.set([item.positions[i], item.positions[i + 2], -item.positions[i + 1]], i);
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('uv', new THREE.Float32BufferAttribute(item.uvs, 2));
      geometry.computeVertexNormals();
      const map = Number.isInteger(item.texture) ? maps[item.texture] : null;
      const color =
        Array.isArray(item.color) &&
        item.color.length === 3 &&
        item.color.every((v) => Number.isFinite(v) && v >= 0 && v <= 1)
          ? new THREE.Color().setRGB(...item.color)
          : map
            ? 0xffffff
            : item.kind === 'donor'
              ? 0x9d9dff
              : 0xb3bbc8;
      const material = new THREE.MeshStandardMaterial({
        map: map || null,
        color,
        side: THREE.DoubleSide,
        roughness: 0.7,
        transparent: !!map && item.alpha === 'blend',
        alphaTest: map && item.alpha === 'blend' ? 0.02 : 0,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.name = item.name;
      mesh.userData.candidate = item.candidate;
      (item.kind === 'donor' ? donor : base).add(mesh);
    }
    if (donor.children.length) {
      const box = new THREE.Box3();
      donor.children.forEach((mesh) => {
        mesh.geometry.computeBoundingBox();
        box.union(mesh.geometry.boundingBox);
      });
      box.getCenter(donorAnchor);
      donor.children.forEach((mesh) =>
        mesh.geometry.translate(-donorAnchor.x, -donorAnchor.y, -donorAnchor.z),
      );
    }
    motion = decodeMotion(
      data.motion,
      base.children.reduce((n, mesh) => n + mesh.geometry.attributes.position.array.length, 0),
    );
    motionBuffer = motion ? new Float32Array(motion.frames[0].length) : null;
    motionRest = base.children.map((mesh) => mesh.geometry.attributes.position.array.slice());
    $('nbMotionPlay').disabled = !motion;
    $('nbMotionPlay').textContent =
      motion?.kind === 'gta-ycd-xml' ? 'Play GTA clip' : 'Play walk test';
    $('nbMotionSpeedLabel').hidden = !motion;
    setTransform([0, 0, 0], 1);
    showMode();
    if (!preserveCamera) fit();
    $('nbPreviewStatus').textContent =
      triangles.toLocaleString() +
      (mode === 'ped' && sourcePreview
        ? ' triangles · model sumber, belum dirig.'
        : mode === 'ped'
          ? ' triangles · pose uji weights hasil Blender.'
          : ' triangles · merah = badge dipilih · sumbu = posisi donor.');
  }
  function stopMotion() {
    if (motionFrame !== null) cancelAnimationFrame(motionFrame);
    motionFrame = null;
    $('nbMotionPlay').textContent =
      motion?.kind === 'gta-ycd-xml' ? 'Play GTA clip' : 'Play walk test';
    base.children.forEach((mesh, i) => {
      if (!motionRest[i]) return;
      mesh.geometry.attributes.position.array.set(motionRest[i]);
      mesh.geometry.attributes.position.needsUpdate = true;
      mesh.geometry.computeVertexNormals();
    });
    render();
  }
  function animateMotion(now) {
    if (!motion || !viewport.getClientRects().length || document.hidden) return stopMotion();
    if (now - motionLast < 1000 / 30) {
      motionFrame = requestAnimationFrame(animateMotion);
      return;
    }
    motionLast = now;
    sampleMotion(
      motion,
      ((now - motionStart) / 1000) * Number($('nbMotionSpeed').value),
      motionBuffer,
    );
    let offset = 0;
    for (const mesh of base.children) {
      const attribute = mesh.geometry.attributes.position;
      attribute.array.set(motionBuffer.subarray(offset, offset + attribute.array.length));
      offset += attribute.array.length;
      attribute.needsUpdate = true;
      mesh.geometry.computeVertexNormals();
      mesh.geometry.computeBoundingSphere();
    }
    render();
    motionFrame = requestAnimationFrame(animateMotion);
  }
  $('nbMotionPlay').onclick = () => {
    if (motionFrame !== null) return stopMotion();
    if (!motion) return;
    motionStart = performance.now();
    motionLast = 0;
    $('nbMotionPlay').textContent =
      motion.kind === 'gta-ycd-xml' ? 'Stop GTA clip' : 'Stop walk test';
    motionFrame = requestAnimationFrame(animateMotion);
    $('nbPreviewStatus').textContent =
      motion.kind === 'gta-ycd-xml'
        ? 'GTA clip: ' + motion.label + ' · preview sampel; tidak mengubah file game.'
        : 'Procedural walk test · periksa deformasi weights; tidak mengubah animasi/file native.';
  };
  $('nbPreviewFit').onclick = fit;
  $('nbPreviewPlace').onclick = () => {
    if (!donor.children.length) return toast('Muat preview YFT target dan donor dahulu.');
    placing = !placing;
    showMode();
    $('nbPreviewStatus').textContent = placing
      ? 'Klik permukaan kendaraan untuk menempatkan pusat lampu donor.'
      : 'Geser sumbu untuk mengatur offset donor.';
  };
  $('nbPreviewRemoved').onchange = () => updateSelection(selected);
  return {
    load,
    clear,
    setTransform,
    updateSelection,
    setMode: (value) => {
      mode = value;
      showMode();
    },
    loadButton: $('nbPreviewLoad'),
  };
}
