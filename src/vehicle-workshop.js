import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { decodeResource } from './resource-client.js';
import { MAX_EXPORT } from './asset-tools.js';
export function mountVehicleWorkshop({
  container,
  scene,
  viewport,
  camera,
  getMeshes,
  getRoot,
  getSource,
  getHiddenGeometry,
  setHidden,
  render,
  download,
  toast,
  operation,
}) {
  const root = document.createElement('details');
  root.id = 'vehicleWorkshop';
  root.className = 'vehicle-workshop';
  root.innerHTML = `<summary>Vehicle workshop · offline</summary><p class="muted">Pilih mesh atau klik model. Sembunyikan badge pada daftar Visible parts. Transform part dan lightbar masuk ke ekspor GLB/proyek; belum ditulis sebagai part/siren YFT.</p><label>Mesh terpilih<select id="vwMesh"></select></label><button id="vwPick">Pilih mesh di 3D</button><button id="vwBadges">Cari kandidat badge</button><p id="vwBadgeStatus" class="muted"></p><details class="workshop-section"><summary>Transform mesh</summary><div id="vwTransform" class="studio-fields"></div><button id="vwResetMesh">Reset transform mesh</button></details><details id="vwLightSection" class="workshop-section"><summary>Lightbar preview</summary><button id="vwAddLight">Tambah lightbar preview</button><button id="vwRemoveLight">Hapus lightbar</button><div id="vwLightTransform" class="studio-fields"></div><label>Warna kiri<input type="color" id="vwLeftColor" value="#dd1535"></label><label>Warna kanan<input type="color" id="vwRightColor" value="#206cff"></label></details><details class="workshop-section"><summary>Ekspor &amp; proyek</summary><button id="vwNative">Ekspor resource · mesh tersembunyi</button><p class="muted">Ekspor native hanya menonaktifkan triangle mesh utama yang disembunyikan. Bone, collision dan rig tidak dihapus. Berlaku untuk LOD yang dipilih, bukan pencocokan otomatis semua LOD. Simpan sebagai file baru dan uji di game.</p><button id="vwGlb">Ekspor scene GLB</button><button id="vwSave">Simpan proyek kendaraan</button><button id="vwOpen">Buka proyek kendaraan</button><input id="vwProjectInput" type="file" accept=".json" hidden><p id="vwStatus" role="status" class="muted"></p></details>`;
  container.querySelector('#mvParts').after(root);
  const $ = (id) => root.querySelector('#' + id),
    transforms = new Map(),
    light = new THREE.Group();
  light.name = 'DITASHA preview lightbar';
  scene.add(light);
  let selected = '',
    picking = false,
    dirty = false,
    baseSignature = '',
    savedHidden = '[]';
  const snapshot = (mesh) => ({
    x: mesh.position.x,
    y: mesh.position.y,
    z: mesh.position.z,
    rx: THREE.MathUtils.radToDeg(mesh.rotation.x),
    ry: THREE.MathUtils.radToDeg(mesh.rotation.y),
    rz: THREE.MathUtils.radToDeg(mesh.rotation.z),
    scale: mesh.scale.x,
  });
  const apply = (mesh, t) => {
    mesh.position.set(t.x, t.y, t.z);
    mesh.rotation.set(...['rx', 'ry', 'rz'].map((k) => THREE.MathUtils.degToRad(t[k])));
    mesh.scale.setScalar(t.scale);
  };
  const valid = (t) =>
    t &&
    ['x', 'y', 'z', 'rx', 'ry', 'rz', 'scale'].every(
      (k) => Number.isFinite(t[k]) && Math.abs(t[k]) < 10000,
    ) &&
    t.scale >= 0.001 &&
    t.scale <= 100;
  const fields = (host, prefix, change) => {
    for (const [key, label] of [
      ['x', 'X'],
      ['y', 'Y'],
      ['z', 'Z'],
      ['rx', 'Rot X'],
      ['ry', 'Rot Y'],
      ['rz', 'Rot Z'],
      ['scale', 'Scale'],
    ]) {
      const l = document.createElement('label');
      l.textContent = label;
      const i = document.createElement('input');
      i.type = 'number';
      i.step = key === 'scale' ? '.05' : '.01';
      i.id = prefix + key;
      i.value = key === 'scale' ? 1 : 0;
      i.onchange = () => {
        const t = Object.fromEntries(
          ['x', 'y', 'z', 'rx', 'ry', 'rz', 'scale'].map((k) => [k, Number($(prefix + k).value)]),
        );
        if (!valid(t)) {
          toast('Transform harus berupa angka terbatas; scale 0,001–100.');
          return;
        }
        change(t);
        dirty = true;
        render();
      };
      l.append(i);
      $(host).append(l);
    }
  };
  fields('vwTransform', 'vw_', (t) => {
    const e = getMeshes().find((e) => e.key === selected);
    if (!e) return;
    transforms.set(selected, t);
    apply(e.mesh, t);
  });
  fields('vwLightTransform', 'vwl_', (t) => apply(light, t));
  function fill(prefix, t) {
    for (const k of ['x', 'y', 'z', 'rx', 'ry', 'rz', 'scale'])
      $(prefix + k).value = +t[k].toFixed(4);
  }
  function choose() {
    selected = $('vwMesh').value;
    const e = getMeshes().find((e) => e.key === selected);
    if (e) fill('vw_', snapshot(e.mesh));
  }
  $('vwMesh').onchange = choose;
  function refresh() {
    const source = getSource(),
      signature = source?.name + ':' + source?.file?.lastModified + ':' + source?.file?.size;
    if (signature !== baseSignature) {
      transforms.clear();
      clearLight();
      baseSignature = signature;
      dirty = false;
      savedHidden = '[]';
    }
    $('vwMesh').replaceChildren();
    for (const e of getMeshes()) {
      if (transforms.has(e.key)) apply(e.mesh, transforms.get(e.key));
      const o = document.createElement('option');
      o.value = e.key;
      o.textContent = e.mesh.name;
      $('vwMesh').append(o);
    }
    if ([...$('vwMesh').options].some((o) => o.value === selected)) $('vwMesh').value = selected;
    choose();
  }
  $('vwPick').onclick = () => {
    picking = !picking;
    $('vwPick').classList.toggle('active', picking);
    $('vwStatus').textContent = picking
      ? 'Klik mesh kendaraan pada preview.'
      : 'Pemilihan selesai.';
  };
  viewport.addEventListener('pointerdown', (e) => {
    if (!picking || e.button !== 0) return;
    const rect = viewport.getBoundingClientRect(),
      ray = new THREE.Raycaster();
    ray.setFromCamera(
      new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        1 - ((e.clientY - rect.top) / rect.height) * 2,
      ),
      camera,
    );
    const hit = ray.intersectObjects(
      getMeshes()
        .filter((e) => e.mesh.visible)
        .map((e) => e.mesh),
      false,
    )[0];
    if (hit) {
      $('vwMesh').value = hit.object.userData.bindingKey;
      choose();
      picking = false;
      $('vwPick').classList.remove('active');
    }
  });
  $('vwBadges').onclick = () => {
    const matches = getMeshes().filter((e) => /badge|emblem|decal|logo|script/i.test(e.mesh.name));
    $('vwBadgeStatus').textContent = matches.length
      ? matches.length + ' kandidat berdasarkan nama material. Periksa mesh sebelum disembunyikan.'
      : 'Tidak ada nama badge terdeteksi. Pilih mesh secara manual.';
    if (matches.length) {
      $('vwMesh').value = matches[0].key;
      choose();
    }
  };
  $('vwResetMesh').onclick = () => {
    const e = getMeshes().find((e) => e.key === selected);
    if (!e) return;
    const t = e.mesh.userData.workshopOriginal;
    if (t) apply(e.mesh, t);
    transforms.delete(selected);
    dirty = true;
    choose();
    render();
  };
  function clearLight() {
    while (light.children.length) {
      const m = light.children.pop();
      m.geometry.dispose();
      m.material.dispose();
    }
    light.position.set(0, 0, 0);
    light.rotation.set(0, 0, 0);
    light.scale.setScalar(1);
    fill('vwl_', snapshot(light));
  }
  function addLight() {
    if (!getMeshes().length) throw Error('Buka kendaraan terlebih dahulu.');
    clearLight();
    const box = new THREE.Box3().setFromObject(getRoot()),
      size = box.getSize(new THREE.Vector3()),
      center = box.getCenter(new THREE.Vector3()),
      w = Math.max(0.1, size.x * 0.65),
      h = Math.max(0.03, size.y * 0.035),
      d = Math.max(0.05, size.z * 0.07);
    for (const [i, color] of [
      [-1, $('vwLeftColor').value],
      [1, $('vwRightColor').value],
    ]) {
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(w * 0.45, h, d),
        new THREE.MeshStandardMaterial({
          color,
          emissive: color,
          emissiveIntensity: 0.7,
          roughness: 0.25,
        }),
      );
      m.position.x = i * w * 0.25;
      light.add(m);
    }
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(w, h * 0.25, d * 1.1),
      new THREE.MeshStandardMaterial({ color: 0x222222 }),
    );
    base.position.y = -h * 0.65;
    light.add(base);
    light.position.set(center.x, box.max.y + h, center.z);
    fill('vwl_', snapshot(light));
    render();
  }
  $('vwAddLight').onclick = () => {
    try {
      addLight();
      $('vwLightSection').open = true;
      dirty = true;
    } catch (e) {
      toast(e.message);
    }
  };
  $('vwRemoveLight').onclick = () => {
    clearLight();
    dirty = true;
    render();
  };
  for (const [id, i] of [
    ['vwLeftColor', 0],
    ['vwRightColor', 1],
  ])
    $(id).oninput = () => {
      const m = light.children[i];
      if (m) {
        m.material.color.set($(id).value);
        m.material.emissive.set($(id).value);
        dirty = true;
        render();
      }
    };
  $('vwNative').onclick = () =>
    operation('model', async () => {
      const source = getSource();
      if (!source?.file) throw Error('Buka model utama terlebih dahulu.');
      const hidden = getHiddenGeometry();
      const out = await decodeResource('mask', await source.file.arrayBuffer(), {
        selected: hidden,
        extension: source.name.split('.').at(-1).toLowerCase(),
      });
      const name = source.name.replace(/\.(yft|ydd|ydr)$/i, '-masked.$1');
      $('vwStatus').textContent = (await download(out, name, 'application/octet-stream'))
        ? 'Resource visual tersimpan; collision/rig tetap asli.'
        : 'Penyimpanan dibatalkan.';
    });
  async function exportGlb() {
    if (!getMeshes().length) throw Error('Buka kendaraan terlebih dahulu.');
    const copy = new THREE.Group();
    copy.add(getRoot().clone(true));
    if (light.children.length) copy.add(light.clone(true));
    const unwanted = [];
    copy.traverse((o) => {
      if (o.isPoints || o.isLine) unwanted.push(o);
    });
    unwanted.forEach((o) => o.removeFromParent());
    const out = await new GLTFExporter().parseAsync(copy, {
      binary: true,
      onlyVisible: true,
      maxTextureSize: 2048,
    });
    if (out.byteLength > MAX_EXPORT) throw Error('GLB melebihi 128 MB.');
    return new Uint8Array(out);
  }
  $('vwGlb').onclick = () =>
    operation('model', async () => {
      $('vwStatus').textContent = (await download(
        await exportGlb(),
        'ditasha-vehicle-scene.glb',
        'model/gltf-binary',
      ))
        ? 'Scene GLB tersimpan; bukan resource GTA.'
        : 'Penyimpanan dibatalkan.';
    });
  $('vwSave').onclick = () =>
    operation('model', async () => {
      const source = getSource();
      if (!source) throw Error('Buka model utama dahulu.');
      const project = {
        format: 'ditasha-vehicle',
        version: 1,
        source: { name: source.name, size: source.file.size },
        transforms: [...transforms],
        hidden: getMeshes()
          .filter((e) => !e.mesh.visible)
          .map((e) => e.key),
        light: light.children.length
          ? {
              transform: snapshot(light),
              left: $('vwLeftColor').value,
              right: $('vwRightColor').value,
            }
          : null,
      };
      if (
        await download(JSON.stringify(project, null, 2), 'ditasha-vehicle.json', 'application/json')
      ) {
        dirty = false;
        savedHidden = JSON.stringify(project.hidden.slice().sort());
        $('vwStatus').textContent =
          'Proyek disimpan. Buka model/extra yang sama sebelum memuat proyek kembali.';
      }
    });
  $('vwOpen').onclick = () => $('vwProjectInput').click();
  $('vwProjectInput').onchange = () =>
    operation('model', async () => {
      const f = $('vwProjectInput').files[0];
      $('vwProjectInput').value = '';
      if (!f) return;
      if (f.size > 1024 * 1024) throw Error('Proyek maksimum 1 MB.');
      const p = JSON.parse(await f.text()),
        s = getSource();
      if (
        p.format !== 'ditasha-vehicle' ||
        p.version !== 1 ||
        !s ||
        p.source?.name !== s.name ||
        p.source?.size !== s.file.size ||
        !Array.isArray(p.transforms) ||
        p.transforms.length > 4096 ||
        !Array.isArray(p.hidden)
      )
        throw Error('Proyek tidak cocok dengan model utama.');
      const keys = new Set(getMeshes().map((e) => e.key));
      if (
        p.transforms.some((e) => !Array.isArray(e) || !keys.has(e[0]) || !valid(e[1])) ||
        p.hidden.some((k) => !keys.has(k))
      )
        throw Error('Muat drawable/LOD dan extra yang sama seperti proyek.');
      if (
        p.light &&
        (!valid(p.light.transform) ||
          !/^#[a-f0-9]{6}$/i.test(p.light.left) ||
          !/^#[a-f0-9]{6}$/i.test(p.light.right))
      )
        throw Error('Lightbar proyek tidak valid.');
      transforms.clear();
      p.transforms.forEach(([k, t]) => transforms.set(k, t));
      for (const e of getMeshes()) {
        if (e.mesh.userData.workshopOriginal) apply(e.mesh, e.mesh.userData.workshopOriginal);
        e.mesh.visible = !p.hidden.includes(e.key);
        setHidden(e.key, !e.mesh.visible);
        if (transforms.has(e.key)) apply(e.mesh, transforms.get(e.key));
      }
      clearLight();
      if (p.light) {
        $('vwLeftColor').value = p.light.left;
        $('vwRightColor').value = p.light.right;
        addLight();
        apply(light, p.light.transform);
        fill('vwl_', p.light.transform);
      }
      dirty = false;
      savedHidden = JSON.stringify(p.hidden.slice().sort());
      choose();
      render();
      $('vwStatus').textContent = 'Proyek dimuat; periksa hasil sebelum mengekspor.';
    });
  return {
    refresh,
    changed: () => {},
    light,
    rememberOriginal: (mesh) => (mesh.userData.workshopOriginal = snapshot(mesh)),
    unsavedItems: () =>
      dirty ||
      JSON.stringify(
        getMeshes()
          .filter((e) => !e.mesh.visible)
          .map((e) => e.key)
          .sort(),
      ) !== savedHidden
        ? [{ name: 'Vehicle workshop · proyek belum disimpan' }]
        : [],
  };
}
