import * as THREE from 'three';
import { MAX_DECODED_TEXTURE_BYTES } from './texture-memory.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { decodeResource } from './resource-client.js';
import { resolveModelTexture, modelAlphaMode, modelPreviewAlpha } from './model-material.js';
import {
  liveryReference,
  resolveVehicleLivery,
  setVehicleLivery,
  copyVehicleLivery,
} from './vehicle-livery.js';
import { managePreview } from './performance.js';
import { zipFiles } from './asset-tools.js';
import { setProject } from './project-context.js';
import {
  createModelMaterial,
  resolveSurfaceMaps,
  setSurfaceMaps,
  copyVehicleSurface,
  surfaceReferences,
} from './vehicle-surface.js';
export function mountDebadge({ download, toast, confirmDiscard, back }) {
  const root = document.createElement('section');
  root.className = 'debadge-workspace';
  root.id = 'debadgeWorkspace';
  root.hidden = true;
  root.innerHTML = `<div class="debadge-head"><div><span class="eyebrow">VEHICLE WORKSHOP / DIRECT YFT</span><h2>Visual debadge</h2></div><button id="dbBack">Back to vehicle</button><button id="dbOpen" class="primary">Open YFT + YTD</button><input id="dbInput" type="file" multiple accept=".yft,.ytd" hidden><input id="dbTextureInput" type="file" multiple accept=".ytd" hidden></div><div class="debadge-layout"><aside class="debadge-sidebar"><span class="eyebrow">YOUR VEHICLE</span><div id="dbFiles"></div><button id="dbTextures">Add YTD textures</button><label>File<select id="dbFile"></select></label><label>Drawable<select id="dbDrawable"></select></label><label>Detail level<select id="dbLod"></select></label><p class="muted">Review each LOD and the matching _hi.yft separately. Only selected triangles in the selected native buffers are changed.</p><div class="debadge-picked"><div class="sectiontitle">SELECTED PARTS <span id="dbCount">0</span></div><input id="dbSearch" type="search" placeholder="Search material / part" aria-label="Search debadge parts"><div id="dbParts"></div><button id="dbMore" hidden>Show more parts</button></div></aside><section class="debadge-stage"><div class="debadge-toolbar"><button id="dbFit">Fit vehicle</button><button id="dbUndo">Undo selection</button><button id="dbRedo">Redo selection</button><button id="dbClear">Clear selection</button><label class="check"><input id="dbHide" type="checkbox">Preview removed</label><label class="check"><input id="dbWire" type="checkbox">Wireframe</label></div><div id="dbViewport"><div class="empty"><h3>Choose the parts on your vehicle</h3><p>Open a Legacy YFT, add its YTD textures, then click a badge.<br>Drag to orbit · scroll to zoom · right-drag to pan.</p><button id="dbChoose" class="primary">Open vehicle</button></div></div><div id="dbStatus" role="status">Direct preview and export. Blender is not required for debadge.</div></section><aside class="debadge-inspector"><span class="eyebrow">REVIEW BEFORE EXPORT</span><h3 id="dbSelection">Nothing selected</h3><p id="dbPartDetails" class="muted">Click a separate connected part, or choose one from the list. Badges do not need special material names.</p><div id="dbWarnings" class="debadge-warnings"></div><p class="muted">Red shows the complete selected component. If a badge is joined to the body, selecting it also selects that connected body mesh. Check the highlight and undo if needed.</p><button id="dbExport" class="primary" disabled>Save debadged YFT</button><p class="muted">Exports a copy using the original filename. Multiple YFTs are saved as a ZIP with their original stream names. Rig, materials, textures and collision stay intact.</p><p id="dbSaved" role="status"></p></aside></div>`;
  const $ = (id) => root.querySelector('#' + id),
    viewport = $('dbViewport');
  let models = [],
    external = [],
    active = 0,
    drawable = 0,
    lod = 0,
    selection = new Set(),
    saved = '',
    busy = false,
    history = [],
    future = [],
    shown = 100,
    renderer,
    controls,
    budget,
    maps = [],
    mapCache = new Map(),
    meshes = [],
    down,
    lastWorkshopFile;
  const scene = new THREE.Scene(),
    group = new THREE.Group(),
    camera = new THREE.PerspectiveCamera(40, 1, 0.001, 1000);
  scene.background = new THREE.Color(0x171a20);
  scene.add(group, new THREE.HemisphereLight(0xffffff, 0x69798c, 2.8));
  const light = new THREE.DirectionalLight(0xffffff, 3);
  light.position.set(4, 6, 3);
  scene.add(light);
  const selectedKey = () => [...selection].sort().join('|');
  const key = (file, part) => file + ':' + part.id;
  const current = () => models[active];
  const level = () => current()?.data[drawable]?.lods[lod];
  const invalidate = () => budget?.invalidate();
  const dirty = () => selection.size && selectedKey() !== saved;
  function updateControls() {
    for (const id of [
      'dbOpen',
      'dbTextures',
      'dbFile',
      'dbDrawable',
      'dbLod',
      'dbClear',
      'dbUndo',
      'dbRedo',
      'dbExport',
    ])
      $(id).disabled = busy;
    $('dbExport').disabled = busy || !selection.size;
    $('dbUndo').disabled = busy || !history.length;
    $('dbRedo').disabled = busy || !future.length;
  }
  function init() {
    if (renderer) return;
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    viewport.replaceChildren(renderer.domElement);
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    budget = managePreview({ renderer, camera, scene, controls, container: viewport, toast });
    renderer.domElement.addEventListener('pointerdown', (e) => {
      down = { x: e.clientX, y: e.clientY, button: e.button };
    });
    renderer.domElement.addEventListener('pointerup', (e) => {
      if (
        busy ||
        !down ||
        down.button !== 0 ||
        Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5
      )
        return;
      const r = renderer.domElement.getBoundingClientRect(),
        ray = new THREE.Raycaster();
      ray.setFromCamera(
        new THREE.Vector2(
          ((e.clientX - r.x) / r.width) * 2 - 1,
          (-(e.clientY - r.y) / r.height) * 2 + 1,
        ),
        camera,
      );
      const hit = ray
        .intersectObjects(group.children)
        .find((h) => h.object.visible && h.object.material[h.face.materialIndex].visible);
      if (!hit) return;
      const part = hit.object.userData.partsByTriangle.get(hit.faceIndex);
      if (part) toggle(key(active, part));
    });
  }
  function clearScene() {
    for (const m of meshes) {
      group.remove(m);
      m.geometry.dispose();
      for (const mat of m.material) mat.dispose();
    }
    meshes = [];
    maps.forEach((m) => m.dispose());
    maps = [];
    mapCache.clear();
  }
  function materialMap(t, role = 'color') {
    if (!t) return null;
    if (mapCache.get(t)?.has(role)) return mapCache.get(t).get(role);
    const m = new THREE.DataTexture(t.out, t.w, t.h, THREE.RGBAFormat);
    m.colorSpace = role === 'data' ? THREE.NoColorSpace : THREE.SRGBColorSpace;
    m.wrapS = m.wrapT = THREE.RepeatWrapping;
    m.flipY = false;
    m.needsUpdate = true;
    maps.push(m);
    if (!mapCache.has(t)) mapCache.set(t, new Map());
    mapCache.get(t).set(role, m);
    return m;
  }
  function renderModel(fitCamera = false) {
    clearScene();
    if (!level()) return;
    init();
    const d = current().data[drawable],
      missing = new Set();
    for (const g of level().geometries) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(g.positions, 3));
      if (g.uvs) geometry.setAttribute('uv', new THREE.BufferAttribute(g.uvs, 2));
      geometry.setIndex(new THREE.BufferAttribute(g.indices, 1));
      if (g.normals) geometry.setAttribute('normal', new THREE.BufferAttribute(g.normals, 3));
      else geometry.computeVertexNormals();
      const t = resolveModelTexture(
        g.diffuseTexture,
        external,
        d.embeddedTextures || [],
        current().file.name,
      );
      if (g.diffuseTexture && !t) missing.add(g.diffuseTexture);
      const livery = resolveVehicleLivery(
        g,
        external,
        d.embeddedTextures || [],
        current().file.name,
      );
      if (liveryReference(g) && !livery) missing.add(liveryReference(g));
      const map = materialMap(t),
        alpha = modelAlphaMode(g);
      const base = createModelMaterial(g, {
        map,
        color: map ? 0xffffff : 0xb6bec9,
        side: THREE.DoubleSide,
        roughness: 0.65,
        transparent: !!map && alpha === 'blend',
        alphaTest: map && alpha === 'blend' ? (modelPreviewAlpha(g)?.cutoff ?? 0.02) : 0,
        depthWrite: !map || alpha !== 'blend',
      });
      const surfaces = resolveSurfaceMaps(
        g,
        external,
        d.embeddedTextures || [],
        current().file.name,
      );
      setSurfaceMaps(base, g.uvs ? surfaces : {}, materialMap);
      for (const [role, name] of Object.entries(surfaceReferences(g)))
        if (name && !surfaces[role]) missing.add(name);
      if (livery && g.uvs2) {
        geometry.setAttribute('ditashaLiveryUv', new THREE.BufferAttribute(g.uvs2, 2));
        setVehicleLivery(base, materialMap(livery));
      }
      const marked = copyVehicleLivery(base, copyVehicleSurface(base, base.clone()));
      marked.emissive.set(0xcf294b);
      marked.emissiveIntensity = 0.9;
      const hidden = copyVehicleLivery(base, copyVehicleSurface(base, base.clone()));
      hidden.visible = false;
      const mesh = new THREE.Mesh(geometry, [base, marked, hidden]);
      mesh.userData.source = g;
      mesh.userData.partsByTriangle = new Map();
      for (const p of g.parts)
        for (const tri of p.triangles) mesh.userData.partsByTriangle.set(tri, p);
      meshes.push(mesh);
      group.add(mesh);
    }
    $('dbWarnings').textContent = [
      ...new Set([
        ...current().data.flatMap((d) => d.warnings || []),
        ...(missing.size
          ? [
              'Missing textures: ' +
                [...missing].join(', ') +
                '. Add the matching YTD. Geometry can still be selected.',
            ]
          : []),
        ...(/_hi\.yft$/i.test(current().file.name)
          ? ['This is a high-detail file. Load the base YFT too to edit its other LODs.']
          : !models.some((m) => /_hi\.yft$/i.test(m.file.name))
            ? ['Matching _hi.yft is not loaded. Export will only change the loaded file.']
            : []),
      ]),
    ].join('\n');
    selectionChanged();
    if (fitCamera) fit();
    $('dbStatus').textContent = `${current().file.name} · ${d.name} · ${level().name} · ${level()
      .geometries.reduce((n, g) => n + g.indices.length / 3, 0)
      .toLocaleString()} source triangles`;
  }
  function fit() {
    if (!meshes.length) return;
    const box = new THREE.Box3().setFromObject(group),
      center = box.getCenter(new THREE.Vector3()),
      distance = Math.max(...box.getSize(new THREE.Vector3()).toArray(), 0.1) * 2.2;
    controls.target.copy(center);
    camera.position.copy(center).add(new THREE.Vector3(distance * 0.6, distance * 0.35, distance));
    camera.near = Math.max(0.001, distance / 10000);
    camera.far = distance * 100;
    camera.updateProjectionMatrix();
    controls.update();
    invalidate();
  }
  function selectOptions(id, items, value) {
    $(id).replaceChildren(
      ...items.map((text, i) => {
        const o = document.createElement('option');
        o.value = i;
        o.textContent = text;
        return o;
      }),
    );
    $(id).value = value;
  }
  function menus() {
    selectOptions(
      'dbFile',
      models.map((m) => m.file.name),
      active,
    );
    selectOptions('dbDrawable', current()?.data.map((d) => d.name) || [], drawable);
    selectOptions('dbLod', current()?.data[drawable]?.lods.map((l) => l.name) || [], lod);
    $('dbFiles').textContent =
      models.map((m) => m.file.name).join('\n') +
      (external.length ? '\n' + external.length + ' textures loaded' : '');
  }
  function allParts() {
    return models.flatMap((m, fi) =>
      m.data.flatMap((d, di) =>
        d.lods.flatMap((l, li) =>
          l.geometries.flatMap((g) =>
            g.parts.map((p, pi) => ({
              p,
              g,
              fi,
              di,
              li,
              label: `Part ${pi + 1} · ${g.diffuseTexture || g.name}`,
              id: key(fi, p),
              location: `${m.file.name} / ${d.name} / ${l.name}`,
            })),
          ),
        ),
      ),
    );
  }
  function selectionChanged() {
    for (const mesh of meshes) {
      const g = mesh.userData.source;
      mesh.geometry.clearGroups();
      let start = 0,
        last = -1;
      for (let t = 0; t < g.indices.length / 3; t++) {
        const p = mesh.userData.partsByTriangle.get(t),
          selected = p && selection.has(key(active, p)),
          material = selected ? ($('dbHide').checked ? 2 : 1) : 0;
        if (t === 0) {
          last = material;
          continue;
        }
        if (material !== last) {
          mesh.geometry.addGroup(start * 3, (t - start) * 3, last);
          start = t;
          last = material;
        }
      }
      if (g.indices.length) mesh.geometry.addGroup(start * 3, g.indices.length - start * 3, last);
      for (const mat of mesh.material) mat.wireframe = $('dbWire').checked;
    }
    const all = allParts(),
      unique = new Map(all.map((p) => [p.id, p])),
      picked = [...selection].map((id) => unique.get(id)).filter(Boolean),
      count = picked.reduce((n, x) => n + x.p.triangles.length, 0);
    $('dbCount').textContent = selection.size;
    $('dbSelection').textContent = selection.size
      ? `${selection.size} parts · ${count.toLocaleString()} triangles`
      : 'Nothing selected';
    $('dbSaved').textContent = dirty()
      ? 'Selection has not been exported.'
      : selection.size
        ? 'This selection was exported.'
        : '';
    drawParts(all);
    updateControls();
    invalidate();
  }
  function drawParts(all = allParts()) {
    const q = $('dbSearch').value.toLowerCase(),
      unique = new Map();
    for (const x of all)
      if (
        (selection.has(x.id) || (x.fi === active && x.di === drawable && x.li === lod)) &&
        !unique.has(x.id) &&
        (x.label + ' ' + x.location).toLowerCase().includes(q)
      )
        unique.set(x.id, x);
    const list = [...unique.values()].sort(
      (a, b) => Number(selection.has(b.id)) - Number(selection.has(a.id)),
    );
    $('dbParts').replaceChildren();
    for (const x of list.slice(0, shown)) {
      const row = document.createElement('div');
      row.className = 'db-part';
      row.classList.toggle('selected', selection.has(x.id));
      const label = document.createElement('label'),
        check = document.createElement('input');
      check.type = 'checkbox';
      check.checked = selection.has(x.id);
      check.disabled = busy;
      check.onchange = () => toggle(x.id);
      const text = document.createElement('span'),
        name = document.createElement('strong'),
        detail = document.createElement('small');
      name.textContent = x.label;
      detail.textContent = `${x.p.triangles.length} triangles · ${x.location}`;
      text.append(name, detail);
      label.append(check, text);
      const focus = document.createElement('button');
      focus.textContent = '◎';
      focus.title = 'Focus this part';
      focus.setAttribute('aria-label', 'Focus ' + x.label);
      focus.onclick = () => focusPart(x);
      row.append(label, focus);
      $('dbParts').append(row);
    }
    $('dbMore').hidden = list.length <= shown;
  }
  function focusPart(x) {
    active = x.fi;
    drawable = x.di;
    lod = x.li;
    menus();
    renderModel();
    const g = x.g,
      box = new THREE.Box3();
    for (const t of x.p.triangles)
      for (let k = 0; k < 3; k++) {
        const v = g.indices[t * 3 + k] * 3;
        box.expandByPoint(new THREE.Vector3(...g.positions.subarray(v, v + 3)));
      }
    const c = box.getCenter(new THREE.Vector3()),
      distance = Math.max(...box.getSize(new THREE.Vector3()).toArray(), 0.03) * 3;
    controls.target.copy(c);
    camera.position.copy(c).add(new THREE.Vector3(distance * 0.6, distance * 0.35, distance));
    camera.updateProjectionMatrix();
    controls.update();
    invalidate();
  }
  function toggle(id) {
    if (busy) return;
    history.push([...selection]);
    if (history.length > 50) history.shift();
    future = [];
    selection.has(id) ? selection.delete(id) : selection.add(id);
    selectionChanged();
  }
  async function run(task) {
    if (busy) return;
    busy = true;
    updateControls();
    try {
      await task();
    } catch (e) {
      $('dbStatus').textContent = e.message;
      toast(e.message);
    } finally {
      busy = false;
      selectionChanged();
    }
  }
  async function openFiles(files, seedTextures = []) {
    return run(async () => {
      const input = [...files],
        yfts = input.filter((f) => /\.yft$/i.test(f.name)),
        ytds = input.filter((f) => /\.ytd$/i.test(f.name));
      if (!yfts.length && !ytds.length) throw Error('Choose Legacy YFT and optional YTD files.');
      if (yfts.length > 2 || yfts.some((f) => f.size > 64 * 1024 * 1024))
        throw Error('Choose one base YFT and its optional _hi.yft (maximum 64 MB each).');
      let stagedModels = models,
        stagedExternal = yfts.length ? [...seedTextures] : [...external];
      if (ytds.length > 8) throw Error('Load at most 8 YTD dictionaries at a time.');
      if (yfts.length) {
        const family = (f) => f.name.replace(/_hi(?=\.yft$)/i, '').toLowerCase();
        if (
          new Set(yfts.map(family)).size > 1 ||
          new Set(yfts.map((f) => f.name.toLowerCase())).size !== yfts.length
        )
          throw Error('Load one vehicle family at a time.');
        if (
          dirty() &&
          confirmDiscard &&
          (await confirmDiscard('file', [{ name: 'Debadge selection has not been exported' }])) !==
            'discard'
        )
          return;
        const next = [];
        for (const f of yfts) {
          const input = await f.arrayBuffer();
          const original = input.slice(0);
          next.push({ file: f, original, data: await decodeResource('debadge-read', input) });
        }
        stagedModels = next;
      }
      let used = stagedExternal.reduce((n, t) => n + t.out.byteLength, 0);
      for (const file of ytds) {
        if (file.size > 64 * 1024 * 1024) throw Error('YTD input exceeds 64 MB.');
        const ts = await decodeResource('textures', await file.arrayBuffer(), {
          maxDecodedBytes: MAX_DECODED_TEXTURE_BYTES - used,
        });
        for (const t of ts) t.dictionary = file.name;
        used += ts.reduce((n, t) => n + t.out.byteLength, 0);
        stagedExternal.push(...ts);
      }
      models = stagedModels;
      external = stagedExternal;
      if (yfts.length) {
        active = drawable = lod = 0;
        selection.clear();
        saved = '';
        history = [];
        future = [];
        shown = 100;
        $('dbSearch').value = '';
        setProject('vehicles', models[0].file.name);
      }
      menus();
      renderModel(true);
    });
  }
  async function exportFiles() {
    return run(async () => {
      const revision = selectedKey(),
        outputs = [];
      let removed = 0;
      for (let i = 0; i < models.length; i++) {
        const selected = [...selection]
          .filter((k) => k.startsWith(i + ':'))
          .map((k) => k.slice(String(i).length + 1));
        if (!selected.length) continue;
        const result = await decodeResource('debadge-write', models[i].original.slice(0), {
          selected,
        });
        removed += result.removedTriangles;
        outputs.push({ name: 'stream/' + models[i].file.name, data: result.bytes });
      }
      if (!outputs.length) throw Error('Select a badge or part first.');
      let savedFile;
      if (outputs.length === 1)
        savedFile = await download(
          outputs[0].data,
          outputs[0].name.slice(7),
          'application/octet-stream',
        );
      else {
        outputs.push({
          name: 'README.txt',
          data: new TextEncoder().encode(
            'DITASHA visual debadge\nReplace the matching original YFT files in a COPY of your existing resource. Keep the original YTD and metadata. Only selected visual triangles are collapsed; collision, rig, buffers and unselected LODs are preserved.\n',
          ),
        });
        savedFile = await download(
          zipFiles(outputs),
          'ditasha-debadged-vehicle.zip',
          'application/zip',
        );
      }
      if (savedFile && selectedKey() === revision) saved = revision;
      $('dbStatus').textContent = savedFile
        ? `Exported ${removed.toLocaleString()} selected visual triangles. Original input files are unchanged.`
        : 'Save canceled. Your selection is still available.';
    });
  }
  $('dbBack').onclick = back;
  $('dbOpen').onclick = $('dbChoose').onclick = () => $('dbInput').click();
  $('dbTextures').onclick = () => $('dbTextureInput').click();
  for (const id of ['dbInput', 'dbTextureInput'])
    $(id).onchange = () => {
      const files = [...$(id).files];
      $(id).value = '';
      if (files.length) openFiles(files);
    };
  $('dbFile').onchange = () => {
    active = Number($('dbFile').value);
    drawable = lod = 0;
    shown = 100;
    menus();
    renderModel(true);
  };
  $('dbDrawable').onchange = () => {
    drawable = Number($('dbDrawable').value);
    lod = 0;
    shown = 100;
    menus();
    renderModel(true);
  };
  $('dbLod').onchange = () => {
    lod = Number($('dbLod').value);
    shown = 100;
    renderModel(true);
  };
  $('dbHide').onchange = $('dbWire').onchange = selectionChanged;
  $('dbSearch').oninput = () => {
    shown = 100;
    drawParts();
  };
  $('dbMore').onclick = () => {
    shown += 100;
    drawParts();
  };
  $('dbClear').onclick = () => {
    if (!selection.size) return;
    history.push([...selection]);
    selection.clear();
    future = [];
    selectionChanged();
  };
  $('dbUndo').onclick = () => {
    if (!history.length) return;
    future.push([...selection]);
    selection = new Set(history.pop());
    selectionChanged();
  };
  $('dbRedo').onclick = () => {
    if (!future.length) return;
    history.push([...selection]);
    selection = new Set(future.pop());
    selectionChanged();
  };
  $('dbFit').onclick = fit;
  $('dbExport').onclick = exportFiles;
  root.addEventListener('dragover', (e) => e.preventDefault());
  root.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    openFiles(e.dataTransfer.files);
  });
  return {
    root,
    openFiles,
    unsavedItems: () =>
      dirty() ? [{ name: 'Visual debadge selection has not been exported' }] : [],
    show: (source) => {
      if (source?.file && source.file !== lastWorkshopFile) {
        lastWorkshopFile = source.file;
        openFiles([source.file], source.textures || []);
      }
      menus();
      selectionChanged();
      setTimeout(() => budget?.resize(), 20);
    },
  };
}
