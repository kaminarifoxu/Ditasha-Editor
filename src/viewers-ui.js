import * as THREE from 'three';
import { mountPhotoshoot } from './photoshoot.js';
import { mountMaterialPreview } from './material-preview.js';
import { mountPedAttachments } from './ped-attachments.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { readYtd, readYdd, readYdr, readYft } from './resource.js';
import { imageData } from './converter.js';
import { writeDds, zipFiles, safePath, MAX_EXPORT } from './asset-tools.js';
const modelExtensions = /\.(ydd|ydr|yft)$/i,
  textureExtensions = /\.(ytd|dds|png|jpg|jpeg|webp)$/i;
function textureCanvas(t) {
  const canvas = document.createElement('canvas');
  canvas.width = t.w;
  canvas.height = t.h;
  canvas.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(t.out), t.w, t.h), 0, 0);
  return canvas;
}
export function mountViewers({ nav, download, toast, activate }) {
  const $ = (id) => document.getElementById(id);
  for (const [page, label, path] of [
    ['textureviewer', 'Texture viewer', 'M3 3h18v18H3Z M3 16l5-5 4 4 4-5 5 6'],
    ['modelviewer', 'Model viewer', 'm12 2 9 5v10l-9 5-9-5V7Z M3 7l9 5 9-5 M12 12v10'],
  ]) {
    const b = document.createElement('button');
    b.dataset.page = page;
    b.innerHTML =
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + path + '"/></svg>' + label;
    b.onclick = () => activate(page);
    nav.append(b);
  }
  const textureRoot = document.createElement('section');
  textureRoot.className = 'asset-viewer texture-viewer';
  textureRoot.hidden = true;
  textureRoot.innerHTML = `<aside class="tool-sidebar"><span class="eyebrow">GTA V LEGACY</span><h2>Texture viewer</h2><button id="tvOpen" class="primary">Open YTD / image</button><input id="tvInput" type="file" accept=".ytd,.dds,.png,.jpg,.jpeg,.webp" multiple hidden><input id="tvSearch" class="search" placeholder="Search textures…" aria-label="Search textures"><div class="viewer-options"><label>Thumbnail size<input id="tvSize" type="range" min="96" max="256" step="32" value="160"></label><label>View<select id="tvLayout"><option value="grid">Grid</option><option value="list">List</option></select></label><label>Alpha background<select id="tvBackground"><option value="checker">Checkerboard</option><option value="black">Black</option><option value="white">White</option><option value="gray">Gray</option></select></label><label>Export format<select id="tvFormat"><option value="png">PNG</option><option value="dds">DDS RGBA</option></select></label></div><button id="tvExport" disabled>Export selected</button><button id="tvExportAll" disabled>Export all (ZIP)</button><p id="tvStatus" class="muted" role="status">Open a texture dictionary to browse its textures.</p></aside><section class="viewer-content"><div class="viewer-toolbar"><div><span class="eyebrow">TEXTURE DICTIONARY</span><h2 id="tvTitle">No textures loaded</h2></div><div class="viewer-button-row"><button id="tvFit">Fit</button><button id="tvOriginal">Original size</button><button id="tvZoomOut" aria-label="Zoom out">−</button><button id="tvZoomIn" aria-label="Zoom in">+</button><span id="tvZoom">100%</span></div></div><div id="tvPreview" class="texture-preview checker"><canvas id="tvCanvas" hidden></canvas><p id="tvEmpty" class="muted">YTD · DDS · PNG · JPG · WebP</p></div><p id="tvInfo" class="muted">Select a thumbnail to inspect dimensions, format and mip levels.</p><div id="tvGallery" class="texture-gallery"></div></section>`;
  const modelRoot = document.createElement('section');
  modelRoot.className = 'asset-viewer model-viewer';
  modelRoot.hidden = true;
  modelRoot.innerHTML = `<aside class="tool-sidebar"><span class="eyebrow">GTA V LEGACY</span><h2>Model viewer</h2><div class="viewer-button-row"><button id="mvOpen" class="primary">Open model</button><button id="mvAddTextures">+ Textures</button></div><input id="mvInput" type="file" accept=".yft,.ydd,.ydr,.ytd" multiple hidden><input id="mvTextureInput" type="file" accept=".ytd,.dds,.png,.jpg,.jpeg,.webp" multiple hidden><div class="viewer-options"><label>Drawable<select id="mvDrawable" disabled></select></label><label>Level of detail<select id="mvLod" disabled></select></label><label class="check"><input id="mvGrid" type="checkbox" checked>Grid</label><label class="check"><input id="mvWire" type="checkbox">Wireframe</label><label class="check"><input id="mvBounds" type="checkbox">Geometry bounds</label><label class="check"><input id="mvPoints" type="checkbox">Vertex points</label></div><h3>Visible parts</h3><div class="viewer-button-row"><button id="mvShowAll">Show all</button><button id="mvHideAll">Hide all</button></div><div id="mvParts"></div><h3>Loaded textures</h3><div id="mvTextures"></div><p class="muted">Static geometry and diffuse materials. Skeleton animation, damage physics and mesh editing are not supported.</p></aside><section class="viewer-content"><div class="viewer-toolbar"><div><span class="eyebrow">MODEL PREVIEW</span><h2 id="mvTitle">No model loaded</h2></div><div class="viewer-button-row"><button id="mvFit">Fit model</button><button id="mvFront">Front</button><button id="mvSide">Side</button><button id="mvTop">Top</button><button id="mvSnapshot" disabled>Save PNG</button></div></div><div id="mvViewport"><p id="mvEmpty" class="muted">Open a YFT, YDD or YDR model. Drag to orbit; right-drag to pan; scroll to zoom.</p></div><p id="mvStatus" class="muted" role="status">Ready.</p></section>`;
  nav.after(textureRoot);
  textureRoot.after(modelRoot);
  let textures = [],
    selected = 0,
    textureScale = 1,
    textureFit = true,
    textureBusy = false,
    modelBusy = false,
    modelName = '',
    drawables = [],
    modelTextures = [],
    drawable = 0,
    lod = 0;
  const scene = new THREE.Scene(),
    camera = new THREE.PerspectiveCamera(40, 1, 0.01, 10000);
  let renderer,
    controls,
    group = new THREE.Group(),
    grid = null,
    bounds = null,
    points = [],
    maps = [],
    mapCache = new Map();
  scene.add(group);
  const pedAttachments = mountPedAttachments({
    scene,
    container: modelRoot.querySelector('.tool-sidebar'),
    prefix: 'mvPed',
    toast,
    hasBase: () => !!drawables.length,
    onChange: (fit) => {
      if (fit) fitModel();
      renderer?.render(scene, camera);
    },
  });
  const pedMaterials = mountMaterialPreview({
    container: modelRoot.querySelector('.tool-sidebar'),
    prefix: 'mvPed',
    onChange: () => renderer?.render(scene, camera),
  });
  scene.add(new THREE.HemisphereLight(0xffffff, 0x526079, 2.5));
  const light = new THREE.DirectionalLight(0xffffff, 3);
  light.position.set(3, 5, 4);
  scene.add(light);
  function initRenderer() {
    if (renderer) return;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        preserveDrawingBuffer: true,
      });
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
      $('mvViewport').prepend(renderer.domElement);
      controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.addEventListener('change', () => renderer.render(scene, camera));
      new ResizeObserver(() => {
        const width = $('mvViewport').clientWidth,
          height = $('mvViewport').clientHeight;
        if (width && height) {
          renderer.setSize(width, height);
          camera.aspect = width / height;
          camera.updateProjectionMatrix();
          renderer.render(scene, camera);
        }
      }).observe($('mvViewport'));
      renderer.setAnimationLoop(() => {
        if (modelRoot.hidden) return;
        controls.update();
        renderer.render(scene, camera);
      });
    } catch (e) {
      renderer = null;
      $('mvStatus').textContent = '3D preview requires WebGL hardware acceleration.';
      toast('3D preview requires WebGL hardware acceleration.');
    }
  }
  function setBusy(root, value) {
    root.querySelectorAll('button,input,select').forEach((e) => (e.disabled = value));
    if (!value) {
      if (root === textureRoot) {
        $('tvExport').disabled = $('tvExportAll').disabled = !textures.length;
      } else {
        $('mvDrawable').disabled = $('mvLod').disabled = !drawables.length;
        $('mvSnapshot').disabled = !renderer || !drawables.length;
      }
    }
  }
  async function operation(kind, task) {
    const root = kind === 'texture' ? textureRoot : modelRoot;
    if (kind === 'texture' ? textureBusy : modelBusy) return;
    kind === 'texture' ? (textureBusy = true) : (modelBusy = true);
    setBusy(root, true);
    $(kind === 'texture' ? 'tvStatus' : 'mvStatus').textContent = 'Loading / processing…';
    await new Promise((resolve) => setTimeout(resolve, 20));
    try {
      await task();
    } catch (e) {
      $(kind === 'texture' ? 'tvStatus' : 'mvStatus').textContent = e.message;
      toast(e.message);
    } finally {
      kind === 'texture' ? (textureBusy = false) : (modelBusy = false);
      setBusy(root, false);
    }
  }
  function scaledTexture() {
    const t = textures[selected];
    if (!t) return;
    const fit = Math.min(
        ($('tvPreview').clientWidth - 32) / t.w,
        ($('tvPreview').clientHeight - 32) / t.h,
        1,
      ),
      ratio = textureFit ? Math.max(0.01, fit) : textureScale;
    $('tvCanvas').style.width = t.w * ratio + 'px';
    $('tvCanvas').style.height = t.h * ratio + 'px';
    $('tvZoom').textContent = Math.round(ratio * 100) + '%';
  }
  function chooseTexture(i) {
    selected = i;
    const t = textures[i];
    if (!t) return;
    const canvas = $('tvCanvas');
    canvas.width = t.w;
    canvas.height = t.h;
    canvas
      .getContext('2d')
      .putImageData(new ImageData(new Uint8ClampedArray(t.out), t.w, t.h), 0, 0);
    canvas.hidden = false;
    $('tvEmpty').hidden = true;
    $('tvInfo').textContent =
      t.name +
      ' · ' +
      t.w +
      ' × ' +
      t.h +
      ' · ' +
      (t.format || 'RGBA') +
      ' · ' +
      (t.mipLevels || 1) +
      ' mip level(s) · ' +
      t.dictionary;
    scaledTexture();
    $('tvGallery')
      .querySelectorAll('button')
      .forEach((b) => b.classList.toggle('selected', Number(b.dataset.index) === i));
  }
  function gallery() {
    const q = $('tvSearch').value.toLowerCase(),
      root = $('tvGallery');
    root.classList.toggle('is-list', $('tvLayout').value === 'list');
    root.style.setProperty('--thumb-size', $('tvSize').value + 'px');
    root.replaceChildren();
    textures.forEach((t, i) => {
      if (!(t.name + ' ' + t.dictionary).toLowerCase().includes(q)) return;
      const b = document.createElement('button');
      b.className = 'texture-tile';
      b.dataset.index = i;
      b.classList.toggle('selected', i === selected);
      let c = t.thumbnail;
      if (!c) {
        c = document.createElement('canvas');
        const ratio = Math.min(256 / t.w, 256 / t.h, 1);
        c.width = Math.max(1, Math.round(t.w * ratio));
        c.height = Math.max(1, Math.round(t.h * ratio));
        const original = textureCanvas(t);
        c.getContext('2d').drawImage(original, 0, 0, c.width, c.height);
        original.width = original.height = 1;
        t.thumbnail = c;
      }
      const strong = document.createElement('strong');
      strong.textContent = t.name;
      const small = document.createElement('small');
      small.textContent = t.w + ' × ' + t.h + ' · ' + (t.format || 'RGBA');
      b.append(c, strong, small);
      b.onclick = () => chooseTexture(i);
      root.append(b);
    });
  }
  async function readTextures(files) {
    const out = [];
    let size = 0;
    for (const f of files) {
      if (f.size > 64 * 1024 * 1024 || !textureExtensions.test(f.name))
        throw Error('Textures: YTD, DDS or images up to 64 MB per file.');
      for (const t of await imageData(f)) {
        size += t.out.length;
        if (size > MAX_EXPORT) throw Error('Decoded texture limit: 128 MB.');
        out.push({ ...t, dictionary: f.name });
      }
    }
    return out;
  }
  async function openTextures(files) {
    activate('textureviewer');
    await operation('texture', async () => {
      const next = await readTextures(files);
      if (!next.length) throw Error('No textures found.');
      textures = next;
      selected = 0;
      textureFit = true;
      textureScale = 1;
      $('tvTitle').textContent = files.map((f) => f.name).join(' + ');
      $('tvStatus').textContent = textures.length + ' textures loaded.';
      gallery();
      chooseTexture(0);
    });
  }
  async function textureBytes(t, format) {
    if (format === 'dds') return writeDds(t);
    const c = textureCanvas(t),
      blob = await new Promise((resolve) => c.toBlob(resolve, 'image/png'));
    c.width = c.height = 1;
    if (!blob) throw Error('PNG export failed.');
    return new Uint8Array(await blob.arrayBuffer());
  }
  function exportName(t, i) {
    const name =
      t.name
        .replace(/[\x00-\x1f<>:"\\/|?*]/g, '_')
        .replace(/[. ]+$/, '')
        .slice(0, 110) || 'texture';
    const path = name + '.' + $('tvFormat').value;
    try {
      return safePath(path);
    } catch {
      return 'texture_' + (i + 1) + '.' + $('tvFormat').value;
    }
  }
  $('tvOpen').onclick = () => $('tvInput').click();
  $('tvInput').onchange = (e) => {
    const files = [...e.target.files];
    if (files.length) openTextures(files);
    e.target.value = '';
  };
  $('tvSearch').oninput = $('tvLayout').onchange = $('tvSize').oninput = gallery;
  $('tvBackground').onchange = () => {
    $('tvPreview').className = 'texture-preview ' + $('tvBackground').value;
  };
  $('tvFit').onclick = () => {
    textureFit = true;
    scaledTexture();
  };
  $('tvOriginal').onclick = () => {
    textureFit = false;
    textureScale = 1;
    scaledTexture();
  };
  for (const [id, factor] of [
    ['tvZoomIn', 1.25],
    ['tvZoomOut', 0.8],
  ])
    $(id).onclick = () => {
      if (textureFit) {
        textureScale = parseInt($('tvZoom').textContent) / 100;
        textureFit = false;
      }
      textureScale = Math.min(8, Math.max(0.05, textureScale * factor));
      scaledTexture();
    };
  new ResizeObserver(scaledTexture).observe($('tvPreview'));
  $('tvExport').onclick = () =>
    operation('texture', async () => {
      $('tvStatus').textContent = (await download(
        await textureBytes(textures[selected], $('tvFormat').value),
        exportName(textures[selected], selected),
        'application/octet-stream',
      ))
        ? 'Texture exported.'
        : 'Save canceled.';
    });
  $('tvExportAll').onclick = () =>
    operation('texture', async () => {
      const entries = [];
      let total = 0;
      for (let i = 0; i < textures.length; i++) {
        const data = await textureBytes(textures[i], $('tvFormat').value);
        total += data.length;
        if (total > MAX_EXPORT - 65536) throw Error('Export exceeds 128 MB.');
        entries.push({
          name: String(i + 1).padStart(4, '0') + '_' + exportName(textures[i], i),
          data,
        });
      }
      $('tvStatus').textContent = (await download(
        zipFiles(entries),
        'ditasha-textures.zip',
        'application/zip',
      ))
        ? 'All textures exported.'
        : 'Save canceled.';
    });
  function disposeModel() {
    pedMaterials.clear(false);
    group.traverse((o) => {
      o.geometry?.dispose();
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) m?.dispose();
    });
    scene.remove(group);
    group = new THREE.Group();
    scene.add(group);
    for (const t of maps) t.dispose();
    maps = [];
    mapCache.clear();
    for (const helper of [grid, bounds])
      if (helper) {
        scene.remove(helper);
        helper.geometry?.dispose();
        helper.material?.dispose();
      }
    grid = bounds = null;
    points = [];
  }
  function fitModel(axis = 'orbit') {
    if (!controls) return;
    const box = new THREE.Box3().setFromObject(group);
    box.union(new THREE.Box3().setFromObject(pedAttachments.group));
    if (box.isEmpty()) return;
    const center = box.getCenter(new THREE.Vector3()),
      size = box.getSize(new THREE.Vector3()),
      distance = Math.max(size.x, size.y, size.z, 0.1) * 2.3;
    controls.target.copy(center);
    const offset =
      axis === 'front'
        ? new THREE.Vector3(0, 0, distance)
        : axis === 'side'
          ? new THREE.Vector3(distance, 0, 0)
          : axis === 'top'
            ? new THREE.Vector3(0, distance, 0.0001)
            : new THREE.Vector3(distance * 0.55, distance * 0.35, distance);
    camera.position.copy(center).add(offset);
    camera.near = Math.max(0.001, distance / 1000);
    camera.far = distance * 1000;
    camera.updateProjectionMatrix();
    controls.update();
    renderer?.render(scene, camera);
  }
  function textureLookup(name, embedded) {
    return [...modelTextures, ...embedded].find(
      (t) =>
        t.name.replace(/\.(dds|png|jpe?g|webp)$/i, '').toLowerCase() ===
        name?.replace(/\.(dds|png|jpe?g|webp)$/i, '').toLowerCase(),
    );
  }
  function materialMap(t) {
    if (!t) return null;
    if (mapCache.has(t)) return mapCache.get(t);
    const canvas = textureCanvas(t),
      map = new THREE.CanvasTexture(canvas);
    map.flipY = false;
    map.colorSpace = THREE.SRGBColorSpace;
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    maps.push(map);
    mapCache.set(t, map);
    return map;
  }
  function modelOptions() {
    const names = drawables.map((d) => d.name);
    $('mvDrawable').replaceChildren(
      ...names.map((name, i) => {
        const o = document.createElement('option');
        o.value = i;
        o.textContent = name;
        return o;
      }),
    );
    $('mvDrawable').value = drawable;
    const levels = drawables[drawable]?.lods || [];
    $('mvLod').replaceChildren(
      ...levels.map((level, i) => {
        const o = document.createElement('option');
        o.value = i;
        o.textContent = level.name;
        return o;
      }),
    );
    $('mvLod').value = lod;
  }
  function renderModel() {
    disposeModel();
    const d = drawables[drawable];
    if (!d) return;
    initRenderer();
    const level = d.lods[lod],
      embedded = d.embeddedTextures || [];
    let triangles = 0,
      vertices = 0;
    const missing = new Set(),
      parts = new Map();
    for (const [index, g] of level.geometries.entries()) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(g.positions, 3));
      if (g.uvs) geometry.setAttribute('uv', new THREE.BufferAttribute(g.uvs, 2));
      geometry.setIndex(new THREE.BufferAttribute(g.indices, 1));
      geometry.computeVertexNormals();
      const t = textureLookup(g.diffuseTexture, embedded);
      if (g.diffuseTexture && !t) missing.add(g.diffuseTexture);
      const material = new THREE.MeshStandardMaterial({
        color: t ? 0xffffff : 0xb3bbc8,
        map: materialMap(t),
        side: THREE.DoubleSide,
        roughness: 0.75,
        wireframe: $('mvWire').checked,
        transparent: !!t,
        alphaTest: t ? 0.05 : 0,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.name =
        'Part ' +
        (g.part + 1) +
        ' · mesh ' +
        (index + 1) +
        ' · ' +
        (g.diffuseTexture || 'tanpa diffuse');
      const p = new THREE.Points(
        geometry,
        new THREE.PointsMaterial({ color: 0xb2a2ff, size: 0.025, sizeAttenuation: true }),
      );
      p.visible = $('mvPoints').checked;
      mesh.add(p);
      points.push(p);
      if (!parts.has(g.part)) parts.set(g.part, []);
      parts.get(g.part).push(mesh);
      group.add(mesh);
      triangles += g.indices.length / 3;
      vertices += g.positions.length / 3;
    }
    const box = new THREE.Box3().setFromObject(group),
      size = Math.max(...box.getSize(new THREE.Vector3()).toArray(), 1);
    grid = new THREE.GridHelper(size * 3, 24, 0x716985, 0x34343d);
    grid.position.y = box.min.y;
    grid.visible = $('mvGrid').checked;
    scene.add(grid);
    bounds = new THREE.Box3Helper(box, 0xb2a2ff);
    bounds.visible = $('mvBounds').checked;
    scene.add(bounds);
    $('mvParts').replaceChildren();
    for (const [index, meshes] of parts) {
      const label = document.createElement('label');
      label.className = 'check';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = true;
      input.onchange = () => meshes.forEach((m) => (m.visible = input.checked));
      label.append(
        input,
        document.createTextNode('Part ' + (index + 1) + ' · ' + meshes.length + ' meshes'),
      );
      $('mvParts').append(label);
    }
    $('mvTextures').replaceChildren();
    for (const t of [...embedded, ...modelTextures]) {
      const p = document.createElement('p');
      p.className = 'muted';
      p.textContent = t.name + ' · ' + t.w + ' × ' + t.h;
      if (modelTextures.includes(t)) {
        const row = document.createElement('div');
        row.className = 'viewer-button-row';
        const remove = document.createElement('button');
        remove.textContent = '×';
        remove.setAttribute('aria-label', 'Remove texture ' + t.name);
        remove.onclick = () => {
          if (modelBusy) return;
          modelTextures.splice(modelTextures.indexOf(t), 1);
          renderModel();
        };
        row.append(p, remove);
        $('mvTextures').append(row);
      } else $('mvTextures').append(p);
    }
    $('mvTitle').textContent = modelName;
    $('mvEmpty').hidden = !!renderer;
    $('mvStatus').textContent =
      triangles.toLocaleString() +
      ' triangles · ' +
      vertices.toLocaleString() +
      ' vertices · ' +
      parts.size +
      ' parts · ' +
      level.name +
      (missing.size ? ' · Missing textures: ' + [...missing].join(', ') : '') +
      (d.warnings?.length ? ' · ' + d.warnings.join('; ') : '') +
      (!renderer ? ' · WebGL unavailable.' : '');
    modelOptions();
    pedMaterials.setMeshes(group.children.filter((mesh) => mesh.isMesh));
    fitModel();
  }
  async function openModels(files) {
    activate('modelviewer');
    await operation('model', async () => {
      const f = files.find((f) => modelExtensions.test(f.name));
      if (!f || f.size > 64 * 1024 * 1024) throw Error('Choose YFT, YDD or YDR up to 64 MB.');
      const ext = f.name.split('.').at(-1).toLowerCase(),
        next = { yft: readYft, ydd: readYdd, ydr: readYdr }[ext](await f.arrayBuffer()),
        loaded = await readTextures(files.filter((f) => textureExtensions.test(f.name)));
      pedAttachments.clear();
      pedMaterials.clear();
      drawables = next;
      modelTextures = loaded;
      modelName = f.name;
      drawable = lod = 0;
      renderModel();
    });
  }
  $('mvOpen').onclick = () => $('mvInput').click();
  $('mvAddTextures').onclick = () => $('mvTextureInput').click();
  $('mvInput').onchange = (e) => {
    const files = [...e.target.files];
    if (files.length) openModels(files);
    e.target.value = '';
  };
  $('mvTextureInput').onchange = (e) => {
    const files = [...e.target.files];
    if (files.length)
      operation('model', async () => {
        const next = await readTextures(files);
        const names = new Set(next.map((t) => t.name.toLowerCase()));
        const merged = [...modelTextures.filter((t) => !names.has(t.name.toLowerCase())), ...next];
        if (merged.reduce((n, t) => n + t.out.length, 0) > MAX_EXPORT)
          throw Error('Model textures exceed 128 MB.');
        modelTextures = merged;
        if (drawables.length) renderModel();
      });
    e.target.value = '';
  };
  $('mvDrawable').onchange = () => {
    drawable = Number($('mvDrawable').value);
    lod = 0;
    renderModel();
  };
  $('mvLod').onchange = () => {
    lod = Number($('mvLod').value);
    renderModel();
  };
  $('mvGrid').onchange = () => {
    if (grid) grid.visible = $('mvGrid').checked;
  };
  $('mvBounds').onchange = () => {
    if (bounds) bounds.visible = $('mvBounds').checked;
  };
  $('mvPoints').onchange = () => points.forEach((p) => (p.visible = $('mvPoints').checked));
  $('mvWire').onchange = () => {
    group.children.forEach((m) => (m.material.wireframe = $('mvWire').checked));
    pedAttachments.setWireframe($('mvWire').checked);
  };
  for (const [id, axis] of [
    ['mvFit', 'orbit'],
    ['mvFront', 'front'],
    ['mvSide', 'side'],
    ['mvTop', 'top'],
  ])
    $(id).onclick = () => fitModel(axis);
  for (const [id, show] of [
    ['mvShowAll', true],
    ['mvHideAll', false],
  ])
    $(id).onclick = () => {
      $('mvParts')
        .querySelectorAll('input')
        .forEach((input) => {
          input.checked = show;
          input.dispatchEvent(new Event('change'));
        });
    };
  $('mvSnapshot').onclick = () =>
    operation('model', async () => {
      renderer.render(scene, camera);
      const blob = await new Promise((resolve) => renderer.domElement.toBlob(resolve, 'image/png'));
      if (!blob) throw Error('Snapshot failed.');
      $('mvStatus').textContent = (await download(blob, 'ditasha-model-viewer.png', 'image/png'))
        ? 'Snapshot saved.'
        : 'Save canceled.';
    });
  $('open').addEventListener(
    'click',
    (e) => {
      if (textureRoot.hidden && modelRoot.hidden) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      $(!textureRoot.hidden ? 'tvInput' : 'mvInput').click();
    },
    true,
  );
  document.addEventListener(
    'drop',
    (e) => {
      if (textureRoot.hidden && modelRoot.hidden) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      const files = [...e.dataTransfer.files];
      $('drop').classList.remove('drag');
      if (!textureRoot.hidden) openTextures(files);
      else if (files.some((f) => modelExtensions.test(f.name))) openModels(files);
      else
        operation('model', async () => {
          const next = await readTextures(files);
          const names = new Set(next.map((t) => t.name.toLowerCase()));
          const merged = [
            ...modelTextures.filter((t) => !names.has(t.name.toLowerCase())),
            ...next,
          ];
          if (merged.reduce((n, t) => n + t.out.length, 0) > MAX_EXPORT)
            throw Error('Model textures exceed 128 MB.');
          modelTextures = merged;
          if (drawables.length) renderModel();
        });
    },
    true,
  );
  mountPhotoshoot({
    container: modelRoot.querySelector('.viewer-toolbar .viewer-button-row'),
    id: 'mvPhotoshoot',
    download,
    toast,
    getSource: () =>
      drawables.length && renderer
        ? {
            objects: [group, pedAttachments.group],
            camera,
            target: controls.target,
            name: modelName,
          }
        : null,
  });
  return { textureRoot, modelRoot, openTextures, openModels };
}
