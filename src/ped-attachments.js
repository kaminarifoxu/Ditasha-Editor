import * as THREE from 'three';
import { readYdd, readYtd } from './resource.js';
import { MAX_EXPORT } from './asset-tools.js';

const MAX_FILE = 64 * 1024 * 1024;
const normalizeName = (name) => name?.replace(/\.(dds|png|jpe?g|webp)$/i, '').toLowerCase();

// A hair dictionary owns its textures; identically named face textures must not replace them.
export function attachmentTexture(attachment, geometry) {
  const embedded = attachment.drawables[attachment.drawable].embeddedTextures || [];
  const available = [...attachment.textures, ...embedded];
  if (attachment.texture !== '') return available[Number(attachment.texture)] || null;
  return (
    available.find((t) => normalizeName(t.name) === normalizeName(geometry.diffuseTexture)) || null
  );
}

export function validateAttachments(attachments) {
  if (attachments.length > 8) throw Error('Maksimum 8 model rambut tambahan.');
  let decoded = 0,
    vertices = 0,
    indices = 0,
    source = 0;
  const geometries = new Set(),
    textures = new Set();
  for (const a of attachments) {
    source += a.sourceSize;
    for (const d of a.drawables) {
      for (const level of d.lods) for (const g of level.geometries) geometries.add(g);
      for (const t of d.embeddedTextures || []) textures.add(t);
    }
    for (const t of a.textures) textures.add(t);
  }
  for (const g of geometries) {
    vertices += g.positions.length / 3;
    indices += g.indices.length;
  }
  for (const t of textures) decoded += t.out.length;
  if (source > MAX_EXPORT || decoded > MAX_EXPORT || vertices > 2000000 || indices > 6000000)
    throw Error(
      'Rambut tambahan melebihi batas: 128 MB model/tekstur, 2 juta vertex atau 6 juta indeks.',
    );
}

export function mountPedAttachments({ scene, container, prefix, toast, hasBase, onChange }) {
  const root = document.createElement('details');
  root.className = 'ped-attachments';
  root.innerHTML = `<summary>Rambut ped · YDD + YTD</summary><p class="muted">Buka model muka dahulu. Rambut memakai tekstur sendiri; tekstur muka tetap terpisah.</p><button id="${prefix}AddHair">+ Tambah rambut YDD / YTD</button><input id="${prefix}HairInput" type="file" accept=".ydd,.ytd" multiple hidden><div id="${prefix}HairTargetRow" hidden><label>Tujuan YTD rambut<select id="${prefix}HairTarget"></select></label><button id="${prefix}AddHairTextures">+ YTD ke rambut terpilih</button></div><input id="${prefix}HairTextureInput" type="file" accept=".ytd" multiple hidden><div id="${prefix}HairList"></div><p id="${prefix}HairStatus" class="muted" role="status">Belum ada rambut tambahan.</p><p class="muted">Preview statis, tanpa pengikatan tulang kepala. Sesuaikan posisi bila perlu. Konfigurasi hanya berlaku selama preview; tidak mengubah file atau ekspor YTD.</p>`;
  const layerInspector = container.querySelector('.layerinspector');
  if (layerInspector) container.insertBefore(root, layerInspector);
  else container.append(root);
  const $ = (suffix) => root.querySelector('#' + prefix + suffix);
  const group = new THREE.Group();
  scene.add(group);
  let attachments = [],
    busy = false,
    wireframe = false,
    selectedHair = 0;
  function dispose(a) {
    a.object?.traverse((o) => {
      o.geometry?.dispose();
      o.material?.dispose();
    });
    a.maps?.forEach((map) => map.dispose());
    if (a.object) group.remove(a.object);
    a.maps = [];
  }
  function transform(a) {
    a.object.position.set(a.x, a.y, a.z);
    a.object.rotation.set(...[a.rx, a.ry, a.rz].map(THREE.MathUtils.degToRad));
    a.object.scale.setScalar(a.scale);
    a.object.visible = a.visible;
    a.object.updateMatrixWorld(true);
    onChange(false);
  }
  function build(a) {
    dispose(a);
    a.object = new THREE.Group();
    group.add(a.object);
    const d = a.drawables[a.drawable],
      cache = new Map(),
      missing = new Set();
    a.triangles = 0;
    for (const g of d.lods[0].geometries) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(g.positions, 3));
      if (g.uvs) geometry.setAttribute('uv', new THREE.BufferAttribute(g.uvs, 2));
      geometry.setIndex(new THREE.BufferAttribute(g.indices, 1));
      geometry.computeVertexNormals();
      const t = attachmentTexture(a, g);
      if (!t && g.diffuseTexture) missing.add(g.diffuseTexture);
      let map = t && cache.get(t);
      if (t && !map) {
        const canvas = document.createElement('canvas');
        canvas.width = t.w;
        canvas.height = t.h;
        canvas
          .getContext('2d')
          .putImageData(new ImageData(new Uint8ClampedArray(t.out), t.w, t.h), 0, 0);
        map = new THREE.CanvasTexture(canvas);
        map.flipY = false;
        map.colorSpace = THREE.SRGBColorSpace;
        map.wrapS = map.wrapT = THREE.RepeatWrapping;
        cache.set(t, map);
        a.maps.push(map);
      }
      a.object.add(
        new THREE.Mesh(
          geometry,
          new THREE.MeshStandardMaterial({
            color: t ? 0xffffff : 0xb3bbc8,
            map: map || null,
            side: THREE.DoubleSide,
            roughness: 0.75,
            transparent: !!t,
            alphaTest: t ? 0.05 : 0,
            wireframe,
          }),
        ),
      );
      a.triangles += g.indices.length / 3;
    }
    a.warning = [...missing].length
      ? 'Tekstur belum cocok: ' + [...missing].join(', ')
      : 'Tekstur siap.';
    if (d.warnings?.length) a.warning += ' ' + d.warnings.join('; ');
    transform(a);
  }
  function setBusy(value) {
    busy = value;
    root.querySelectorAll('button,input,select').forEach((el) => (el.disabled = value));
  }
  async function operation(task) {
    if (busy) return;
    setBusy(true);
    $('HairStatus').textContent = 'Memuat rambut…';
    try {
      await task();
    } catch (e) {
      $('HairStatus').textContent = e.message;
      toast(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function readTextures(files) {
    const textures = [];
    let size = 0;
    for (const f of files) {
      if (!/\.ytd$/i.test(f.name) || f.size > MAX_FILE)
        throw Error('Pilih YTD hingga 64 MB per file.');
      for (const t of readYtd(await f.arrayBuffer()).textures) {
        size += t.out.length;
        if (size > MAX_EXPORT) throw Error('Tekstur rambut melebihi 128 MB.');
        textures.push({ ...t, dictionary: f.name });
      }
    }
    return textures;
  }
  async function replaceTextures(a, files) {
    if (!a) throw Error('Tambah YDD rambut dahulu, lalu pilih YTD rambut.');
    const token = generation;
    const next = await readTextures(files);
    if (!next.length) throw Error('YTD tidak berisi tekstur rambut.');
    if (token !== generation || !attachments.includes(a)) return;
    const candidate = { ...a, textures: next };
    validateAttachments(attachments.map((item) => (item === a ? candidate : item)));
    a.textures = next;
    a.texture = '';
    build(a);
    refresh();
  }
  function refresh() {
    selectedHair = Math.min(selectedHair, Math.max(0, attachments.length - 1));
    $('HairTargetRow').hidden = !attachments.length;
    $('HairTarget').replaceChildren(
      ...attachments.map((a, i) => {
        const option = document.createElement('option');
        option.value = i;
        option.textContent = a.name;
        return option;
      }),
    );
    $('HairTarget').value = selectedHair;
    $('HairList').replaceChildren();
    attachments.forEach((a, i) => {
      const card = document.createElement('section');
      card.className = 'hair-card';
      const title = document.createElement('strong');
      title.textContent = a.name;
      card.append(title);
      function field(label, element) {
        const row = document.createElement('label');
        row.append(document.createTextNode(label), element);
        card.append(row);
      }
      function select(label, names, value, change) {
        const el = document.createElement('select');
        for (const [value, text] of names) {
          const o = document.createElement('option');
          o.value = value;
          o.textContent = text;
          el.append(o);
        }
        el.value = value;
        el.dataset.control = label;
        el.onchange = () => {
          if (!busy) change(el.value);
        };
        field(label, el);
      }
      select(
        'Drawable rambut',
        a.drawables.map((d, index) => [index, d.name]),
        a.drawable,
        (value) => {
          a.drawable = Number(value);
          a.texture = '';
          build(a);
          refresh();
        },
      );
      const available = [...a.textures, ...(a.drawables[a.drawable].embeddedTextures || [])];
      select(
        'Tekstur rambut',
        [
          ['', 'Otomatis · nama material'],
          ...available.map((t, index) => [index, t.name + ' · ' + (t.dictionary || 'embedded')]),
        ],
        a.texture,
        (value) => {
          a.texture = value;
          build(a);
          refresh();
        },
      );
      const visible = document.createElement('input');
      visible.type = 'checkbox';
      visible.checked = a.visible;
      visible.onchange = () => {
        if (!busy) {
          a.visible = visible.checked;
          transform(a);
        }
      };
      field('Tampilkan rambut', visible);
      const transforms = document.createElement('div');
      transforms.className = 'hair-transform';
      for (const [key, label] of [
        ['x', 'X · kanan'],
        ['y', 'Y · atas'],
        ['z', 'Z · depan'],
        ['rx', 'Rot X°'],
        ['ry', 'Rot Y°'],
        ['rz', 'Rot Z°'],
        ['scale', 'Skala'],
      ]) {
        const row = document.createElement('label'),
          el = document.createElement('input');
        el.type = 'number';
        el.step = key.startsWith('r') ? '1' : '0.01';
        el.value = a[key];
        el.dataset.transform = key;
        if (key === 'scale') el.min = '0.01';
        el.onchange = () => {
          if (busy) return;
          const n = Number(el.value),
            limit = key.startsWith('r') ? 3600 : key === 'scale' ? 100 : 1000;
          if (
            el.value === '' ||
            !Number.isFinite(n) ||
            Math.abs(n) > limit ||
            (key === 'scale' && n < 0.01)
          ) {
            el.value = a[key];
            toast('Nilai transform rambut tidak valid.');
            return;
          }
          a[key] = n;
          transform(a);
        };
        row.append(document.createTextNode(label), el);
        transforms.append(row);
      }
      card.append(transforms);
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.ytd';
      input.multiple = true;
      input.hidden = true;
      input.dataset.control = 'hair-textures';
      input.onchange = () => {
        const files = [...input.files];
        input.value = '';
        if (files.length) operation(() => replaceTextures(a, files));
      };
      card.append(input);
      for (const [label, action] of [
        ['Ganti YTD rambut', () => input.click()],
        [
          'Reset posisi',
          () => {
            Object.assign(a, { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, scale: 1 });
            transform(a);
            refresh();
          },
        ],
        [
          'Hapus rambut',
          () => {
            dispose(a);
            const selected = attachments[selectedHair];
            attachments.splice(i, 1);
            selectedHair = Math.max(0, attachments.indexOf(selected));
            refresh();
            onChange(false);
          },
        ],
      ]) {
        const b = document.createElement('button');
        b.textContent = label;
        b.onclick = () => {
          if (!busy) action();
        };
        card.append(b);
      }
      const info = document.createElement('p');
      info.className = 'muted';
      info.textContent = a.triangles + ' segitiga · ' + a.warning;
      card.append(info);
      $('HairList').append(card);
    });
    $('HairStatus').textContent = attachments.length
      ? attachments.length + ' rambut tambahan · preview saja.'
      : 'Belum ada rambut tambahan.';
  }
  let generation = 0;
  $('AddHair').onclick = () => {
    if (!hasBase()) toast('Buka model muka/ped terlebih dahulu.');
    else $('HairInput').click();
  };
  $('HairTarget').onchange = () => {
    selectedHair = Number($('HairTarget').value);
  };
  $('AddHairTextures').onclick = () => $('HairTextureInput').click();
  $('HairTextureInput').onchange = () => {
    const files = [...$('HairTextureInput').files];
    $('HairTextureInput').value = '';
    if (files.length) operation(() => replaceTextures(attachments[selectedHair], files));
  };
  $('HairInput').onchange = () => {
    const files = [...$('HairInput').files];
    $('HairInput').value = '';
    if (!files.length) return;
    const token = generation;
    operation(async () => {
      if (!hasBase()) throw Error('Buka model muka/ped terlebih dahulu.');
      const models = files.filter((f) => /\.ydd$/i.test(f.name));
      if (!models.length && files.every((f) => /\.ytd$/i.test(f.name))) {
        await replaceTextures(attachments[selectedHair], files);
        return;
      }
      if (models.length !== 1 || files.some((f) => !/\.(ydd|ytd)$/i.test(f.name)))
        throw Error('Pilih satu YDD rambut, beserta YTD opsional.');
      const f = models[0];
      if (f.size > MAX_FILE) throw Error('YDD rambut maksimum 64 MB.');
      const drawables = readYdd(await f.arrayBuffer()),
        textures = await readTextures(files.filter((f) => /\.ytd$/i.test(f.name)));
      if (token !== generation || !hasBase()) return;
      const a = {
        name: f.name,
        sourceSize: f.size,
        drawables,
        textures,
        drawable: 0,
        texture: '',
        visible: true,
        x: 0,
        y: 0,
        z: 0,
        rx: 0,
        ry: 0,
        rz: 0,
        scale: 1,
      };
      validateAttachments([...attachments, a]);
      build(a);
      attachments.push(a);
      selectedHair = attachments.length - 1;
      root.open = true;
      refresh();
      onChange(true);
    });
  };
  return {
    group,
    clear() {
      generation++;
      attachments.forEach(dispose);
      attachments = [];
      refresh();
    },
    setWireframe(value) {
      wireframe = value;
      group.traverse((o) => {
        if (o.isMesh) o.material.wireframe = value;
      });
    },
  };
}
