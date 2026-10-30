import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { managePreview } from './performance.js';
import { decodeResource } from './resource-client.js';
import { drawableLevel } from './drawable-selection.js';
import { loadVehicleTextures, modelTextureReferences } from './vehicle-textures.js';
import { resolveModelTexture } from './model-material.js';
import { imageData } from './converter.js';

export const WEAPON_REFERENCES = [
  ['Pistol', 'WEAPON_PISTOL', 'w_pi_pistol', 'pistol'],
  ['Combat Pistol', 'WEAPON_COMBATPISTOL', 'w_pi_combatpistol', 'pistol'],
  ['AP Pistol', 'WEAPON_APPISTOL', 'w_pi_appistol', 'pistol'],
  ['Micro SMG', 'WEAPON_MICROSMG', 'w_sb_microsmg', 'smg'],
  ['SMG', 'WEAPON_SMG', 'w_sb_smg', 'smg'],
  ['Carbine Rifle', 'WEAPON_CARBINERIFLE', 'w_ar_carbinerifle', 'rifle'],
  ['Assault Rifle', 'WEAPON_ASSAULTRIFLE', 'w_ar_assaultrifle', 'rifle'],
  ['Pump Shotgun', 'WEAPON_PUMPSHOTGUN', 'w_sg_pumpshotgun', 'rifle'],
];
// Original generic blockouts for visual design, not copies of GTA weapon assets.
export function createWeaponSketch(kind = 'pistol') {
  const group = new THREE.Group();
  group.name = 'Sketsa generik ' + kind;
  const box = (name, size, pos, color) => {
    const material = new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.6 });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
    mesh.name = name;
    mesh.position.set(...pos);
    group.add(mesh);
  };
  box(
    'Body',
    kind === 'pistol' ? [0.22, 0.065, 0.04] : [0.34, 0.08, 0.045],
    [0, 0.06, 0],
    0x343944,
  );
  box('Grip', [0.055, 0.12, 0.035], [-0.055, -0.015, 0], 0x1d2028);
  box('Top rail', [kind === 'pistol' ? 0.18 : 0.28, 0.014, 0.025], [0, 0.11, 0], 0xbaa078);
  box(
    'Muzzle',
    [kind === 'pistol' ? 0.04 : 0.2, 0.025, 0.025],
    [kind === 'pistol' ? 0.12 : 0.26, 0.065, 0],
    0x222733,
  );
  if (kind !== 'pistol') {
    box('Stock', [0.16, 0.065, 0.035], [-0.23, 0.025, 0], 0x222733);
    box('Magazine', [0.055, 0.12, 0.03], [0.03, -0.025, 0], 0x222733);
  }
  return group;
}
export function mountWeaponStudio({ root, download, toast, confirmDiscard }) {
  const layout = document.createElement('div');
  layout.className = 'wd-layout';
  layout.innerHTML = `<aside class="wd-settings"><h2>Model & desain senjata</h2><label>Acuan FiveM<select id="wdReference">${WEAPON_REFERENCES.map(([label, code, model], i) => `<option value="${i}">${label} · ${model}</option>`).join('')}</select></label><p id="wdReferenceInfo" class="muted"></p><button id="wdImport" class="primary">+ Model GLB / OBJ / YDR</button><button id="wdPart">+ Model part / attachment</button><input id="wdInput" type="file" accept=".glb,.obj,.ydr,.ydd,.ytd" multiple hidden><button id="wdSketch">Buat sketsa desain generik</button><p class="muted">Model GTA asli diimpor dari file lokal beserta YTD. Sketsa bawaan adalah blockout orisinal untuk desain, bukan model senjata GTA.</p><label>Bagian<select id="wdObject"></select></label><label>Material<select id="wdMaterial"><option value="all">Semua material terpilih</option></select></label><label>Alat<select id="wdTransform"><option value="translate">Geser</option><option value="rotate">Putar</option><option value="scale">Skala</option></select></label><button id="wdDelete">Hapus bagian terpilih</button><label>Warna material<input id="wdColor" type="color" value="#d5b444"></label><button id="wdApplyColor">Terapkan warna</button><button id="wdTexture">+ PNG tekstur / desain UV</button><input id="wdTextureInput" type="file" accept=".png,.jpg,.jpeg,.webp" hidden><label>Ulang tekstur<input id="wdRepeat" type="number" min=".1" max="10" step=".1" value="1"></label><label>Geser UV X<input id="wdUvX" type="number" min="-10" max="10" step=".01" value="0"></label><label>Geser UV Y<input id="wdUvY" type="number" min="-10" max="10" step=".01" value="0"></label><button id="wdUvApply">Terapkan penempatan UV</button><p class="muted">Tekstur mengikuti UV mesh terpilih. Gunakan PNG atlas untuk desain penuh; vertex/UV asli dipertahankan.</p></aside><section class="wd-stage"><div class="wd-toolbar"><button id="wdFit">Lihat semua</button><button id="wdSide">Samping</button><label class="check"><input id="wdWire" type="checkbox">Wireframe</label><label class="check"><input id="wdGrid" type="checkbox" checked>Grid</label></div><div id="wdViewport"><p>Impor model senjata atau mulai dari sketsa desain.</p></div><p id="wdStatus" class="muted" role="status">Siap mendesain model.</p><details><summary>UV mesh terpilih</summary><canvas id="wdUv" width="512" height="512"></canvas><button id="wdUvSave">Simpan UV PNG</button></details></section><aside class="wd-export"><h2>Ekspor desain</h2><label>Nama desain<input id="wdName" value="ditasha_weapon" maxlength="48"></label><button id="wdExport" class="primary">Simpan model GLB</button><button id="wdTextureSave">Simpan tekstur PNG terpilih</button><p class="muted">GLB menyimpan bentuk, material, tekstur dan transform part. Rig tulang senjata, muzzle/magazine, animasi dan metadata GTA tetap perlu disiapkan di Blender/Sollumz sebelum dipaketkan sebagai senjata game.</p><details class="wd-engine"><summary>Build DLC · AddonWeaponsBuilder</summary><p class="muted">Gunakan sumber senjata GTA yang sudah memiliki model, skeleton dan metadata. Engine DLC tidak mengubah GLB mentah menjadi senjata siap game.</p></details></aside>`;
  root.querySelector('.gt-heading').after(layout);
  layout
    .querySelector('.wd-engine')
    .append(root.querySelector('.gt-cards'), root.querySelector('.gt-layout'));
  const $ = (id) => layout.querySelector('#' + id),
    stage = $('wdViewport');
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#20242f');
  scene.add(new THREE.HemisphereLight(0xffffff, 0x414a66, 3));
  const light = new THREE.DirectionalLight(0xffffff, 3);
  light.position.set(2, 4, 5);
  scene.add(light);
  const grid = new THREE.GridHelper(4, 40, 0x65738a, 0x394252);
  grid.position.y = -0.15;
  scene.add(grid);
  const assembly = new THREE.Group();
  assembly.name = 'DITASHA weapon design';
  scene.add(assembly);
  const camera = new THREE.PerspectiveCamera(40, 1, 0.001, 200);
  let renderer,
    orbit,
    gizmo,
    budget,
    selected = null,
    dirty = false,
    busy = false,
    partImport = false,
    serial = 0;
  function init() {
    if (renderer) return;
    renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    stage.replaceChildren(renderer.domElement);
    orbit = new OrbitControls(camera, renderer.domElement);
    gizmo = new TransformControls(camera, renderer.domElement);
    gizmo.enabled = !busy;
    scene.add(gizmo.getHelper());
    gizmo.addEventListener('dragging-changed', (event) => {
      orbit.enabled = !event.value;
    });
    gizmo.addEventListener('objectChange', () => {
      dirty = true;
      serial++;
      budget.invalidate();
    });
    budget = managePreview({ renderer, camera, scene, controls: orbit, container: stage, toast });
    camera.position.set(0.5, 0.3, 0.8);
  }
  function fit(side = false) {
    init();
    if (!assembly.children.length) return;
    const bounds = new THREE.Box3().setFromObject(assembly),
      center = bounds.getCenter(new THREE.Vector3()),
      radius = Math.max(0.01, bounds.getSize(new THREE.Vector3()).length() / 2);
    orbit.target.copy(center);
    camera.position
      .copy(center)
      .add(
        new THREE.Vector3(side ? 0 : 0.35, side ? 0 : 0.2, 1)
          .normalize()
          .multiplyScalar((radius / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2))) * 1.2),
      );
    camera.near = Math.max(0.001, radius / 1000);
    camera.far = Math.max(100, radius * 30);
    camera.updateProjectionMatrix();
    orbit.update();
    budget.invalidate();
  }
  const objects = () => {
    const items = [];
    assembly.traverse((o) => {
      if (o.isMesh) items.push(o);
    });
    return items;
  };
  function materials(mesh) {
    return Array.isArray(mesh?.material) ? mesh.material : mesh?.material ? [mesh.material] : [];
  }
  const targets = () => [...new Set([...assembly.children, ...objects()])];
  function selectionMaterials() {
    const values = [];
    selected?.traverse((object) => {
      for (const material of materials(object))
        if (!values.includes(material)) values.push(material);
    });
    return values;
  }
  function editableMaterials() {
    const values = selectionMaterials(),
      choice = $('wdMaterial').value;
    return choice === 'all' ? values : values[Number(choice)] ? [values[Number(choice)]] : [];
  }
  function uv() {
    const canvas = $('wdUv'),
      ctx = canvas.getContext('2d');
    ctx.fillStyle = '#151923';
    ctx.fillRect(0, 0, 512, 512);
    let mesh = selected;
    if (mesh && !mesh.isMesh) {
      mesh = null;
      selected.traverse((object) => {
        if (!mesh && object.isMesh) mesh = object;
      });
    }
    const attr = mesh?.geometry?.getAttribute('uv');
    if (!attr) return;
    const index = mesh.geometry.index;
    const count = index ? index.count : attr.count;
    ctx.strokeStyle = '#d5b444';
    ctx.lineWidth = 0.5;
    for (let i = 0; i + 2 < count; i += 3) {
      ctx.beginPath();
      for (let j = 0; j < 3; j++) {
        const n = index ? index.getX(i + j) : i + j;
        const x = attr.getX(n) * 512,
          y = (1 - attr.getY(n)) * 512;
        j ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
    }
  }
  function select(mesh) {
    selected = mesh || null;
    gizmo?.detach();
    if (selected) gizmo.attach(selected);
    const all = document.createElement('option');
    all.value = 'all';
    all.textContent = 'Semua material terpilih';
    $('wdMaterial').replaceChildren(
      all,
      ...selectionMaterials().map((m, i) => {
        const option = document.createElement('option');
        option.value = String(i);
        option.textContent = m.name || 'Material ' + (i + 1);
        return option;
      }),
    );
    uv();
    budget?.invalidate();
  }
  function list() {
    const meshes = objects(),
      choices = targets();
    $('wdObject').replaceChildren(
      ...choices.map((mesh, i) => {
        const o = document.createElement('option');
        o.value = i;
        o.textContent = (mesh.isMesh ? 'Mesh · ' : 'Part · ') + (mesh.name || 'Objek ' + (i + 1));
        return o;
      }),
    );
    const preferred = partImport ? assembly.children.at(-1) : choices[0];
    $('wdObject').value = String(choices.indexOf(preferred));
    select(preferred);
    $('wdStatus').textContent =
      `${meshes.length} mesh · ${meshes.reduce((n, m) => n + (m.geometry.index?.count || m.geometry.attributes.position.count) / 3, 0)} segitiga. Geser sumbu untuk mengatur part.`;
  }
  function dispose(object) {
    const maps = new Set();
    object.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      for (const m of materials(o)) {
        if (m.map) maps.add(m.map);
        m.dispose();
      }
    });
    for (const map of maps) map.dispose();
  }
  async function discard() {
    return (
      !dirty ||
      (await confirmDiscard('file', [{ name: 'Desain senjata · ' + $('wdName').value }])) ===
        'discard'
    );
  }
  async function action(fn) {
    if (busy) return;
    busy = true;
    if (gizmo) gizmo.enabled = false;
    layout.querySelectorAll('button,input,select').forEach((e) => (e.disabled = true));
    try {
      await fn();
    } catch (e) {
      $('wdStatus').textContent = e.message;
      toast(e.message);
    } finally {
      busy = false;
      if (gizmo) gizmo.enabled = true;
      layout.querySelectorAll('button,input,select').forEach((e) => (e.disabled = false));
    }
  }
  function accept(object) {
    let vertices = 0,
      meshes = 0;
    object.traverse((o) => {
      if (o.isMesh) {
        vertices += o.geometry.attributes.position.count;
        meshes++;
        const p = o.geometry.attributes.position;
        for (let i = 0; i < p.count; i++)
          if (
            !Number.isFinite(p.getX(i)) ||
            !Number.isFinite(p.getY(i)) ||
            !Number.isFinite(p.getZ(i))
          )
            throw Error('Koordinat model tidak valid.');
        o.material = materials(o).map((m) => {
          const copy = m.clone();
          if (copy.map) copy.map = copy.map.clone();
          return copy;
        });
        if (o.material.length === 1) o.material = o.material[0];
      }
    });
    const used = partImport
      ? objects().reduce((n, m) => n + m.geometry.attributes.position.count, 0)
      : 0;
    if (!meshes || vertices + used > 500000 || assembly.children.length >= 64)
      throw Error('Model kosong atau melebihi 500 ribu vertex / 64 part.');
    return object;
  }
  async function load(files) {
    if (files.reduce((n, f) => n + f.size, 0) > 128 * 1024 ** 2)
      throw Error('Impor model maksimal 128 MB total.');
    const model = files.find((f) => /\.(glb|obj|ydr|ydd)$/i.test(f.name));
    if (!model || model.size > 64 * 1024 ** 2) throw Error('Pilih GLB/OBJ/YDR/YDD maksimal 64 MB.');
    let object;
    try {
      if (/\.glb$/i.test(model.name)) {
        const manager = new THREE.LoadingManager();
        manager.setURLModifier((url) => {
          if (!/^(data:|blob:)/.test(url))
            throw Error('GLB harus membawa buffer dan tekstur embedded.');
          return url;
        });
        object = (await new GLTFLoader(manager).parseAsync(await model.arrayBuffer(), '')).scene;
      } else if (/\.obj$/i.test(model.name)) object = new OBJLoader().parse(await model.text());
      else {
        const drawables = await decodeResource(
          model.name.split('.').pop().toLowerCase(),
          await model.arrayBuffer(),
        );
        const loaded = await loadVehicleTextures(
          files.filter((f) => /\.ytd$/i.test(f.name)),
          modelTextureReferences(drawables),
          { decode: decodeResource, image: imageData },
        );
        object = new THREE.Group();
        for (const d of drawables)
          for (const g of drawableLevel(d, 'High')?.geometries || []) {
            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute('position', new THREE.BufferAttribute(g.positions.slice(), 3));
            geometry.setIndex(new THREE.BufferAttribute(g.indices.slice(), 1));
            if (g.uvs) geometry.setAttribute('uv', new THREE.BufferAttribute(g.uvs.slice(), 2));
            geometry.computeVertexNormals();
            const t = resolveModelTexture(
              g.diffuseTexture,
              loaded.textures,
              d.embeddedTextures || [],
              model.name,
            );
            let map;
            if (t) {
              const canvas = document.createElement('canvas');
              canvas.width = t.w;
              canvas.height = t.h;
              canvas
                .getContext('2d')
                .putImageData(new ImageData(new Uint8ClampedArray(t.out), t.w, t.h), 0, 0);
              map = new THREE.CanvasTexture(canvas);
              map.colorSpace = THREE.SRGBColorSpace;
            }
            const mesh = new THREE.Mesh(
              geometry,
              new THREE.MeshStandardMaterial({
                map,
                color: map ? 0xffffff : 0x9da9bc,
                roughness: 0.5,
                metalness: 0.5,
                side: THREE.DoubleSide,
              }),
            );
            mesh.name = g.diffuseTexture || d.name;
            object.add(mesh);
          }
        object.rotation.x = -Math.PI / 2;
      }
      accept(object);
      object.name = model.name;
      if (!partImport) {
        if (!(await discard())) {
          dispose(object);
          return;
        }
        gizmo?.detach();
        for (const child of [...assembly.children]) {
          assembly.remove(child);
          dispose(child);
        }
      }
      assembly.add(object);
      dirty = true;
      serial++;
      list();
      fit();
    } catch (error) {
      if (object && !assembly.children.includes(object)) dispose(object);
      throw error;
    }
  }
  $('wdReference').onchange = () => {
    const [label, code, model] = WEAPON_REFERENCES[Number($('wdReference').value)];
    $('wdReferenceInfo').textContent =
      `${code} · file acuan ${model}.ydr + YTD pasangannya. Impor model asli untuk mengedit ${label}.`;
  };
  $('wdReference').onchange();
  $('wdImport').onclick = () => {
    partImport = false;
    $('wdInput').click();
  };
  $('wdPart').onclick = () => {
    partImport = true;
    $('wdInput').click();
  };
  $('wdInput').onchange = (e) => {
    const files = [...e.target.files];
    e.target.value = '';
    if (files.length)
      action(() => {
        init();
        return load(files);
      });
  };
  $('wdSketch').onclick = () =>
    action(async () => {
      init();
      if (!(await discard())) return;
      gizmo.detach();
      for (const child of [...assembly.children]) {
        assembly.remove(child);
        dispose(child);
      }
      assembly.add(createWeaponSketch(WEAPON_REFERENCES[Number($('wdReference').value)][3]));
      dirty = true;
      serial++;
      list();
      fit();
    });
  $('wdObject').onchange = () => select(targets()[Number($('wdObject').value)]);
  $('wdTransform').onchange = () => {
    init();
    gizmo.setMode($('wdTransform').value);
    budget.invalidate();
  };
  $('wdDelete').onclick = () => {
    if (!selected || busy) return;
    const parent = selected.parent;
    gizmo.detach();
    parent.remove(selected);
    dispose(selected);
    dirty = true;
    serial++;
    list();
  };
  $('wdMaterial').onchange = uv;
  $('wdApplyColor').onclick = () => {
    if (!selected) return toast('Pilih mesh atau part terlebih dahulu.');
    for (const material of editableMaterials()) {
      material.color?.set($('wdColor').value);
      material.needsUpdate = true;
    }
    dirty = true;
    serial++;
    budget?.invalidate();
  };
  $('wdTexture').onclick = () => $('wdTextureInput').click();
  $('wdTextureInput').onchange = (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (file)
      action(async () => {
        if (!selected) throw Error('Pilih mesh terlebih dahulu.');
        if (file.size > 16 * 1024 ** 2) throw Error('Gambar maksimal 16 MB.');
        const bitmap = await createImageBitmap(file);
        try {
          if (bitmap.width * bitmap.height > 16e6) throw Error('Gambar maksimal 16 megapixel.');
          const scale = Math.min(1, 2048 / Math.max(bitmap.width, bitmap.height)),
            canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(bitmap.width * scale));
          canvas.height = Math.max(1, Math.round(bitmap.height * scale));
          canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
          for (const material of editableMaterials()) {
            const map = new THREE.CanvasTexture(canvas);
            map.colorSpace = THREE.SRGBColorSpace;
            material.map?.dispose();
            material.map = map;
            material.color.set(0xffffff);
            material.needsUpdate = true;
          }
          dirty = true;
          serial++;
          budget.invalidate();
        } finally {
          bitmap.close();
        }
      });
  };
  $('wdUvApply').onclick = () => {
    const repeat = Number($('wdRepeat').value),
      x = Number($('wdUvX').value),
      y = Number($('wdUvY').value);
    if (
      !Number.isFinite(repeat) ||
      repeat < 0.1 ||
      repeat > 10 ||
      ![x, y].every((n) => Number.isFinite(n) && Math.abs(n) <= 10)
    )
      return toast('Pengaturan UV di luar batas.');
    for (const m of editableMaterials())
      if (m.map) {
        m.map.repeat.set(repeat, repeat);
        m.map.offset.set(x, y);
        m.map.wrapS = m.map.wrapT = THREE.RepeatWrapping;
        m.map.needsUpdate = true;
      }
    dirty = true;
    serial++;
    budget?.invalidate();
  };
  $('wdFit').onclick = () => fit();
  $('wdSide').onclick = () => fit(true);
  $('wdWire').onchange = () => {
    for (const mesh of objects())
      for (const m of materials(mesh)) m.wireframe = $('wdWire').checked;
    budget?.invalidate();
  };
  $('wdGrid').onchange = () => {
    grid.visible = $('wdGrid').checked;
    budget?.invalidate();
  };
  const name = () => {
    const value = $('wdName').value;
    if (!/^[a-z][a-z0-9_]{2,47}$/.test(value))
      throw Error('Nama desain 3–48 huruf kecil/angka/underscore.');
    return value;
  };
  $('wdExport').onclick = () =>
    action(async () => {
      if (!objects().length) throw Error('Belum ada model.');
      const revision = serial;
      const bytes = await new GLTFExporter().parseAsync(assembly, { binary: true });
      if (bytes.byteLength > 128 * 1024 ** 2) throw Error('GLB melebihi 128 MB.');
      if (
        (await download(new Uint8Array(bytes), name() + '.glb', 'model/gltf-binary')) !== false &&
        serial === revision
      )
        dirty = false;
    });
  async function png(canvas, suffix) {
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw Error('PNG tidak dapat dibuat.');
    await download(new Uint8Array(await blob.arrayBuffer()), name() + suffix + '.png', 'image/png');
  }
  $('wdUvSave').onclick = () => action(() => png($('wdUv'), '_uv'));
  $('wdTextureSave').onclick = () =>
    action(async () => {
      const map = editableMaterials().find((m) => m.map)?.map;
      if (!map?.image) throw Error('Mesh terpilih belum memiliki tekstur.');
      const canvas = document.createElement('canvas');
      canvas.width = map.image.width;
      canvas.height = map.image.height;
      canvas.getContext('2d').drawImage(map.image, 0, 0);
      await png(canvas, '_texture');
    });
  return {
    setActive(value) {
      if (value) {
        init();
        budget.resize();
        budget.invalidate();
      }
    },
    unsavedItems: () => (dirty ? [{ name: 'Desain senjata · ' + $('wdName').value }] : []),
  };
}
