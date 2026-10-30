import * as THREE from 'three';
import { pngDimensions } from './canvas-project.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import {
  transformKeys,
  snapshotObject,
  validTransform,
  writeObject,
  validateSceneProject,
} from './scene-state.js';
export function mountSceneStudio({
  container,
  viewport,
  prefix,
  scene,
  camera,
  getRenderer,
  getControls,
  getObjects,
  download,
  toast,
  onTransform = () => {},
  onVisibility = () => {},
  getVehicle,
  loadVehicle,
  markVehicleSaved,
  managedTransforms = false,
  onSelect = () => {},
  hasExternalEdits = () => false,
}) {
  const root = document.createElement('details');
  root.className = 'scene-studio';
  root.open = true;
  root.innerHTML = `<summary>SCENE STUDIO · manual</summary><label>Objek<select id="${prefix}Object"></select></label><div class="ss-mode" role="group" aria-label="Transformasi 3D"><button data-mode="translate" title="Geser (W)">Geser</button><button data-mode="rotate" title="Putar (E)">Putar</button><button data-mode="scale" title="Skala (R)">Skala</button></div><div class="ss-options"><label>Ruang<select id="${prefix}Space"><option value="world">World</option><option value="local">Local</option></select></label><label class="check"><input id="${prefix}Snap" type="checkbox">Snap</label></div><div id="${prefix}Fields" class="ss-fields"></div><div class="ss-actions"><button id="${prefix}Undo">Undo 3D</button><button id="${prefix}Redo">Redo 3D</button><button id="${prefix}Reset">Reset objek</button><button id="${prefix}Visible">Sembunyikan objek</button></div><details><summary>Kamera &amp; lighting</summary><label>FOV<input id="${prefix}Fov" type="range" min="15" max="100" value="${camera.fov}"></label><label>Lighting<select id="${prefix}Light"><option value="neutral">Neutral studio</option><option value="warm">Warm studio</option><option value="cool">Cool studio</option></select></label><label>Intensitas<input id="${prefix}Intensity" type="range" min="0.1" max="3" step="0.1" value="1"></label><label>Background<input id="${prefix}Background" type="color" value="#171a21"></label></details><details><summary>Backdrop &amp; proyek</summary><div class="ss-actions"><button id="${prefix}Backdrop">Tambah backdrop PNG</button><button id="${prefix}DeleteBackdrop">Hapus backdrop</button><button id="${prefix}Save">Simpan scene</button><button id="${prefix}Open">Buka scene</button></div><input id="${prefix}ImageInput" type="file" accept="image/png,image/jpeg,image/webp" hidden><input id="${prefix}ProjectInput" type="file" accept=".json" hidden><p class="muted">Scene menyimpan transformasi, kamera, lighting dan backdrop. Buka model/LOD/extra yang sama saat memuat. Transformasi preview tidak ditulis ke YDD/YFT.</p></details><p id="${prefix}Status" class="muted" role="status">Klik objek di viewport, atau pilih dari daftar.</p>`;
  container.prepend(root);
  const $ = (suffix) => root.querySelector('#' + prefix + suffix);
  const toolbar = document.createElement('div');
  toolbar.className = 'scene-toolbar';
  toolbar.setAttribute('aria-label', 'Alat transformasi scene');
  toolbar.innerHTML =
    '<button data-mode="translate" title="Geser (W)">↔</button><button data-mode="rotate" title="Putar (E)">↻</button><button data-mode="scale" title="Skala (R)">⤢</button>';
  toolbar.querySelectorAll('button').forEach((b) => b.setAttribute('aria-label', b.title));
  viewport.append(toolbar);
  viewport.tabIndex = 0;
  let gizmo,
    signature = '',
    selected = '',
    transformMode = 'translate',
    gizmoActive = false,
    before = null,
    history = [],
    future = [],
    dirty = false,
    props = [],
    transforms = new Map(),
    originals = new Map(),
    initialLights = null;
  const all = () => [
    ...getObjects(),
    ...props.map((p) => ({ key: p.id, object: p.mesh, label: p.name })),
  ];
  const current = () => all().find((e) => e.key === selected);
  const render = () => getRenderer()?.render(scene, camera);
  function notify(entry) {
    if (!entry) return;
    transforms.set(entry.key, snapshotObject(entry.object));
    if (!entry.key.startsWith('backdrop:')) {
      onTransform(entry.key, entry.object);
      onVisibility(entry.key, !entry.object.visible);
    }
    dirty = true;
  }
  function ensure() {
    const renderer = getRenderer(),
      controls = getControls();
    if (gizmo || !renderer || !controls) return;
    gizmo = new TransformControls(camera, renderer.domElement);
    scene.add(gizmo.getHelper());
    gizmo.setMode(transformMode);
    gizmo.addEventListener('dragging-changed', (e) => {
      controls.enabled = !e.value;
    });
    gizmo.addEventListener('mouseDown', () => {
      before = current() ? snapshotObject(current().object) : null;
    });
    gizmo.addEventListener('objectChange', () => {
      fill();
      render();
    });
    gizmo.addEventListener('mouseUp', () => {
      const entry = current();
      if (!entry || !before) return;
      const after = snapshotObject(entry.object);
      if (!validTransform(after)) {
        writeObject(entry.object, before);
        toast('Transform dibatalkan: skala/posisi di luar batas.');
      } else record(entry.key, before, after);
      before = null;
      fill();
      render();
    });
    renderer.domElement.addEventListener('pointerdown', (e) => {
      renderer.domElement.dataset.ssDown = JSON.stringify([e.clientX, e.clientY]);
    });
    renderer.domElement.addEventListener('pointerup', (e) => {
      if (!gizmoActive || gizmo.dragging || gizmo.axis) return;
      const start = JSON.parse(renderer.domElement.dataset.ssDown || '[0,0]');
      if (Math.hypot(start[0] - e.clientX, start[1] - e.clientY) > 5) return;
      const rect = renderer.domElement.getBoundingClientRect(),
        ray = new THREE.Raycaster();
      ray.setFromCamera(
        new THREE.Vector2(
          ((e.clientX - rect.left) / rect.width) * 2 - 1,
          (-(e.clientY - rect.top) / rect.height) * 2 + 1,
        ),
        camera,
      );
      const entries = all().filter((e) => e.object.visible),
        hit = ray.intersectObjects(
          entries.map((e) => e.object),
          false,
        )[0];
      if (hit) {
        selected = entries.find((e) => e.object === hit.object).key;
        choose();
      }
    });
  }
  function record(key, a, b) {
    if (JSON.stringify(a) === JSON.stringify(b)) return;
    history.push({ key, before: a, after: b });
    if (history.length > 40) history.shift();
    future = [];
    notify(all().find((e) => e.key === key));
  }
  function fill() {
    const entry = current(),
      t = entry ? snapshotObject(entry.object) : null;
    for (const key of transformKeys) {
      $(key).disabled = !entry;
      $(key).value = t ? +t[key].toFixed(4) : key.startsWith('s') ? 1 : 0;
    }
    $('Undo').disabled = !history.length;
    $('Redo').disabled = !future.length;
    $('Reset').disabled = $('Visible').disabled = !entry;
    $('Visible').textContent = entry?.object.visible ? 'Sembunyikan objek' : 'Tampilkan objek';
    $('DeleteBackdrop').disabled = !props.some((p) => p.id === selected);
    toolbar.querySelectorAll('button').forEach((b) => (b.disabled = !entry));
    for (const id of ['Backdrop', 'Save', 'Open'])
      $(id).disabled = !signature || !getRenderer() || !getControls();
  }
  function choose(notifySelection = true) {
    ensure();
    const entry = current();
    if (gizmoActive && entry && entry.object.visible) gizmo?.attach(entry.object);
    else gizmo?.detach();
    $('Object').value = selected;
    if (notifySelection && entry && !entry.key.startsWith('backdrop:')) onSelect(entry.key);
    fill();
    render();
  }
  function changeMode(mode, active = true) {
    gizmoActive = active;
    transformMode = mode;
    gizmo?.setMode(mode);
    choose();
    [root, toolbar].forEach((host) =>
      host.querySelectorAll('[data-mode]').forEach((b) => {
        b.classList.toggle('active', b.dataset.mode === mode);
        b.setAttribute('aria-pressed', String(b.dataset.mode === mode));
      }),
    );
  }
  for (const key of transformKeys) {
    const label = document.createElement('label');
    label.textContent = key.toUpperCase();
    const input = document.createElement('input');
    input.type = 'number';
    input.id = prefix + key;
    input.step = key.startsWith('r') ? '1' : '0.01';
    input.onchange = () => {
      const entry = current();
      if (!entry) return;
      const a = snapshotObject(entry.object),
        b = { ...a, [key]: Number(input.value) };
      if (!validTransform(b)) {
        fill();
        return toast('Posisi/rotasi terbatas dan skala harus 0,001–100.');
      }
      writeObject(entry.object, b);
      record(entry.key, a, b);
      fill();
      render();
    };
    label.append(input);
    $('Fields').append(label);
  }
  [root, toolbar].forEach((host) =>
    host
      .querySelectorAll('[data-mode]')
      .forEach((b) => (b.onclick = () => changeMode(b.dataset.mode))),
  );
  $('Object').onchange = () => {
    gizmoActive = true;
    selected = $('Object').value;
    choose();
  };
  $('Space').onchange = () => gizmo?.setSpace($('Space').value);
  $('Snap').onchange = () => {
    const enabled = $('Snap').checked;
    gizmo?.setTranslationSnap(enabled ? 0.1 : null);
    gizmo?.setRotationSnap(enabled ? Math.PI / 12 : null);
    gizmo?.setScaleSnap(enabled ? 0.1 : null);
  };
  for (const [id, from, to, state] of [
    ['Undo', () => history, () => future, 'before'],
    ['Redo', () => future, () => history, 'after'],
  ])
    $(id).onclick = () => {
      const item = from().pop();
      if (!item) return;
      const entry = all().find((e) => e.key === item.key);
      if (!entry) return;
      writeObject(entry.object, item[state]);
      to().push(item);
      selected = item.key;
      notify(entry);
      choose();
    };
  $('Reset').onclick = () => {
    const entry = current(),
      t = originals.get(selected);
    if (entry && t) {
      const a = snapshotObject(entry.object);
      writeObject(entry.object, t);
      record(entry.key, a, t);
      choose();
    }
  };
  $('Visible').onclick = () => {
    const entry = current();
    if (!entry) return;
    const a = snapshotObject(entry.object);
    entry.object.visible = !entry.object.visible;
    onVisibility(entry.key, !entry.object.visible);
    record(entry.key, a, snapshotObject(entry.object));
    choose();
  };
  function lighting() {
    const lights = [];
    scene.traverse((o) => {
      if (o.isHemisphereLight || o.isDirectionalLight) lights.push(o);
    });
    initialLights ||= lights.map((l) => ({
      light: l,
      intensity: l.intensity,
      color: l.color.clone(),
      ground: l.groundColor?.clone(),
    }));
    const preset = $('Light').value,
      m = Number($('Intensity').value);
    for (const item of initialLights) {
      item.light.intensity = item.intensity * m;
      item.light.color.copy(
        preset === 'neutral'
          ? item.color
          : new THREE.Color(preset === 'warm' ? '#ffe1bb' : '#bfdcff'),
      );
    }
    render();
  }
  for (const id of ['Light', 'Intensity'])
    $(id).oninput = () => {
      lighting();
      dirty = true;
    };
  $('Fov').oninput = () => {
    camera.fov = Number($('Fov').value);
    camera.updateProjectionMatrix();
    render();
    dirty = true;
  };
  $('Background').oninput = () => {
    scene.background = new THREE.Color($('Background').value);
    render();
    dirty = true;
  };
  async function imageCanvas(file) {
    if (file.size > 32 * 1024 * 1024) throw Error('Backdrop maksimum 32 MB.');
    const bitmap = await createImageBitmap(file);
    try {
      if (bitmap.width * bitmap.height > 16777216) throw Error('Backdrop maksimum 16 megapixel.');
      const scale = Math.min(1, 2048 / Math.max(bitmap.width, bitmap.height)),
        canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      return canvas;
    } finally {
      bitmap.close();
    }
  }
  function makeProp(image, name, id = 'backdrop:' + crypto.randomUUID()) {
    const texture = new THREE.CanvasTexture(image);
    texture.colorSpace = THREE.SRGBColorSpace;
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(image.width / image.height, 1),
      new THREE.MeshBasicMaterial({
        map: texture,
        side: THREE.DoubleSide,
        transparent: true,
        alphaTest: 0.02,
      }),
    );
    mesh.name = name;
    scene.add(mesh);
    return { id, name, mesh, image };
  }
  function release(p) {
    scene.remove(p.mesh);
    p.mesh.geometry.dispose();
    p.mesh.material.map.dispose();
    p.mesh.material.dispose();
  }
  function clearProps() {
    props.forEach(release);
    props = [];
  }
  $('Backdrop').onclick = () => $('ImageInput').click();
  $('ImageInput').onchange = async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      if (props.length >= 8) throw Error('Maksimum 8 backdrop.');
      const image = await imageCanvas(file);
      if (
        props.reduce((n, p) => n + p.image.width * p.image.height, 0) + image.width * image.height >
        16777216
      )
        throw Error('Total backdrop maksimum 16 megapixel.');
      const p = makeProp(image, file.name.slice(0, 150));
      p.mesh.position.copy(getControls().target);
      p.mesh.position.z -= 1;
      props.push(p);
      originals.set(p.id, snapshotObject(p.mesh));
      selected = p.id;
      dirty = true;
      refresh(signature);
    } catch (e) {
      toast(e.message);
    }
  };
  $('DeleteBackdrop').onclick = () => {
    const p = props.find((p) => p.id === selected);
    if (!p) return;
    gizmo?.detach();
    release(p);
    props = props.filter((e) => e !== p);
    transforms.delete(p.id);
    history = [];
    future = [];
    selected = '';
    dirty = true;
    refresh(signature);
  };
  $('Save').onclick = async () => {
    try {
      if (!signature) throw Error('Buka model sebelum menyimpan scene.');
      const controls = getControls();
      const data = {
        format: 'ditasha-scene',
        version: 1,
        source: signature,
        objects: getObjects().map((e) => ({ key: e.key, transform: snapshotObject(e.object) })),
        props: props.map((p) => ({
          name: p.name,
          image: p.image.toDataURL('image/png'),
          transform: snapshotObject(p.mesh),
        })),
        camera: {
          position: camera.position.toArray(),
          target: controls.target.toArray(),
          fov: camera.fov,
        },
        lighting: { preset: $('Light').value, intensity: Number($('Intensity').value) },
        background: scene.background?.isColor ? '#' + scene.background.getHexString() : null,
        vehicle: getVehicle?.() || null,
      };
      const json = JSON.stringify(data);
      if (new Blob([json]).size > 64 * 1024 * 1024) throw Error('Proyek scene maksimum 64 MB.');
      if (await download(json, 'ditasha-scene.json', 'application/json')) {
        dirty = false;
        markVehicleSaved?.();
        $('Status').textContent = 'Scene tersimpan. Model sumber tetap terpisah.';
      }
    } catch (e) {
      toast(e.message);
    }
  };
  $('Open').onclick = () => $('ProjectInput').click();
  $('ProjectInput').onchange = async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      if (file.size > 64 * 1024 * 1024) throw Error('Proyek scene maksimum 64 MB.');
      const p = validateSceneProject(
        JSON.parse(await file.text()),
        signature,
        new Set(getObjects().map((e) => e.key)),
      );
      const decoded = [];
      let pixels = 0;
      for (const prop of p.props) {
        const bytes = Uint8Array.from(atob(prop.image.split(',')[1]), (c) => c.charCodeAt(0));
        pngDimensions(bytes);
        const image = await imageCanvas(new Blob([bytes], { type: 'image/png' }));
        pixels += image.width * image.height;
        if (pixels > 16777216) throw Error('Total backdrop maksimum 16 megapixel.');
        decoded.push({ ...prop, image });
      }
      if (p.vehicle && loadVehicle) loadVehicle(p.vehicle, true);
      if ((dirty || hasExternalEdits()) && !confirm('Ganti perubahan scene yang belum disimpan?'))
        return;
      if (p.vehicle && loadVehicle) loadVehicle(p.vehicle);
      gizmo?.detach();
      clearProps();
      transforms.clear();
      for (const entry of p.objects) {
        const object = getObjects().find((e) => e.key === entry.key).object;
        writeObject(object, entry.transform);
        transforms.set(entry.key, entry.transform);
      }
      for (const prop of decoded) {
        const created = makeProp(prop.image, prop.name);
        writeObject(created.mesh, prop.transform);
        props.push(created);
        originals.set(created.id, snapshotObject(created.mesh));
      }
      camera.position.fromArray(p.camera.position);
      getControls().target.fromArray(p.camera.target);
      camera.fov = p.camera.fov;
      camera.updateProjectionMatrix();
      getControls().update();
      $('Fov').value = p.camera.fov;
      $('Light').value = p.lighting.preset;
      $('Intensity').value = p.lighting.intensity;
      lighting();
      if (p.background) $('Background').value = p.background;
      scene.background = p.background ? new THREE.Color(p.background) : null;
      history = [];
      future = [];
      dirty = false;
      refresh(signature);
      $('Status').textContent = 'Scene dimuat.';
    } catch (e) {
      toast(e.message);
    }
  };
  viewport.addEventListener('keydown', (e) => {
    if (e.target.closest('input,select,textarea') || e.ctrlKey || e.metaKey) return;
    const modes = { w: 'translate', e: 'rotate', r: 'scale' };
    if (modes[e.key.toLowerCase()]) {
      e.preventDefault();
      e.stopPropagation();
      changeMode(modes[e.key.toLowerCase()]);
    }
  });
  function refresh(next) {
    const changed = next !== signature;
    if (changed) {
      gizmo?.detach();
      clearProps();
      transforms.clear();
      originals.clear();
      history = [];
      future = [];
      signature = next;
      gizmoActive = false;
      dirty = false;
      selected = '';
    }
    ensure();
    const entries = all();
    $('Object').replaceChildren();
    for (const e of entries) {
      if (!originals.has(e.key)) originals.set(e.key, snapshotObject(e.object));
      if (transforms.has(e.key) && (!managedTransforms || e.key.startsWith('backdrop:')))
        writeObject(e.object, transforms.get(e.key));
      const option = document.createElement('option');
      option.value = e.key;
      option.textContent = e.label || e.object.name;
      $('Object').append(option);
    }
    if (!entries.some((e) => e.key === selected)) selected = entries[0]?.key || '';
    choose(false);
    return changed;
  }
  changeMode('translate', false);
  fill();
  return {
    root,
    refresh,
    selectedObject: () => current()?.object || null,
    captureSession: () => ({
      signature,
      dirty,
      selected,
      objects: getObjects().map((e) => ({ key: e.key, transform: snapshotObject(e.object) })),
      props: props.map((p) => ({
        id: p.id,
        name: p.name,
        image: p.image,
        transform: snapshotObject(p.mesh),
      })),
      camera: {
        position: camera.position.toArray(),
        target: getControls()?.target.toArray(),
        fov: camera.fov,
      },
      lighting: { preset: $('Light').value, intensity: $('Intensity').value },
      background: scene.background?.isColor ? '#' + scene.background.getHexString() : null,
    }),
    resetSession: () => {
      gizmo?.detach();
      clearProps();
      signature = '';
      gizmoActive = false;
      selected = '';
      transforms.clear();
      originals.clear();
      history = [];
      future = [];
      dirty = false;
      fill();
    },
    restoreSession: (state) => {
      if (!state || state.signature !== signature) return;
      for (const e of state.objects) {
        const object = getObjects().find((o) => o.key === e.key)?.object;
        if (object) {
          writeObject(object, e.transform);
          transforms.set(e.key, e.transform);
        }
      }
      clearProps();
      for (const p of state.props) {
        const created = makeProp(p.image, p.name, p.id);
        writeObject(created.mesh, p.transform);
        props.push(created);
        originals.set(created.id, snapshotObject(created.mesh));
      }
      selected = state.selected;
      dirty = state.dirty;
      camera.position.fromArray(state.camera.position);
      camera.fov = state.camera.fov;
      camera.updateProjectionMatrix();
      if (state.camera.target) getControls()?.target.fromArray(state.camera.target);
      $('Fov').value = state.camera.fov;
      $('Light').value = state.lighting.preset;
      $('Intensity').value = state.lighting.intensity;
      lighting();
      scene.background = state.background ? new THREE.Color(state.background) : null;
      if (state.background) $('Background').value = state.background;
      refresh(signature);
      render();
    },
    detach: () => gizmo?.detach(),
    cleanCapture: async (task) => {
      const helper = gizmo?.getHelper(),
        visible = helper?.visible;
      if (helper) helper.visible = false;
      render();
      try {
        return await task();
      } finally {
        if (helper) helper.visible = visible;
        render();
      }
    },
    unsavedItems: () => (dirty ? [{ name: 'Scene Studio · scene belum disimpan' }] : []),
  };
}
