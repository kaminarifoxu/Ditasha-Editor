import { mountMinimalUi } from './ui-minimal.js';
import { mountPhotoshoot } from './photoshoot.js';
import * as THREE from 'three';
import { mountTools } from './tools-ui.js';
import { mountMaterialPreview } from './material-preview.js';
import { mountPedAttachments } from './ped-attachments.js';
import { readDds } from './asset-tools.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { readYtd, writeYtd, readYdd, readYdr, readYft } from './resource.js';
import {
  makeLayer,
  cropLayer,
  drawLayers,
  drawUV,
  normalizeRect,
  validSize,
  layerPoint,
  localPoint,
  resizedLayer,
  layerBounds,
  normalizedAngle,
  eraseAt,
  resizeHandles,
  resizeFromHandle,
} from './editor.js';
const $ = (id) => document.getElementById(id),
  canvas = $('textureCanvas'),
  ctx = canvas.getContext('2d'),
  files = [],
  textures = [];
let current = null,
  activeFile = null,
  modelFile = null,
  zoom = 1,
  brush = false,
  dirty = false,
  mapped = null;
let toastTimer;
let mode = 'move',
  gesture = null,
  cropRect = null,
  drawableIndex = 0,
  pendingYtd = null,
  displayedModel = null;
function toast(t) {
  $('toast').textContent = t;
  $('toast').style.display = 'block';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ($('toast').style.display = 'none'), 6000);
}
const viewport = $('viewport'),
  scene = new THREE.Scene(),
  camera = new THREE.PerspectiveCamera(35, 1, 0.01, 10000);
let renderer,
  controls,
  model = new THREE.Group();
scene.add(model);
const pedAttachments = mountPedAttachments({
  scene,
  container: document.querySelector('.inspector'),
  prefix: 'ped',
  toast,
  hasBase: () => !!displayedModel,
  onChange: (fit) => {
    if (fit) frame();
    else renderer?.render(scene, camera);
  },
});
const pedMaterials = mountMaterialPreview({
  container: document.querySelector('.inspector'),
  prefix: 'ped',
  onChange: () => renderer?.render(scene, camera),
});
scene.add(new THREE.HemisphereLight(0xffffff, 0x596679, 2));
const key = new THREE.DirectionalLight(0xffeee5, 3);
key.position.set(3, 6, 4);
scene.add(key);
const fill = new THREE.DirectionalLight(0xadcaff, 2);
fill.position.set(-4, 2, -3);
scene.add(fill);
let wire = false;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  viewport.prepend(renderer.domElement);
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  camera.position.set(2, 1, 3);
  new ResizeObserver(() => {
    const w = viewport.clientWidth,
      h = viewport.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.render(scene, camera);
  }).observe(viewport);
  renderer.setAnimationLoop(() => {
    controls.update();
    renderer.render(scene, camera);
  });
} catch {
  toast('WebGL tidak tersedia. Gunakan browser dengan akselerasi hardware untuk preview 3D.');
}
function clearModel() {
  pedMaterials.clear();
  model.traverse((o) => {
    if (o.isMesh) {
      o.geometry.dispose();
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.dispose();
    }
  });
  scene.remove(model);
  model = new THREE.Group();
  scene.add(model);
}
function frame() {
  if (!controls) return;
  let box = new THREE.Box3().setFromObject(model);
  box.union(new THREE.Box3().setFromObject(pedAttachments.group));
  if (box.isEmpty()) return;
  const center = box.getCenter(new THREE.Vector3()),
    sz = box.getSize(new THREE.Vector3()),
    d = Math.max(sz.x, sz.y, sz.z, 0.1);
  controls.target.copy(center);
  camera.position.copy(center).add(new THREE.Vector3(d * 0.9, d * 0.5, d * 2));
  camera.near = Math.max(0.001, d / 1000);
  camera.far = d * 1000;
  camera.updateProjectionMatrix();
  controls.update();
  renderer?.render(scene, camera);
}
function applyTexture() {
  if (mapped) {
    mapped.dispose();
    mapped = null;
  }
  if (current && $('apply').checked && (!current.isUV || current.layers?.some((l) => l.visible))) {
    mapped = new THREE.CanvasTexture(canvas);
    if (mapped) {
      mapped.flipY = false;
      mapped.colorSpace = THREE.SRGBColorSpace;
    }
  }
  model.traverse((o) => {
    if (o.isMesh) {
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        m.map = mapped || m.userData.originalMap || null;
        m.color?.set(mapped ? 0xffffff : 0xb3bbc8);
        m.wireframe = wire;
        m.needsUpdate = true;
      }
    }
  });
  pedMaterials.apply();
  renderer?.render(scene, camera);
}
function showDrawable(index) {
  if (!modelFile) return;
  drawableIndex = index;
  displayedModel = modelFile;
  clearModel();
  const d = modelFile.drawables[index];
  for (const [index, g] of d.geometries.entries()) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(g.positions, 3));
    if (g.uvs) geo.setAttribute('uv', new THREE.BufferAttribute(g.uvs, 2));
    geo.setIndex(new THREE.BufferAttribute(g.indices, 1));
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(
      geo,
      new THREE.MeshStandardMaterial({
        color: 0xb3bbc8,
        roughness: 0.75,
        metalness: 0,
        side: THREE.DoubleSide,
      }),
    );
    mesh.name =
      'Part ' +
      ((g.part ?? 0) + 1) +
      ' · mesh ' +
      (index + 1) +
      ' · ' +
      (g.diffuseTexture || 'tanpa diffuse');
    model.add(mesh);
  }
  modelReady();
  drawGuide();
  if ($('uvToggle').disabled) toast('Model ini tidak memiliki UV yang dapat digambar.');
}
function modelReady() {
  let tris = 0,
    verts = 0;
  model.traverse((o) => {
    if (o.isMesh) {
      verts += o.geometry.attributes.position.count;
      tris += (o.geometry.index?.count ?? o.geometry.attributes.position.count) / 3;
      for (const m of Array.isArray(o.material) ? o.material : [o.material])
        m.userData.originalMap = m.map;
    }
  });
  $('emptyModel').hidden = true;
  $('snapshot').disabled = !renderer;
  $('modelStats').textContent =
    `${Math.round(tris).toLocaleString('id-ID')} segitiga · ${verts.toLocaleString('id-ID')} vertex`;
  applyTexture();
  const meshes = [];
  model.traverse((o) => {
    if (o.isMesh) meshes.push(o);
  });
  pedMaterials.setMeshes(meshes);
  frame();
}
function makeCanvas(t) {
  const c = document.createElement('canvas');
  c.width = t.w;
  c.height = t.h;
  c.getContext('2d').putImageData(new ImageData(t.out, t.w, t.h), 0, 0);
  t.canvas = c;
  return t;
}
function refreshFiles() {
  renderTabs();
  const q = $('search').value.toLowerCase();
  $('fileCount').textContent = files.length + ' FILE';
  $('fileList').replaceChildren();
  for (const f of files.filter((f) => f.name.toLowerCase().includes(q))) {
    const b = document.createElement('button');
    b.className = 'file' + (f === activeFile ? ' selected' : '');
    const typ = document.createElement('span');
    typ.className = 'type';
    typ.textContent = f.ext.toUpperCase();
    const text = document.createElement('div'),
      title = document.createElement('strong'),
      small = document.createElement('small');
    title.textContent = f.name;
    title.title = f.name;
    small.textContent = (f.size / 1024).toFixed(0) + ' KB';
    text.append(title, small);
    b.append(typ, text);
    b.onclick = () => selectFile(f);
    const row = document.createElement('div');
    row.className = 'fileline';
    const del = document.createElement('button');
    del.className = 'filedelete';
    del.textContent = '×';
    del.title = 'Hapus file dari workspace';
    del.setAttribute('aria-label', 'Hapus ' + f.name);
    del.onclick = () => removeFile(f);
    row.append(b, del);
    $('fileList').append(row);
  }
}
function options(el, items) {
  el.replaceChildren();
  items.forEach((n, i) => {
    const o = document.createElement('option');
    o.value = i;
    o.textContent = n;
    el.append(o);
  });
}
function selectFile(f) {
  activeFile = f;
  refreshFiles();
  if (f.resource || f.textures) {
    textures.splice(0, textures.length, ...(f.resource?.textures || f.textures));
    renderTextures();
    selectTexture(0);
    $('ytdExport').disabled = !f.resource;
  }
  if (f.drawables) {
    if (displayedModel !== f) pedAttachments.clear();
    modelFile = f;
    f.uvTextures ??= f.drawables.map((d, i) => {
      const c = document.createElement('canvas');
      c.width = c.height = 1;
      return {
        name: 'UV · ' + d.name,
        w: 2048,
        h: 2048,
        canvas: c,
        out: new Uint8ClampedArray(0),
        format: 'UV MAP',
        isUV: true,
      };
    });
    textures.splice(0, textures.length, ...f.uvTextures);
    renderTextures();
    selectTexture(0);
    $('modelTitle').textContent = f.name;
    options(
      $('drawable'),
      f.drawables.map((d) => d.name),
    );
    showDrawable(0);
  }
  if (f.gltf) {
    if (displayedModel !== f) pedAttachments.clear();
    displayedModel = f;
    modelFile = null;
    clearModel();
    model.add(f.gltf.scene.clone(true));
    $('modelTitle').textContent = f.name;
    options($('drawable'), ['GLB model']);
    modelReady();
  }
}
function renderTextures() {
  $('texturestrip').replaceChildren();
  options(
    $('material'),
    textures.map((t) => t.name),
  );
  if (current && textures.includes(current)) $('material').value = textures.indexOf(current);
  textures.forEach((t, i) => {
    const b = document.createElement('button');
    b.className = 'texcard' + (t === current ? ' active' : '');
    const im = document.createElement('img');
    im.src = t.canvas.toDataURL();
    if (t.isUV) im.style.background = '#3948f0';
    const s = document.createElement('span');
    s.textContent = t.name;
    const small = document.createElement('small');
    small.textContent = `${t.w} × ${t.h} · ${t.format || 'IMAGE'}`;
    s.append(small);
    b.append(im, s);
    b.onclick = () => selectTexture(i);
    $('texturestrip').append(b);
  });
}
function initLayers(t) {
  if (t.layers) return;
  t.layers = t.isUV ? [] : [makeLayer(copyCanvas(t.canvas), t.name, t.w, t.h)];
  t.selected = t.layers.length - 1;
  t.history = [];
  t.future = [];
  t.layers.forEach((l) => (l.kind = t.format === 'IMAGE' ? 'Gambar' : 'YTD'));
}
function selectTexture(i) {
  if (!textures[i]) return;
  gesture = null;
  hideContext();
  current = textures[i];
  initLayers(current);
  canvas.width = current.w;
  canvas.height = current.h;
  canvas.hidden = false;
  $('canvasStack').hidden = false;
  $('emptyTexture').hidden = true;
  $('textureTitle').textContent = current.name;
  $('dimensions').textContent = `${current.w} × ${current.h}`;
  $('pngExport').disabled = false;
  $('editState').textContent = current.edited
    ? 'Tekstur diubah · belum diekspor'
    : 'Tidak ada perubahan';
  $('material').value = i;
  cropRect = null;
  zoom = 1;
  renderComposite();
  fitCanvas();
  renderLayers();
  drawGuide();
  [...$('texturestrip').children].forEach((b, j) => b.classList.toggle('active', i === j));
  $('ytdExport').disabled = !files.some((f) => f.resource && f.resource.textures.includes(current));
  applyTexture();
}
function fitCanvas() {
  if (!current) return;
  let area = $('canvasarea');
  let ratio =
    Math.min((area.clientWidth - 40) / current.w, (area.clientHeight - 40) / current.h, 1) * zoom;
  for (const c of [canvas, $('uvCanvas'), $('selectionCanvas')]) {
    c.style.width = current.w * ratio + 'px';
    c.style.height = current.h * ratio + 'px';
  }
  $('canvasStack').style.width = current.w * ratio + 'px';
  $('canvasStack').style.height = current.h * ratio + 'px';
  $('zoomLabel').textContent = Math.round(zoom * 100) + '%';
  drawSelection();
}
function commit() {
  if (!current) return;
  current.edited = true;
  current.revision = (current.revision || 0) + 1;
  current.canvas.width = current.w;
  current.canvas.height = current.h;
  current.canvas.getContext('2d').drawImage(canvas, 0, 0);
  current.out = ctx.getImageData(0, 0, current.w, current.h).data;
  dirty = true;
  $('editState').textContent = 'Tekstur diubah · belum diekspor';
  if (mapped) mapped.needsUpdate = true;
}
function snapshotState() {
  return {
    w: current.w,
    h: current.h,
    selected: current.selected,
    layers: current.layers.map((l) => ({ ...l })),
  };
}
function remember() {
  if (!current) return;
  current.history.push(snapshotState());
  current.future = [];
  if (current.history.length > 8) current.history.shift();
}
async function download(data, name, type) {
  const blob = data instanceof Blob ? data : new Blob([data], { type });
  if (window.ditashaDesktop?.saveExport) {
    const result = await window.ditashaDesktop.saveExport({
      name,
      data: new Uint8Array(await blob.arrayBuffer()),
    });
    return result.saved;
  }
  const u = URL.createObjectURL(blob),
    a = document.createElement('a');
  a.href = u;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(u), 10000);
  return true;
}
function png(c, name) {
  return new Promise((resolve) =>
    c.toBlob(async (b) => {
      if (!b) {
        resolve(false);
        return;
      }
      try {
        resolve(await download(b, name, 'image/png'));
      } catch (e) {
        toast(e.message);
        resolve(false);
      }
    }, 'image/png'),
  );
}
function workspaceTextures(state) {
  const fs = state?.files || files;
  return [...new Set(fs.flatMap((f) => f.resource?.textures || f.textures || f.uvTextures || []))];
}
function textureUnsaved(t) {
  return (t.revision || 0) > (t.savedRevision || 0);
}
function refreshDirty() {
  dirty = workspaceTextures().some(textureUnsaved);
  if (current)
    $('editState').textContent = textureUnsaved(current)
      ? 'Tekstur diubah · belum disimpan'
      : 'Semua perubahan tersimpan';
}
function markSaved(t, revision) {
  t.savedRevision = revision;
  t.edited = textureUnsaved(t);
  refreshDirty();
}
async function imageTexture(file) {
  const bitmap = await createImageBitmap(file);
  if (bitmap.width * bitmap.height > 16777216) {
    bitmap.close();
    throw Error('Gambar terlalu besar (maksimum 16 megapixel).');
  }
  const c = document.createElement('canvas');
  c.width = bitmap.width;
  c.height = bitmap.height;
  c.getContext('2d').drawImage(bitmap, 0, 0);
  bitmap.close();
  return {
    name: file.name,
    w: c.width,
    h: c.height,
    canvas: c,
    out: c.getContext('2d').getImageData(0, 0, c.width, c.height).data,
    format: 'IMAGE',
  };
}
async function loadFiles(list) {
  for (const file of list) {
    $('fileLoading').hidden = false;
    $('fileLoadingName').textContent = 'Membuka ' + file.name + '…';
    await new Promise((resolve) => setTimeout(resolve, 20));
    try {
      if (file.size > 64 * 1024 * 1024) throw Error('File terlalu besar (maksimum 64 MB).');
      const ext = file.name.split('.').pop().toLowerCase(),
        f = { name: file.name, ext, size: file.size };
      toast('Membuka ' + file.name + '…');
      if (ext === 'ytd') {
        f.resource = readYtd(await file.arrayBuffer());
        f.resource.textures.forEach(makeCanvas);
      } else if (['ydd', 'ydr', 'yft'].includes(ext)) {
        f.drawables = { ydd: readYdd, ydr: readYdr, yft: readYft }[ext](await file.arrayBuffer());
      } else if (['png', 'jpg', 'jpeg', 'webp'].includes(ext)) {
        f.textures = [await imageTexture(file)];
      } else if (ext === 'glb') {
        f.gltf = await new GLTFLoader().parseAsync(await file.arrayBuffer(), '');
      } else if (ext === 'dds') {
        f.textures = [makeCanvas(readDds(await file.arrayBuffer(), file.name))];
      } else throw Error('Pilih YFT, YDD, YDR, YTD, GLB, PNG, JPG atau WebP.');
      files.push(f);
      if (f.textures && current) {
        addTextureLayer(f.textures[0]);
        refreshFiles();
      } else selectFile(f);
      toast(file.name + ' berhasil dibuka.');
    } catch (e) {
      toast('Gagal membuka ' + file.name + ': ' + e.message);
    } finally {
      $('fileLoading').hidden = true;
    }
  }
  $('fileInput').value = '';
}
$('open').onclick = $('openTexture').onclick = () => $('fileInput').click();
$('fileInput').onchange = (e) => loadFiles(e.target.files);
$('drop').onclick = (e) => {
  if (e.target !== $('fileInput')) {
    e.preventDefault();
    $('fileInput').click();
  }
};
document.addEventListener('dragover', (e) => {
  e.preventDefault();
  $('drop').classList.add('drag');
});
document.addEventListener('dragleave', () => $('drop').classList.remove('drag'));
document.addEventListener('drop', (e) => {
  e.preventDefault();
  $('drop').classList.remove('drag');
  loadFiles(e.dataTransfer.files);
});
$('search').oninput = refreshFiles;
$('zoomIn').onclick = () => {
  zoom = Math.min(zoom * 1.25, 8);
  fitCanvas();
};
$('zoomOut').onclick = () => {
  zoom = Math.max(zoom / 1.25, 0.25);
  fitCanvas();
};
window.addEventListener('resize', fitCanvas);
$('replace').onclick = () => {
  if (!current) {
    toast('Buka tekstur terlebih dahulu.');
    return;
  }
  $('replaceInput').click();
};
$('pngExport').onclick = async () => {
  if (!current) return;
  finishGesture();
  const t = current,
    revision = t.revision || 0;
  const copy = copyCanvas(canvas);
  if (await png(copy, t.name.replace(/\.[^.]+$/, '') + '.png')) {
    markSaved(t, revision);
    toast('PNG berhasil disimpan.');
  }
};
$('ytdExport').onclick = async () => {
  try {
    finishGesture();
    const f = files.find((f) => f.resource && f.resource.textures.includes(current));
    if (!f) throw Error('Buka YTD terlebih dahulu.');
    const revisions = f.resource.textures.map((t) => [t, t.revision || 0]);
    if (
      await download(
        writeYtd(f.resource, f.resource.textures),
        f.name.replace(/\.ytd$/i, '_edited.ytd'),
        'application/octet-stream',
      )
    ) {
      revisions.forEach(([t, revision]) => markSaved(t, revision));
      toast('YTD berhasil disimpan · BGRA / 1 mipmap.');
    }
  } catch (e) {
    toast(e.message);
  }
};
$('material').onchange = (e) => selectTexture(Number(e.target.value));
$('drawable').onchange = (e) => {
  if (!modelFile) return;
  const i = Number(e.target.value);
  if (current?.isUV && modelFile.uvTextures?.includes(current)) {
    textures.splice(0, textures.length, ...modelFile.uvTextures);
    renderTextures();
    selectTexture(i);
  }
  showDrawable(i);
};
$('apply').onchange = applyTexture;
$('reset').onclick = frame;
$('wire').onclick = () => {
  wire = !wire;
  $('wire').classList.toggle('active', wire);
  pedAttachments.setWireframe(wire);
  model.traverse((o) => {
    if (o.isMesh)
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.wireframe = wire;
  });
};
$('snapshot').onclick = () => {
  if (renderer) {
    renderer.render(scene, camera);
    png(renderer.domElement, 'ditasha-model-preview.png');
  }
};
$('help').onclick = () => $('helpDialog').showModal();
$('closeHelp').onclick = () => $('helpDialog').close();
window.addEventListener('beforeunload', (e) => {
  if (unsavedItems().length) {
    e.preventDefault();
    e.returnValue = '';
  }
});
if (document.modelContext?.registerTool) {
  const lifecycle = new AbortController();
  const register = (tool) => {
    try {
      Promise.resolve(document.modelContext.registerTool(tool, { signal: lifecycle.signal })).catch(
        () => {},
      );
    } catch {}
  };
  register({
    name: 'read_asset_workspace',
    description: 'Read the currently opened files, texture names and model availability.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, untrustedContentHint: true },
    execute: () => ({
      files: files.map((f) => ({ name: f.name, type: f.ext })),
      textures: textures.map((t) => ({ name: t.name, width: t.w, height: t.h })),
      selectedTexture: current?.name ?? null,
      layers:
        current?.layers?.map((l) => ({
          name: l.name,
          kind: l.kind,
          flipX: l.flipX,
          flipY: l.flipY,
          opacity: l.opacity,
        })) || [],
      modelLoaded: model.children.length > 0,
    }),
  });
  register({
    name: 'select_preview_texture',
    description:
      'Select an already loaded texture and apply it to the visible preview when enabled.',
    inputSchema: {
      type: 'object',
      properties: { index: { type: 'integer', minimum: 0 } },
      required: ['index'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, untrustedContentHint: true },
    execute: (input) => {
      if (
        !input ||
        !Number.isInteger(input.index) ||
        input.index < 0 ||
        input.index >= textures.length
      )
        throw Error('Invalid texture index.');
      selectTexture(input.index);
      return { selected: current.name, width: current.w, height: current.h };
    },
  });
  window.addEventListener('pagehide', () => lifecycle.abort(), { once: true });
}
function copyCanvas(c) {
  const result = document.createElement('canvas');
  result.width = c.width;
  result.height = c.height;
  result.getContext('2d').drawImage(c, 0, 0);
  return result;
}
function selectedLayer() {
  return current?.layers?.[current.selected];
}
function renderComposite(mark = false) {
  if (!current) return;
  if (canvas.width !== current.w || canvas.height !== current.h) {
    canvas.width = current.w;
    canvas.height = current.h;
  }
  drawLayers(ctx, current.layers, current.w, current.h);
  if (mapped) mapped.needsUpdate = true;
  drawSelection();
  syncTransform();
  if (mark) commit();
}
function syncTransform() {
  const l = selectedLayer();
  $('layerName').disabled = !l;
  $('layerName').value = l?.name || '';
  for (const id of ['mirrorX', 'mirrorY', 'duplicateLayer', 'opacity', 'layerUp', 'layerDown'])
    $(id).disabled = !l;
  $('mirrorX').classList.toggle('active', !!l?.flipX);
  $('mirrorY').classList.toggle('active', !!l?.flipY);
  $('opacity').value = Math.round((l?.opacity ?? 1) * 100);
  $('opacityValue').textContent = $('opacity').value + '%';
  $('undo').disabled = !current?.history?.length;
  $('redo').disabled = !current?.future?.length;
  $('layerAngle').disabled = !l;
  $('layerAngle').value = l ? Math.round(l.angle || 0) : 0;
  $('rotateLeft').disabled = $('rotateRight').disabled = !l;
  for (const [id, key] of [
    ['layerX', 'x'],
    ['layerY', 'y'],
    ['layerW', 'w'],
    ['layerH', 'h'],
  ]) {
    $(id).disabled = !l;
    $(id).value = l ? Math.round(l[key]) : 0;
  }
  $('deleteLayer').disabled = !l;
  $('fitImage').disabled = !l || l.locked;
  for (const id of [
    'layerName',
    'layerX',
    'layerY',
    'layerW',
    'layerH',
    'layerAngle',
    'rotateLeft',
    'rotateRight',
    'mirrorX',
    'mirrorY',
    'opacity',
    'deleteLayer',
  ])
    $(id).disabled = !l || l.locked;
  $('applyCrop').hidden = !cropRect;
  $('cancelCrop').hidden = !cropRect;
}
function renderLayers() {
  if (!current) {
    $('layers').replaceChildren();
    $('layerCount').textContent = 0;
    syncTransform();
    return;
  }
  $('layers').replaceChildren();
  $('layerCount').textContent = current.layers.length;
  [...current.layers]
    .map((l, i) => ({ l, i }))
    .reverse()
    .forEach(({ l, i }) => {
      const row = document.createElement('div');
      row.className = 'layeritem' + (i === current.selected ? ' selected' : '');
      const vis = document.createElement('button');
      vis.className = 'visibility';
      vis.textContent = l.visible ? '◉' : '○';
      vis.title = l.visible ? 'Sembunyikan layer' : 'Tampilkan layer';
      vis.onclick = () => {
        remember();
        l.visible = !l.visible;
        refreshEdit();
      };
      const b = document.createElement('button');
      b.className = 'layerselect';
      b.title = l.name;
      const img = document.createElement('img');
      img.className = 'layerthumb';
      img.src = l.source.toDataURL();
      const text = document.createElement('span');
      text.className = 'layercopy';
      const name = document.createElement('strong');
      name.textContent = l.name;
      const type = document.createElement('small');
      type.textContent = (l.kind || 'Gambar') + (l.locked ? ' · Terkunci' : '');
      row.oncontextmenu = (e) => {
        e.preventDefault();
        current.selected = i;
        renderLayers();
        drawSelection();
        showContext(e);
      };
      text.append(name, type);
      b.append(img, text);
      b.onclick = () => {
        current.selected = i;
        cropRect = null;
        setMode('move');
        renderComposite();
        renderLayers();
      };
      const del = document.createElement('button');
      del.className = 'layerdelete';
      del.textContent = '×';
      del.title = 'Hapus layer';
      del.setAttribute('aria-label', 'Hapus layer ' + l.name);
      del.onclick = () => deleteLayerAt(i);
      row.append(vis, b, del);
      $('layers').append(row);
    });
  syncTransform();
}
function drawGuide() {
  const uv = $('uvCanvas');
  if (!current) return;
  uv.width = current.w;
  uv.height = current.h;
  const d = modelFile?.drawables?.[drawableIndex];
  if (d) {
    const n = drawUV(uv.getContext('2d'), d.geometries, current.w, current.h);
    $('uvToggle').disabled = !n;
    uv.style.opacity = current.layers?.some((l) => l.visible) ? '.3' : '1';
  } else {
    $('uvToggle').disabled = true;
  }
  uv.hidden = !$('uvToggle').checked;
}
function drawSelection() {
  if (!current) return;
  const c = $('selectionCanvas');
  if (c.width !== current.w || c.height !== current.h) {
    c.width = current.w;
    c.height = current.h;
  }
  const cctx = c.getContext('2d');
  cctx.clearRect(0, 0, c.width, c.height);
  const ratio = (canvas.getBoundingClientRect().width || canvas.width) / canvas.width,
    px = 1 / ratio,
    l = selectedLayer();
  if (mode === 'move' && l?.visible) {
    cctx.save();
    cctx.translate(l.x + l.w / 2, l.y + l.h / 2);
    cctx.rotate(((l.angle || 0) * Math.PI) / 180);
    cctx.strokeStyle = '#ffab6d';
    cctx.lineWidth = 1.5 * px;
    cctx.setLineDash([5 * px, 3 * px]);
    cctx.strokeRect(-l.w / 2, -l.h / 2, l.w, l.h);
    cctx.setLineDash([]);
    cctx.fillStyle = '#ff914d';
    for (const [hx, hy] of resizeHandles) {
      cctx.fillStyle = l.locked ? '#857b81' : '#e2bb76';
      cctx.fillRect((hx - 0.5) * l.w - 5 * px, (hy - 0.5) * l.h - 5 * px, 10 * px, 10 * px);
      cctx.strokeRect((hx - 0.5) * l.w - 5 * px, (hy - 0.5) * l.h - 5 * px, 10 * px, 10 * px);
    }
    cctx.beginPath();
    cctx.moveTo(0, -l.h / 2);
    cctx.lineTo(0, -l.h / 2 - 24 * px);
    cctx.stroke();
    cctx.beginPath();
    cctx.arc(0, -l.h / 2 - 24 * px, 6 * px, 0, Math.PI * 2);
    cctx.fill();
    cctx.restore();
  }
  if (cropRect) {
    cctx.strokeStyle = '#66b0ff';
    cctx.lineWidth = 2 * px;
    cctx.fillStyle = '#5285ff33';
    cctx.fillRect(cropRect.x, cropRect.y, cropRect.w, cropRect.h);
    cctx.strokeRect(cropRect.x, cropRect.y, cropRect.w, cropRect.h);
  }
}
function setMode(m) {
  mode = m;
  brush = m === 'brush';
  for (const id of ['move', 'crop', 'brush', 'eraser']) $(id).classList.toggle('active', id === m);
  canvas.style.cursor = m === 'move' ? 'move' : 'crosshair';
  document.querySelector('.toolbar').classList.toggle('paintmode', m === 'brush' || m === 'eraser');
  document.querySelector('.toolbar').classList.toggle('erasemode', m === 'eraser');
  $('toolHint').textContent =
    m === 'crop'
      ? 'Tarik area crop, lalu pilih Terapkan crop.'
      : m === 'eraser'
        ? 'Hapus bagian layer terpilih.'
        : m === 'brush'
          ? 'Lukis di kanvas dengan warna dan ukuran kuas.'
          : 'Resize dari 8 titik · klik kanan untuk aksi layer.';
  drawSelection();
}
function point(e) {
  const r = canvas.getBoundingClientRect();
  return {
    x: ((e.clientX - r.left) * current.w) / r.width,
    y: ((e.clientY - r.top) * current.h) / r.height,
  };
}
function brushAt(p) {
  const l = selectedLayer(),
    c = l.source.getContext('2d');
  c.fillStyle = $('color').value;
  c.beginPath();
  c.arc(p.x, p.y, Number($('size').value) / 2, 0, Math.PI * 2);
  c.fill();
  renderComposite();
}
canvas.onpointerdown = (e) => {
  if (!current || e.button !== 0) return;
  hideContext();
  const p = point(e),
    l = selectedLayer();
  if (l?.locked && mode !== 'brush') {
    toast('Layer terkunci. Buka kunci lewat klik kanan.');
    return;
  }
  if (mode === 'eraser') {
    if (!l) {
      toast('Pilih layer yang ingin dihapus bagiannya.');
      return;
    }
    remember();
    l.source = copyCanvas(l.source);
    gesture = { type: 'eraser' };
    eraseAt(l, p, Number($('size').value) / 2);
    renderComposite();
  } else if (mode === 'brush') {
    remember();
    let last = current.layers.at(-1);
    if (
      last?.locked ||
      last?.name !== 'Kuas' ||
      last.source.width !== current.w ||
      last.source.height !== current.h ||
      last.x !== 0 ||
      last.y !== 0 ||
      last.w !== current.w ||
      last.h !== current.h ||
      last.sx !== 0 ||
      last.sy !== 0 ||
      last.angle ||
      last.flipX ||
      last.flipY ||
      last.opacity !== 1
    ) {
      const c = document.createElement('canvas');
      c.width = current.w;
      c.height = current.h;
      last = makeLayer(c, 'Kuas');
      current.layers.push(last);
    }
    current.selected = current.layers.length - 1;
    last.source = copyCanvas(last.source);
    gesture = { type: 'brush' };
    brushAt(p);
    renderLayers();
  } else if (mode === 'crop') {
    if (!l) {
      toast('Tambahkan atau pilih gambar terlebih dahulu.');
      return;
    }
    cropRect = { x: p.x, y: p.y, w: 0, h: 0 };
    gesture = { type: 'crop', start: p };
  } else {
    if (!l?.visible) {
      toast('Tambahkan atau pilih layer gambar.');
      return;
    }
    const px = current.w / canvas.getBoundingClientRect().width,
      tolerance = 14 * px,
      local = localPoint(l, p),
      knob = layerPoint(l, l.w / 2, -24 * px),
      rotate = Math.hypot(p.x - knob.x, p.y - knob.y) < 12 * px,
      handle = resizeHandles.findIndex(
        ([hx, hy]) => Math.hypot(local.x - hx * l.w, local.y - hy * l.h) < tolerance,
      ),
      resize = handle >= 0;
    if (!rotate && !resize && (local.x < 0 || local.x > l.w || local.y < 0 || local.y > l.h))
      return;
    remember();
    gesture = {
      type: rotate ? 'rotate' : resize ? 'resize' : 'move',
      start: p,
      handle,
      layer: { ...l },
      startAngle: Math.atan2(p.y - l.y - l.h / 2, p.x - l.x - l.w / 2),
    };
  }
  canvas.setPointerCapture(e.pointerId);
  e.preventDefault();
};
canvas.onpointermove = (e) => {
  if (!gesture || !current) return;
  const p = point(e);
  if (gesture.type === 'eraser') {
    eraseAt(selectedLayer(), p, Number($('size').value) / 2);
    renderComposite();
    return;
  }
  if (gesture.type === 'brush') {
    brushAt(p);
    return;
  }
  if (gesture.type === 'crop') {
    cropRect = normalizeRect(gesture.start, p);
    drawSelection();
    syncTransform();
    return;
  }
  const l = selectedLayer(),
    origin = gesture.layer,
    dx = p.x - gesture.start.x,
    dy = p.y - gesture.start.y;
  if (gesture.type === 'move') {
    l.x = Math.round(origin.x + dx);
    l.y = Math.round(origin.y + dy);
  } else if (gesture.type === 'rotate') {
    let angle = normalizedAngle(
      (origin.angle || 0) +
        ((Math.atan2(p.y - origin.y - origin.h / 2, p.x - origin.x - origin.w / 2) -
          gesture.startAngle) *
          180) /
          Math.PI,
    );
    l.angle = e.shiftKey ? Math.round(angle / 15) * 15 : angle;
  } else Object.assign(l, resizeFromHandle(origin, dx, dy, gesture.handle, $('lockRatio').checked));
  renderComposite();
};
function finishGesture() {
  if (!gesture) return;
  if (gesture.type !== 'crop') {
    commit();
    renderTextures();
    renderLayers();
    drawGuide();
    applyTexture();
  }
  gesture = null;
  syncTransform();
}
canvas.onpointerup = finishGesture;
canvas.onpointercancel = finishGesture;
$('move').onclick = () => setMode('move');
$('crop').onclick = () => setMode('crop');
$('brush').onclick = () => setMode('brush');
function restoreState(state) {
  current.w = state.w;
  current.h = state.h;
  current.layers = state.layers;
  current.selected = state.selected;
  cropRect = null;
  refreshEdit();
  fitCanvas();
  $('dimensions').textContent = `${current.w} × ${current.h}`;
}
$('undo').onclick = () => {
  if (!current) return;
  const state = current.history.pop();
  if (!state) {
    toast('Tidak ada perubahan untuk diurungkan.');
    return;
  }
  current.future.push(snapshotState());
  restoreState(state);
};
$('redo').onclick = () => {
  if (!current) return;
  const state = current.future.pop();
  if (!state) return;
  current.history.push(snapshotState());
  restoreState(state);
};
for (const [id, key] of [
  ['layerX', 'x'],
  ['layerY', 'y'],
  ['layerW', 'w'],
  ['layerH', 'h'],
]) {
  $(id).onchange = () => {
    const l = selectedLayer(),
      n = Number($(id).value);
    if (!l || !Number.isFinite(n) || Math.abs(n) > 32768 || (['w', 'h'].includes(key) && n < 1)) {
      syncTransform();
      toast('Masukkan ukuran atau posisi yang valid.');
      return;
    }
    remember();
    if ($('lockRatio').checked && key === 'w') l.h = (n * l.h) / l.w;
    if ($('lockRatio').checked && key === 'h') l.w = (n * l.w) / l.h;
    l[key] = n;
    renderComposite(true);
    renderTextures();
  };
}
$('fitImage').onclick = () => {
  const l = selectedLayer();
  if (!l) return;
  remember();
  const a = ((l.angle || 0) * Math.PI) / 180,
    c = Math.abs(Math.cos(a)),
    s = Math.abs(Math.sin(a)),
    ratio = Math.min(current.w / (l.sw * c + l.sh * s), current.h / (l.sw * s + l.sh * c));
  l.w = l.sw * ratio;
  l.h = l.sh * ratio;
  l.x = (current.w - l.w) / 2;
  l.y = (current.h - l.h) / 2;
  renderComposite(true);
  renderTextures();
};
$('applyCrop').onclick = () => {
  const l = selectedLayer();
  if (!l || !cropRect) return;
  try {
    const cropped = cropLayer(bakeRotation(l), cropRect);
    remember();
    current.layers[current.selected] = cropped;
    cropRect = null;
    setMode('move');
    renderComposite(true);
    renderTextures();
    renderLayers();
    toast('Gambar dipotong. Ukuran kanvas tetap.');
  } catch (e) {
    toast(e.message);
  }
};
$('cancelCrop').onclick = () => {
  cropRect = null;
  syncTransform();
  setMode('move');
};
$('deleteLayer').onclick = () => current && deleteLayerAt(current.selected);
function addTextureLayer(t) {
  if (!current) return;
  initLayers(current);
  remember();
  const l = makeLayer(copyCanvas(t.canvas), t.name),
    ratio = Math.min(current.w / t.w, current.h / t.h, 1);
  l.kind = t.kind || 'Gambar';
  l.w = t.w * ratio;
  l.h = t.h * ratio;
  l.x = (current.w - l.w) / 2;
  l.y = (current.h - l.h) / 2;
  current.layers.push(l);
  current.selected = current.layers.length - 1;
  setMode('move');
  renderComposite(true);
  renderLayers();
  renderTextures();
  drawGuide();
  applyTexture();
}
$('addImage').onclick = $('addImageSidebar').onclick = () => $('addInput').click();
$('addInput').onchange = async (e) => {
  for (const f of e.target.files) {
    try {
      if (f.size > 64 * 1024 * 1024) throw Error('File terlalu besar.');
      if (f.name.toLowerCase().endsWith('.ytd')) {
        if (pendingYtd) throw Error('Pilih tekstur dari satu YTD terlebih dahulu.');
        const resource = readYtd(await f.arrayBuffer());
        resource.textures.forEach(makeCanvas);
        openYtdLayers({ name: f.name, ext: 'ytd', size: f.size, resource });
        continue;
      }
      const t = await imageTexture(f);
      if (current) addTextureLayer(t);
      else {
        const item = {
          name: f.name,
          ext: f.name.split('.').pop().toLowerCase(),
          size: f.size,
          textures: [t],
        };
        files.push(item);
        selectFile(item);
      }
    } catch (err) {
      toast(err.message);
    }
  }
  e.target.value = '';
};
$('replaceInput').onchange = async (e) => {
  try {
    const f = e.target.files[0];
    if (!f || !current) return;
    const t = await imageTexture(f);
    if (!selectedLayer()) {
      addTextureLayer(t);
      return;
    }
    if (selectedLayer().locked) {
      toast('Buka kunci layer sebelum menggantinya.');
      return;
    }
    remember();
    const l = selectedLayer();
    current.layers[current.selected] = {
      ...l,
      name: t.name,
      source: copyCanvas(t.canvas),
      sx: 0,
      sy: 0,
      sw: t.w,
      sh: t.h,
    };
    renderComposite(true);
    renderLayers();
    renderTextures();
    drawGuide();
    applyTexture();
    toast('Gambar diganti pada posisi dan ukuran yang sama.');
  } catch (err) {
    toast(err.message);
  } finally {
    e.target.value = '';
  }
};
$('uvToggle').onchange = () => drawGuide();
$('canvasSize').onclick = () => {
  if (!current) {
    toast('Buka model atau tekstur terlebih dahulu.');
    return;
  }
  $('canvasW').value = current.w;
  $('canvasH').value = current.h;
  $('sizeError').textContent = '';
  $('sizeDialog').showModal();
};
$('cancelSize').onclick = () => $('sizeDialog').close();
$('confirmSize').onclick = () => {
  const w = Number($('canvasW').value),
    h = Number($('canvasH').value);
  if (!validSize(w, h)) {
    $('sizeError').textContent = 'Gunakan 1–8192 px, maksimum 16 megapixel.';
    return;
  }
  remember();
  const sx = w / current.w,
    sy = h / current.h;
  for (const l of current.layers) {
    l.x *= sx;
    l.y *= sy;
    l.w *= sx;
    l.h *= sy;
  }
  current.w = w;
  current.h = h;
  cropRect = null;
  renderComposite(true);
  drawGuide();
  fitCanvas();
  renderTextures();
  renderLayers();
  $('dimensions').textContent = `${w} × ${h}`;
  applyTexture();
  $('sizeDialog').close();
};
setMode('move');
$('uvToggle').disabled = true;
syncTransform();

function bakeRotation(l) {
  if (!normalizedAngle(l.angle || 0) && !l.flipX && !l.flipY) return l;
  const bounds = layerBounds(l);
  if (!validSize(bounds.w, bounds.h)) throw Error('Perkecil gambar sebelum melakukan crop.');
  const c = document.createElement('canvas');
  c.width = bounds.w;
  c.height = bounds.h;
  drawLayers(
    c.getContext('2d'),
    [{ ...l, x: l.x - bounds.x, y: l.y - bounds.y, visible: true, opacity: 1 }],
    bounds.w,
    bounds.h,
  );
  return {
    ...makeLayer(c, l.name),
    x: bounds.x,
    y: bounds.y,
    visible: l.visible,
    opacity: l.opacity,
    kind: l.kind,
  };
}
function rotateBy(degrees) {
  const l = selectedLayer();
  if (!l) return;
  remember();
  l.angle = normalizedAngle((l.angle || 0) + degrees);
  renderComposite(true);
  renderTextures();
}
$('layerAngle').onchange = () => {
  const l = selectedLayer(),
    a = Number($('layerAngle').value);
  if (!l || !Number.isFinite(a)) {
    syncTransform();
    return;
  }
  remember();
  l.angle = normalizedAngle(a);
  renderComposite(true);
  renderTextures();
};
$('rotateLeft').onclick = () => rotateBy(-90);
$('rotateRight').onclick = () => rotateBy(90);

function refreshEdit() {
  renderComposite(true);
  renderLayers();
  renderTextures();
  drawGuide();
  applyTexture();
}
function deleteLayerAt(i) {
  if (!current || i < 0 || i >= current.layers.length || current.layers[i].locked) return;
  remember();
  current.layers.splice(i, 1);
  current.selected = Math.min(current.selected, current.layers.length - 1);
  cropRect = null;
  refreshEdit();
}
$('eraser').onclick = () => setMode('eraser');
for (const [id, key] of [
  ['mirrorX', 'flipX'],
  ['mirrorY', 'flipY'],
])
  $(id).onclick = () => {
    const l = selectedLayer();
    if (!l) return;
    remember();
    l[key] = !l[key];
    refreshEdit();
  };
$('opacity').onchange = () => {
  const l = selectedLayer();
  if (!l) return;
  remember();
  l.opacity = Number($('opacity').value) / 100;
  refreshEdit();
};
$('opacity').oninput = () => {
  $('opacityValue').textContent = $('opacity').value + '%';
};
$('layerName').onchange = () => {
  const l = selectedLayer(),
    name = $('layerName').value.trim();
  if (!l || !name) {
    syncTransform();
    return;
  }
  remember();
  l.name = name;
  refreshEdit();
};
$('duplicateLayer').onclick = () => {
  const l = selectedLayer();
  if (!l) return;
  remember();
  current.layers.splice(current.selected + 1, 0, {
    ...l,
    name: l.name + ' copy',
    source: copyCanvas(l.source),
  });
  current.selected++;
  refreshEdit();
};
for (const [id, delta] of [
  ['layerUp', 1],
  ['layerDown', -1],
])
  $(id).onclick = () => {
    if (!current) return;
    const i = current.selected,
      j = i + delta;
    if (i < 0 || j < 0 || j >= current.layers.length) return;
    remember();
    [current.layers[i], current.layers[j]] = [current.layers[j], current.layers[i]];
    current.selected = j;
    refreshEdit();
  };
function openYtdLayers(f) {
  if (!current) {
    files.push(f);
    selectFile(f);
    toast('YTD dibuka. Tambahkan ke desain lewat Tambah gambar / YTD.');
    return;
  }
  pendingYtd = { file: f, target: current };
  $('ytdChoices').replaceChildren();
  $('ytdChoiceError').textContent = '';
  f.resource.textures.forEach((t, i) => {
    const row = document.createElement('label');
    row.className = 'ytdchoice';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.value = i;
    input.checked = i === 0;
    const image = document.createElement('img');
    image.src = t.canvas.toDataURL();
    const text = document.createElement('span'),
      name = document.createElement('strong'),
      info = document.createElement('small');
    name.textContent = t.name;
    info.textContent = `${t.w} × ${t.h} · ${t.format}`;
    text.append(name, info);
    row.append(input, image, text);
    $('ytdChoices').append(row);
  });
  $('ytdLayerDialog').showModal();
}
$('confirmYtdLayers').onclick = () => {
  if (!pendingYtd) return;
  const indices = [...$('ytdChoices').querySelectorAll('input:checked')].map((e) =>
    Number(e.value),
  );
  if (!indices.length) {
    $('ytdChoiceError').textContent = 'Pilih sedikitnya satu tekstur.';
    return;
  }
  const { file, target } = pendingYtd;
  if (current !== target) {
    toast('Desain aktif berubah. Impor ulang YTD.');
    return;
  }
  files.push(file);
  for (const i of indices) addTextureLayer({ ...file.resource.textures[i], kind: 'YTD' });
  refreshFiles();
  pendingYtd = null;
  $('ytdLayerDialog').close();
};
$('cancelYtdLayers').onclick = () => {
  pendingYtd = null;
  $('ytdLayerDialog').close();
};
$('ytdLayerDialog').addEventListener('cancel', () => (pendingYtd = null));
async function removeFile(f) {
  if (
    (f.resource?.textures || f.textures || f.uvTextures || []).some(textureUnsaved) &&
    (await confirmDiscard('file', [{ name: f.name }])) !== 'discard'
  )
    return;
  const ownsCurrent = (f.resource?.textures || f.textures || f.uvTextures || []).includes(current);
  files.splice(files.indexOf(f), 1);
  if (displayedModel === f) {
    pedAttachments.clear();
    clearModel();
    displayedModel = null;
    modelFile = null;
    drawGuide();
    $('emptyModel').hidden = false;
    $('snapshot').disabled = true;
    $('modelTitle').textContent = 'Preview 3D';
    options($('drawable'), ['Belum ada model']);
    $('modelStats').textContent = 'Buka model untuk melihat preview 3D.';
  }
  if (ownsCurrent) {
    current = null;
    textures.splice(0);
    $('canvasStack').hidden = true;
    $('emptyTexture').hidden = false;
    $('textureTitle').textContent = 'Belum ada tekstur';
    $('dimensions').textContent = '2D';
    $('pngExport').disabled = $('ytdExport').disabled = true;
    renderTextures();
    renderLayers();
    applyTexture();
  }
  if (activeFile === f) activeFile = null;
  refreshFiles();
  toast('File dihapus dari workspace. File asli tetap ada di perangkatmu.');
}

function hideContext() {
  $('layerContext').hidden = true;
}
function showContext(e) {
  const l = selectedLayer();
  if (!l) return;
  finishGesture();
  const menu = $('layerContext');
  menu.replaceChildren();
  const heading = document.createElement('div');
  heading.className = 'contexttitle';
  heading.textContent = l.name;
  menu.append(heading);
  const actions = [
    ['Crop', () => setMode('crop'), l.locked],
    ['Pas kanvas', () => $('fitImage').click(), l.locked],
    ['Duplikat', () => $('duplicateLayer').click(), false, 'Ctrl D'],
    ['Bawa ke depan', () => $('layerUp').click(), current.selected === current.layers.length - 1],
    ['Kirim ke belakang', () => $('layerDown').click(), current.selected === 0],
    [
      l.visible ? 'Sembunyikan' : 'Tampilkan',
      () => {
        remember();
        l.visible = !l.visible;
        refreshEdit();
      },
      false,
    ],
    [
      l.locked ? 'Buka kunci' : 'Kunci',
      () => {
        remember();
        l.locked = !l.locked;
        cropRect = null;
        refreshEdit();
      },
      false,
    ],
    ['Hapus', () => deleteLayerAt(current.selected), l.locked, 'Del'],
  ];
  for (const [label, action, disabled, shortcut] of actions) {
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('role', 'menuitem');
    b.disabled = !!disabled;
    b.className = label === 'Hapus' ? 'danger' : '';
    const text = document.createElement('span');
    text.textContent = label;
    b.append(text);
    if (shortcut) {
      const hint = document.createElement('small');
      hint.textContent = shortcut;
      b.append(hint);
    }
    b.onclick = () => {
      hideContext();
      action();
    };
    menu.append(b);
  }
  menu.hidden = false;
  menu.style.left =
    Math.max(8, Math.min(e.clientX, window.innerWidth - menu.offsetWidth - 8)) + 'px';
  menu.style.top =
    Math.max(8, Math.min(e.clientY, window.innerHeight - menu.offsetHeight - 8)) + 'px';
  menu.querySelector('button:not(:disabled)')?.focus();
}
canvas.oncontextmenu = (e) => {
  e.preventDefault();
  if (!current) return;
  const p = point(e);
  for (let i = current.layers.length - 1; i >= 0; i--) {
    const l = current.layers[i],
      q = localPoint(l, p);
    if (l.visible && q.x >= 0 && q.x <= l.w && q.y >= 0 && q.y <= l.h) {
      current.selected = i;
      renderLayers();
      drawSelection();
      break;
    }
  }
  showContext(e);
};
document.addEventListener('pointerdown', (e) => {
  if (!$('layerContext').contains(e.target)) hideContext();
});
window.addEventListener('resize', hideContext);
window.addEventListener('scroll', hideContext, true);
$('layerContext').addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    hideContext();
    canvas.focus();
    return;
  }
  if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return;
  e.preventDefault();
  const buttons = [...$('layerContext').querySelectorAll('button:not(:disabled)')],
    i = buttons.indexOf(document.activeElement),
    n =
      e.key === 'Home'
        ? 0
        : e.key === 'End'
          ? buttons.length - 1
          : (i + (e.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
  buttons[n]?.focus();
});
document.addEventListener('keydown', (e) => {
  if (
    tools?.isActive() ||
    ['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName) ||
    e.target.isContentEditable ||
    document.querySelector('dialog[open]')
  )
    return;
  if (e.key === 'Escape') {
    hideContext();
    cropRect = null;
    setMode('move');
    syncTransform();
  }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd' && selectedLayer()) {
    e.preventDefault();
    $('duplicateLayer').click();
  }
  if ((e.key === 'Delete' || e.key === 'Backspace') && selectedLayer()) {
    e.preventDefault();
    deleteLayerAt(current.selected);
  }
});

let tabSerial = 1;
const tabs = [{ id: 1, name: 'Workspace 1', state: null }];
let activeTab = tabs[0];
function renderTabs() {
  if (activeFile) activeTab.name = activeFile.name;
  const el = $('documentTabs');
  if (!el) return;
  el.replaceChildren();
  for (const tab of tabs) {
    const wrapper = document.createElement('div');
    wrapper.className = 'documenttab' + (tab === activeTab ? ' selected' : '');
    const b = document.createElement('button');
    b.setAttribute('role', 'tab');
    b.setAttribute('aria-selected', String(tab === activeTab));
    b.tabIndex = tab === activeTab ? 0 : -1;
    b.textContent = tab.name;
    b.title = tab.name;
    b.onclick = () => switchTab(tab);
    b.onkeydown = (e) => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
      e.preventDefault();
      const i = tabs.indexOf(tab),
        next =
          e.key === 'Home'
            ? tabs[0]
            : e.key === 'End'
              ? tabs.at(-1)
              : tabs[(i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length];
      switchTab(next);
      $('documentTabs').querySelector('[aria-selected="true"]')?.focus();
    };
    const close = document.createElement('button');
    close.className = 'tabclose';
    close.textContent = '×';
    close.setAttribute('aria-label', 'Tutup ' + tab.name);
    close.onclick = async () => {
      const state = tab === activeTab ? null : tab.state || { files: [] };
      const edits = workspaceTextures(state).filter(textureUnsaved);
      if (
        edits.length &&
        (await confirmDiscard(
          'tab',
          edits.map((t) => ({ name: t.name })),
        )) !== 'discard'
      )
        return;
      if (tab === activeTab) {
        if (tabs.length === 1) {
          createTab();
        } else switchTab(tabs[tabs.indexOf(tab) === 0 ? 1 : tabs.indexOf(tab) - 1]);
      }
      tabs.splice(tabs.indexOf(tab), 1);
      renderTabs();
    };
    wrapper.append(b, close);
    el.append(wrapper);
  }
}
function saveTab() {
  finishGesture();
  activeTab.name = activeFile?.name || activeTab.name;
  activeTab.state = {
    files: [...files],
    textures: [...textures],
    current,
    activeFile,
    modelFile,
    displayedModel,
    drawableIndex,
    zoom,
    dirty,
    wire,
    uv: $('uvToggle').checked,
    apply: $('apply').checked,
  };
}
function resetWorkspace() {
  hideContext();
  gesture = null;
  cropRect = null;
  current = null;
  activeFile = null;
  modelFile = null;
  displayedModel = null;
  drawableIndex = 0;
  zoom = 1;
  dirty = false;
  files.splice(0);
  textures.splice(0);
  pedAttachments.clear();
  clearModel();
  $('canvasStack').hidden = true;
  $('emptyTexture').hidden = false;
  $('emptyModel').hidden = false;
  $('textureTitle').textContent = 'Belum ada tekstur';
  $('modelTitle').textContent = 'Preview 3D';
  $('dimensions').textContent = '2D';
  $('pngExport').disabled = $('ytdExport').disabled = $('snapshot').disabled = true;
  $('editState').textContent = 'Tidak ada perubahan';
  $('modelStats').textContent = 'Putar: tarik mouse · Zoom: scroll';
  options($('drawable'), ['Belum ada model']);
  renderTextures();
  renderLayers();
  $('uvToggle').disabled = true;
  applyTexture();
  setMode('move');
}
function switchTab(tab) {
  if (tab === activeTab) return;
  saveTab();
  hideContext();
  pendingYtd = null;
  $('ytdLayerDialog').close();
  resetWorkspace();
  activeTab = tab;
  const state = tab.state;
  if (state) {
    files.push(...state.files);
    wire = state.wire;
    $('wire').classList.toggle('active', wire);
    pedAttachments.setWireframe(wire);
    $('uvToggle').checked = state.uv;
    $('apply').checked = state.apply;
    if (state.displayedModel) {
      selectFile(state.displayedModel);
      if (state.modelFile) {
        options(
          $('drawable'),
          state.modelFile.drawables.map((d) => d.name),
        );
        $('drawable').value = state.drawableIndex;
        showDrawable(state.drawableIndex);
      }
    }
    textures.splice(0, textures.length, ...state.textures);
    activeFile = state.activeFile;
    current = state.current;
    if (current) {
      const i = textures.indexOf(current);
      if (i >= 0) selectTexture(i);
      zoom = state.zoom;
      fitCanvas();
    }
    renderTextures();
    dirty = state.dirty;
    applyTexture();
  }
  refreshFiles();
  renderTabs();
}
function createTab() {
  const tab = { id: ++tabSerial, name: 'Workspace ' + tabSerial, state: null };
  tabs.push(tab);
  switchTab(tab);
  toast('Tab baru siap. Buka file untuk mulai.');
}
$('newTab').onclick = createTab;
renderTabs();

let discardPending = null;
function unsavedItems() {
  finishGesture();
  return tabs.flatMap((tab) =>
    workspaceTextures(tab === activeTab ? null : tab.state || { files: [] })
      .filter(textureUnsaved)
      .map((t) => ({ name: t.name, tab: tab.name })),
  );
}
function confirmDiscard(reason = 'close', items = unsavedItems()) {
  if (discardPending) return Promise.resolve('cancel');
  const dialog = $('unsavedDialog');
  dialog.dataset.mode = reason === 'update' && !items.length ? 'install' : 'unsaved';
  dialog.querySelector('.unsavedTip').hidden = !items.length;
  $('unsavedBack').textContent =
    reason === 'update' && !items.length ? 'Nanti saja' : 'Kembali ke editor';
  $('unsavedHeading').textContent =
    reason === 'update'
      ? 'Pasang update aplikasi?'
      : reason === 'tab'
        ? 'Tutup tab ini?'
        : reason === 'file'
          ? 'Hapus file dari workspace?'
          : reason === 'pack'
            ? 'Kosongkan clothing pack?'
            : reason === 'archive'
              ? 'Ganti arsip tanpa mengekspor?'
              : 'Tutup DITASHA Editor?';
  $('unsavedDescription').textContent = items.length
    ? 'Ada perubahan yang belum disimpan. Ekspor desain, clothing pack atau salinan arsip sebelum melanjutkan agar hasil editmu tetap tersimpan.'
    : 'Update akan diunduh dan diverifikasi. Setelah siap, aplikasi ditutup dan versi terbaru dibuka kembali.';
  $('unsavedList').replaceChildren();
  for (const item of items) {
    const row = document.createElement('li');
    row.textContent = item.name + (item.tab ? ' · ' + item.tab : '');
    $('unsavedList').append(row);
  }
  $('unsavedDiscard').textContent =
    reason === 'update'
      ? 'Pasang & mulai ulang'
      : reason === 'tab'
        ? 'Tutup tanpa menyimpan'
        : reason === 'archive'
          ? 'Lanjut tanpa mengekspor'
          : reason === 'file' || reason === 'pack'
            ? 'Hapus tanpa menyimpan'
            : 'Tutup tanpa menyimpan';
  let resolve;
  discardPending = new Promise((r) => (resolve = r));
  const finish = (value) => {
    dialog.close();
    discardPending = null;
    resolve(value);
  };
  $('unsavedBack').onclick = () => finish('cancel');
  $('unsavedDiscard').onclick = () => finish('discard');
  dialog.oncancel = (e) => {
    e.preventDefault();
    finish('cancel');
  };
  dialog.showModal();
  return discardPending;
}
const tools = mountTools({ download, toast, preview: loadFiles, confirmDiscard });
mountPhotoshoot({
  container: document.querySelector('.modeltools'),
  id: 'photoshoot',
  download,
  toast,
  getSource: () =>
    displayedModel && renderer
      ? {
          objects: [model, pedAttachments.group],
          camera,
          target: controls.target,
          name: displayedModel.name || 'Model & texture',
        }
      : null,
});
const expandButton = document.createElement('button');
expandButton.id = 'expand3d';
expandButton.textContent = 'Perbesar 3D';
expandButton.setAttribute('aria-expanded', 'false');
document.querySelector('.modeltools').append(expandButton);
const viewer = document.querySelector('.right');
function expand3d(expanded) {
  viewer.classList.toggle('expanded-3d', expanded);
  expandButton.textContent = expanded ? 'Kembali · Esc' : 'Perbesar 3D';
  expandButton.setAttribute('aria-expanded', String(expanded));
  if (expanded) expandButton.focus();
}
expandButton.onclick = () => expand3d(!viewer.classList.contains('expanded-3d'));
document.addEventListener(
  'keydown',
  (e) => {
    if (
      e.key === 'Escape' &&
      viewer.classList.contains('expanded-3d') &&
      !document.querySelector('dialog[open]')
    ) {
      e.preventDefault();
      e.stopImmediatePropagation();
      expand3d(false);
    }
  },
  true,
);
window.ditashaWorkspace = {
  unsavedItems: () => [...unsavedItems(), ...tools.unsavedItems()],
  confirmDiscard: (reason) => confirmDiscard(reason, [...unsavedItems(), ...tools.unsavedItems()]),
};
$('donate').addEventListener('click', async (e) => {
  if (!window.ditashaDesktop?.openDonation) return;
  e.preventDefault();
  try {
    await window.ditashaDesktop.openDonation();
  } catch {
    toast('Saweria tidak dapat dibuka. Coba kembali atau buka saweria.co/itsaminarii di browser.');
  }
});
mountMinimalUi();
window.ditashaDesktop?.ready?.();
