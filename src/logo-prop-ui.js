import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { managePreview } from './performance.js';
import { removeLogoBackground, buildLogoGeometry, logoMeshPayload } from './logo-prop.js';

export function mountLogoProp({ nav, activate, download, toast, confirmDiscard }) {
  const button = document.createElement('button');
  button.dataset.page = 'logoprop';
  button.innerHTML =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 9 5v8l-9 5-9-5V8Zm0 0v18M3 8l9 5 9-5"/></svg><span>Logo → Prop 3D</span>';
  nav.append(button);
  const root = document.createElement('section');
  root.className = 'logo-prop-workspace';
  root.hidden = true;
  root.innerHTML = `<div class="lp-heading"><div><span class="eyebrow">DITASHA · PROP BUILDER</span><h1>Logo → Prop 3D</h1><p>PNG menjadi logo timbul atau papan untuk GTA V / FiveM.</p></div><button id="lpImport" class="primary">+ Gambar logo</button><input id="lpInput" type="file" accept=".png,.jpg,.jpeg,.webp" hidden></div>
  <div class="lp-layout"><aside id="lpSettings" class="lp-settings"><h2>Gambar & bentuk</h2><canvas id="lpImage" aria-label="Preview gambar; klik untuk memilih warna latar"></canvas><p id="lpImageInfo" class="muted">PNG transparan memberi hasil terbaik. Klik gambar untuk mengambil warna latar.</p><label>Bentuk<select id="lpMode"><option value="logo">Logo timbul · ikuti alpha</option><option value="board">Papan persegi</option></select></label><label>Latar gambar<select id="lpBackground"><option value="keep">Pertahankan alpha asli</option><option value="edge">Hapus warna dari tepi</option><option value="color">Hapus warna di seluruh gambar</option></select></label><label>Warna latar<input id="lpBgColor" type="color" value="#ffffff"></label><label>Toleransi warna<input id="lpTolerance" type="range" min="0" max="150" value="30"></label><label>Batas alpha<input id="lpAlpha" type="range" min="1" max="255" value="128"></label><label>Lebar · meter<input id="lpWidth" type="number" min="0.05" max="20" step="0.05" value="2"></label><label>Ketebalan · cm<input id="lpDepth" type="number" min="0.1" max="100" step="0.1" value="8"></label><label>Warna sisi / papan<input id="lpSideColor" type="color" value="#20232b"></label><label>Detail bentuk<select id="lpDetail"><option value="96">Hemat · 96</option><option value="160" selected>Seimbang · 160</option><option value="256">Detail · 256</option></select></label><label>Ukuran tekstur<select id="lpTextureSize"><option value="512">512 px</option><option value="1024" selected>1024 px</option><option value="2048">2048 px</option></select></label><button id="lpResetBg">Pulihkan latar asli</button><p class="muted">Hapus dari tepi mempertahankan warna yang tertutup di dalam logo. Mode seluruh gambar juga menghapus warna di bagian dalam.</p></aside>
  <section class="lp-stage"><div class="lp-toolbar"><button id="lpFit">Lihat semua</button><button id="lpFront">Depan</button><label class="check"><input id="lpWire" type="checkbox">Wireframe</label><label class="check"><input id="lpGrid" type="checkbox" checked>Grid</label></div><div id="lpViewport"><p>Masukkan logo untuk melihat bentuk 3D.</p></div><p id="lpStats" class="muted"></p><p id="lpStatus" role="status">Siap membuat prop.</p></section>
  <aside id="lpExport" class="lp-export"><h2>Ekspor prop</h2><label>Nama model<input id="lpName" value="ditasha_logo" maxlength="48" spellcheck="false"></label><button id="lpPng" disabled>Simpan PNG hasil latar</button><button id="lpGlb" disabled>Simpan model GLB</button><h3>GTA V / FiveM</h3><p>Resource berisi YDR + YTYP native, tekstur embedded, dan perintah uji spawn. Ukuran tekstur GTA disesuaikan otomatis tanpa mengubah rasio prop. Prop dekorasi tanpa collision; bisa ditempatkan dalam YMAP/MLO.</p><p id="lpEngine" class="muted">Ekspor native memakai engine Blender + Sollumz yang terpasang di DITASHA.</p><div class="lp-actions"><button id="lpSetup">Siapkan engine otomatis</button><button id="lpPickEngine">Pilih Blender</button></div><button id="lpNative" class="primary" disabled>Ekspor GTA / FiveM</button><button id="lpCancel" hidden>Batalkan build</button><button id="lpReveal" hidden>Buka hasil resource</button><details><summary>Log ekspor</summary><pre id="lpLog"></pre></details><p class="muted">Logo ini menjadi model statis. Gambar 2D tidak menghasilkan interior MLO atau detail pahatan otomatis.</p></aside></div>`;
  nav.after(root);
  const $ = (id) => root.querySelector('#' + id),
    viewport = $('lpViewport');
  let image = null,
    result = null,
    processed = null,
    renderer = null,
    controls = null,
    budget = null,
    mesh = null,
    dirty = false,
    valid = false,
    ownRun = false,
    polling = null,
    loading = false,
    revision = 0;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#20242f');
  const camera = new THREE.PerspectiveCamera(38, 1, 0.001, 200);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x454e68, 3));
  const light = new THREE.DirectionalLight(0xffffff, 3);
  light.position.set(3, 5, 4);
  scene.add(light);
  const grid = new THREE.GridHelper(10, 20, 0x63728c, 0x384151);
  scene.add(grid);
  function init() {
    if (renderer) return;
    renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    viewport.replaceChildren(renderer.domElement);
    controls = new OrbitControls(camera, renderer.domElement);
    budget = managePreview({ renderer, camera, scene, controls, container: viewport, toast });
    camera.position.set(2, 1.2, 4);
  }
  function fit(front = false) {
    if (!mesh) return;
    init();
    const radius = result.geometry.boundingSphere.radius;
    controls.target.set(0, 0, result.depth / 2);
    camera.position
      .copy(controls.target)
      .add(
        new THREE.Vector3(front ? 0 : 0.4, front ? 0 : 0.2, 1)
          .normalize()
          .multiplyScalar((radius / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2))) * 1.15),
      );
    camera.near = Math.max(0.001, radius / 1000);
    camera.far = Math.max(100, radius * 30);
    camera.updateProjectionMatrix();
    controls.update();
    budget.invalidate();
  }
  const color = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  function buttons() {
    for (const control of root.querySelectorAll(
      '.lp-settings input,.lp-settings select,#lpResetBg,#lpImport,#lpName',
    ))
      control.disabled = loading || ownRun;
    for (const id of ['lpPng', 'lpGlb', 'lpNative']) $(id).disabled = !valid || loading || ownRun;
  }
  function rebuild() {
    if (!image) return;
    try {
      const maximum = Number($('lpTextureSize').value),
        ratio = Math.min(1, maximum / Math.max(image.width, image.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.width * ratio));
      canvas.height = Math.max(1, Math.round(image.height * ratio));
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
      pixels.data.set(
        removeLogoBackground(pixels.data, canvas.width, canvas.height, {
          mode: $('lpBackground').value,
          color: color($('lpBgColor').value),
          tolerance: Number($('lpTolerance').value),
        }),
      );
      ctx.putImageData(pixels, 0, 0);
      if ($('lpMode').value === 'board') {
        ctx.globalCompositeOperation = 'destination-over';
        ctx.fillStyle = $('lpSideColor').value;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.globalCompositeOperation = 'source-over';
      }
      const detail = Number($('lpDetail').value),
        scale = Math.min(1, detail / Math.max(canvas.width, canvas.height)),
        small = document.createElement('canvas');
      small.width = Math.max(1, Math.round(canvas.width * scale));
      small.height = Math.max(1, Math.round(canvas.height * scale));
      const c = small.getContext('2d');
      c.drawImage(canvas, 0, 0, small.width, small.height);
      const bytes = c.getImageData(0, 0, small.width, small.height).data,
        alpha = Uint8Array.from({ length: small.width * small.height }, (_, i) => bytes[i * 4 + 3]);
      const next = buildLogoGeometry(alpha, small.width, small.height, {
        mode: $('lpMode').value,
        width: Number($('lpWidth').value),
        depth: Number($('lpDepth').value) / 100,
        threshold: Number($('lpAlpha').value),
      });
      init();
      if (mesh) {
        scene.remove(mesh);
        mesh.geometry.dispose();
        for (const m of mesh.material) {
          m.map?.dispose();
          m.dispose();
        }
      }
      const map = new THREE.CanvasTexture(canvas);
      map.colorSpace = THREE.SRGBColorSpace;
      const front = new THREE.MeshStandardMaterial({ map, roughness: 0.7, alphaTest: 0.1 });
      const side = new THREE.MeshStandardMaterial({
        color: $('lpSideColor').value,
        roughness: 0.65,
      });
      front.wireframe = side.wireframe = $('lpWire').checked;
      result = next;
      processed = canvas;
      mesh = new THREE.Mesh(next.geometry, [front, side]);
      scene.add(mesh);
      grid.position.y = -next.height / 2 - 0.01;
      grid.visible = $('lpGrid').checked;
      valid = true;
      dirty = true;
      revision++;
      $('lpImage').width = canvas.width;
      $('lpImage').height = canvas.height;
      $('lpImage').getContext('2d').drawImage(canvas, 0, 0);
      $('lpStats').textContent =
        `${next.width.toFixed(2)} × ${next.height.toFixed(2)} × ${next.depth.toFixed(3)} m · ${next.geometry.attributes.position.count / 3} segitiga · ${next.islands} bagian · ${next.holes} lubang`;
      $('lpStatus').textContent = 'Preview siap. Drag untuk memutar, scroll untuk zoom.';
      fit();
    } catch (e) {
      valid = false;
      if (mesh) mesh.visible = false;
      $('lpStatus').textContent = e.message;
    }
    buttons();
  }
  let rebuildTimer;
  function queue() {
    valid = false;
    buttons();
    clearTimeout(rebuildTimer);
    rebuildTimer = setTimeout(rebuild, 120);
  }
  for (const id of [
    'lpMode',
    'lpBackground',
    'lpBgColor',
    'lpTolerance',
    'lpAlpha',
    'lpWidth',
    'lpDepth',
    'lpSideColor',
    'lpDetail',
    'lpTextureSize',
  ])
    $(id).addEventListener('input', queue);
  $('lpWire').onchange = () => {
    if (mesh) {
      for (const m of mesh.material) m.wireframe = $('lpWire').checked;
      budget.invalidate();
    }
  };
  $('lpGrid').onchange = () => {
    grid.visible = $('lpGrid').checked;
    budget?.invalidate();
  };
  $('lpFit').onclick = () => fit();
  $('lpFront').onclick = () => fit(true);
  $('lpImage').onclick = (e) => {
    if (!image || !processed || loading || ownRun) return;
    const r = e.currentTarget.getBoundingClientRect(),
      x = Math.min(
        image.width - 1,
        Math.max(0, Math.floor(((e.clientX - r.left) / r.width) * image.width)),
      ),
      y = Math.min(
        image.height - 1,
        Math.max(0, Math.floor(((e.clientY - r.top) / r.height) * image.height)),
      );
    const c = document.createElement('canvas');
    c.width = c.height = 1;
    const ctx = c.getContext('2d');
    ctx.drawImage(image, x, y, 1, 1, 0, 0, 1, 1);
    const p = ctx.getImageData(0, 0, 1, 1).data;
    $('lpBgColor').value =
      '#' + [...p.slice(0, 3)].map((n) => n.toString(16).padStart(2, '0')).join('');
    $('lpBackground').value = 'edge';
    queue();
  };
  $('lpResetBg').onclick = () => {
    $('lpBackground').value = 'keep';
    queue();
  };
  $('lpImport').onclick = () => $('lpInput').click();
  $('lpInput').onchange = async () => {
    const file = $('lpInput').files[0];
    $('lpInput').value = '';
    if (!file) return;
    if (loading || ownRun) return;
    if (dirty && (await confirmDiscard('logo', [{ name: 'Logo → Prop 3D' }])) !== 'discard') return;
    loading = true;
    buttons();
    let next;
    try {
      if (file.size > 16 * 1024 ** 2 || !/^image\/(png|jpeg|webp)$/.test(file.type))
        throw Error('Pilih PNG/JPG/WebP maksimal 16 MB.');
      next = await createImageBitmap(file);
      if (next.width > 8192 || next.height > 8192 || next.width * next.height > 16777216)
        throw Error('Gambar maksimal 8192 px dan 16 megapixel.');
      image?.close();
      image = next;
      next = null;
      const c = document.createElement('canvas');
      c.width = c.height = 1;
      c.getContext('2d').drawImage(image, 0, 0, 1, 1, 0, 0, 1, 1);
      const p = c.getContext('2d').getImageData(0, 0, 1, 1).data;
      $('lpBgColor').value =
        '#' + [...p.slice(0, 3)].map((n) => n.toString(16).padStart(2, '0')).join('');
      $('lpBackground').value = 'keep';
      $('lpImageInfo').textContent =
        `${file.name} · ${image.width} × ${image.height}. Jika latar masih kotak, pilih hapus dari tepi.`;
      rebuild();
    } catch (e) {
      toast(e.message);
      $('lpStatus').textContent = e.message;
    } finally {
      next?.close();
      loading = false;
      buttons();
    }
  };
  const name = () => {
    const value = $('lpName').value;
    if (
      !/^[a-z][a-z0-9_]{2,47}$/.test(value) ||
      /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/.test(value)
    )
      throw Error('Nama model 3–48 huruf kecil/angka/underscore, diawali huruf.');
    return value;
  };
  $('lpPng').onclick = async () => {
    try {
      if (!valid) return;
      const blob = await new Promise((r) => processed.toBlob(r));
      await download(
        new Uint8Array(await blob.arrayBuffer()),
        name() + '_diffuse.png',
        'image/png',
      );
    } catch (e) {
      toast(e.message);
    }
  };
  $('lpGlb').onclick = async () => {
    try {
      if (!valid) return;
      const current = revision;
      const glb = await new GLTFExporter().parseAsync(mesh, { binary: true });
      if (
        (await download(new Uint8Array(glb), name() + '.glb', 'model/gltf-binary')) !== false &&
        revision === current
      )
        dirty = false;
    } catch (e) {
      toast(e.message);
    }
  };
  async function poll() {
    const api = window.ditashaNative;
    if (!api) return;
    try {
      const s = await api.state();
      $('lpEngine').textContent = s.engine
        ? `Engine: ${s.engine}`
        : 'Ekspor native memerlukan Blender + Sollumz. Pilih atau siapkan engine.';
      if (ownRun) {
        $('lpStatus').textContent = s.message;
        $('lpLog').textContent = s.log || '';
        $('lpCancel').hidden = !s.running;
        if (!s.running) {
          ownRun = false;
          if (s.status === 'success') {
            if (s.report?.mode === 'logo') dirty = false;
            $('lpReveal').hidden = !s.output;
          }
          buttons();
        }
      }
      $('lpSetup').disabled = $('lpPickEngine').disabled = s.running;
      $('lpNative').disabled = !valid || loading || s.running;
      if (s.running || ownRun) polling = setTimeout(poll, 800);
    } catch (e) {
      ownRun = false;
      $('lpStatus').textContent = e.message;
      buttons();
    }
  }
  async function start(task) {
    try {
      const api = window.ditashaNative;
      if (!api) throw Error('Ekspor GTA tersedia di aplikasi desktop DITASHA.');
      if ((await api.state()).running)
        throw Error('Engine sedang dipakai; tunggu proses sebelumnya.');
      ownRun = true;
      buttons();
      await task(api);
      await poll();
    } catch (e) {
      ownRun = false;
      buttons();
      $('lpStatus').textContent = e.message;
      toast(e.message);
    }
  }
  $('lpSetup').onclick = () => start((api) => api.setup());
  $('lpPickEngine').onclick = async () => {
    try {
      await window.ditashaNative?.pick('engine');
      await poll();
    } catch (e) {
      toast(e.message);
    }
  };
  $('lpNative').onclick = async () => {
    if (!valid) return;
    await start(async (api) => {
      const modelName = name(),
        output = await api.pick('output');
      if (!output) {
        ownRun = false;
        buttons();
        return;
      }
      await api.start({
        mode: 'logo',
        name: modelName,
        inputs: { output: output.id },
        logo: {
          ...logoMeshPayload(result),
          texture: processed.toDataURL('image/png').split(',')[1],
          sideColor: color($('lpSideColor').value).map((n) => n / 255),
        },
      });
    });
  };
  $('lpCancel').onclick = async () => {
    try {
      await window.ditashaNative.cancel();
      await poll();
    } catch (e) {
      toast(e.message);
    }
  };
  $('lpReveal').onclick = () => window.ditashaNative?.reveal();
  return {
    root,
    setActive(value) {
      if (value) {
        init();
        budget.resize();
        clearTimeout(polling);
        poll();
      }
    },
    unsavedItems: () => (dirty ? [{ name: 'Logo → Prop 3D · ' + $('lpName').value }] : []),
  };
}
