import * as THREE from 'three';
import { drawStampText, stampFonts } from './stamp-text.js';
import { projectTexture } from './project-texture.js';
import { fitSurfaceRadius, surfacePoint } from './surface-projection.js';
import { projectionResolution, projectionTargets } from './sticker-projection.js';

export function mountStickers3D({
  scene,
  viewport,
  camera,
  container,
  getMeshes,
  render,
  toast,
  getTextureSize,
  addTextureLayer,
  removeTextureLayer,
  previewTextureLayer,
}) {
  const group = new THREE.Group();
  group.name = 'Image and text stamps 3D';
  scene.add(group);
  const open = document.createElement('button');
  open.id = 'addPng3d';
  open.textContent = 'Stamp';
  open.title = 'Gambar atau teks → tarik pada model → layer UV 2D';

  const root = document.createElement('details');
  root.className = 'stickers-3d';
  root.innerHTML = `<summary>Stamp · Gambar &amp; teks <span id="stickerCount" class="badge">0</span></summary>
    <label>Jenis stamp<select id="stampType"><option value="image">Image · PNG / WebP / JPG</option><option value="text">Text</option></select></label>
    <input id="stickerInput" type="file" accept="image/png,image/webp,image/jpeg" hidden>
    <div id="stampTextFields" hidden><label>Teks<textarea id="stampText" maxlength="500" rows="3" placeholder="DITASHA WORKSHOP"></textarea></label><label>Font<select id="stampFont">${stampFonts.map((f) => `<option>${f}</option>`).join('')}</select></label><label>Ukuran font<input id="stampFontSize" type="number" min="12" max="512" value="128"></label><label>Warna<input id="stampColor" type="color" value="#ffffff"></label><div class="tattoo-actions"><label class="check"><input id="stampBold" type="checkbox" checked>Bold</label><label class="check"><input id="stampItalic" type="checkbox">Italic</label></div><button id="stampUpdateText" disabled>Perbarui teks terpilih</button></div>
    <div class="tattoo-actions"><button id="stickerPlace" disabled>Salinan</button><button id="stickerMove" disabled>Pindahkan</button></div>
    <div id="stickerList" aria-label="Tattoo yang dipasang"></div>
    <div class="tattoo-controls">
      <label class="tattoo-control"><span>Ukuran</span><div><input aria-label="Ukuran tattoo" id="stickerSize" type="range" min="1" max="80" value="20"><input aria-label="Ukuran tattoo persen" id="stickerSizeNumber" type="number" min="1" max="80" value="20"><span>%</span></div></label>
      <label class="tattoo-control"><span>Rotasi</span><div><input aria-label="Rotasi tattoo" id="stickerRotation" type="range" min="-180" max="180" value="0"><input aria-label="Rotasi tattoo derajat" id="stickerRotationNumber" type="number" min="-180" max="180" value="0"><span>°</span></div></label>
      <label class="tattoo-control"><span>Opacity</span><div><input aria-label="Opacity tattoo" id="stickerOpacity" type="range" min="1" max="100" value="100"><input aria-label="Opacity tattoo persen" id="stickerOpacityNumber" type="number" min="1" max="100" value="100"><span>%</span></div></label>
    </div>
    <label class="tattoo-control"><span>Kedalaman permukaan</span><div><input aria-label="Kedalaman tattoo" id="stickerDepth" type="range" min="10" max="300" value="150"><input aria-label="Kedalaman tattoo persen" id="stickerDepthNumber" type="number" min="10" max="300" value="150"><span>%</span></div></label>
    <label>Proyeksi<select id="stickerProjection"><option value="cylinder">Melingkar · leher / lengan</option><option value="plane" selected>Datar · logo / bidang rata</option></select></label>
    <label class="check"><input id="stickerSkin" type="checkbox">Kulit · pertahankan alpha sumber</label>
    <label>Area proyeksi<select id="stickerScope"><option value="texture">Semua mesh dengan tekstur sama</option><option value="mesh">Hanya mesh yang diklik</option><option value="all">Semua mesh · satu atlas UV</option></select></label>
    <label>Resolusi baking<select id="stickerResolution"><option value="0" selected>Asli · tanpa resize kulit</option><option value="2048">Minimal 2K · disarankan</option><option value="4096">Minimal 4K · detail tinggi</option></select></label>
    <p id="stickerQuality" class="muted">PNG asli dipertahankan. Baking tidak memperkecil tekstur. Peningkatan resolusi tidak memulihkan detail kulit yang sudah hilang.</p>
    <button id="stickerBake" disabled>Sinkronkan 2D</button>
    <p id="stickerStatus" role="status" class="muted">Pilih Image atau Text, lalu klik Stamp.</p>
    <div class="tattoo-actions"><button id="stickerRemove" disabled>Hapus tattoo</button><button id="stickerClear" disabled>Reset kontrol</button></div>
    <details class="tattoo-help"><summary>Cara pakai</summary><p>Tarik tattoo, atau pilih Pindahkan lalu klik permukaan baru. Jika tattoo terpotong di leher atau sambungan mesh, gunakan area tekstur sama dan tambah kedalaman. Semua mesh hanya untuk model yang berbagi satu atlas UV. Bagian di luar permukaan model tidak dapat menerima tattoo. Perubahan masuk ke layer 2D setelah kontrol dilepas. UV yang saling tumpang tindih akan berbagi hasil stamp; atlas berbeda perlu di-stamp satu per satu. Hapus tattoo menghapus layer; Reset kontrol mempertahankan layer. Ekspor YTD untuk menyimpan.</p></details>`;
  root.querySelector('#stampType').closest('label').before(open);
  container.prepend(root);
  const $ = (id) => root.querySelector('#' + id),
    assets = [],
    items = [];
  let asset = null,
    selected = null,
    armed = false,
    moving = false,
    dragging = null,
    generation = 0;
  const ray = new THREE.Raycaster(),
    pointer = new THREE.Vector2();
  function arm(value) {
    armed = value;
    viewport.classList.toggle('placing-sticker', value);
    $('stickerPlace').setAttribute('aria-pressed', String(value));
    $('stickerStatus').textContent = value
      ? moving
        ? 'Klik permukaan baru untuk memindahkan tattoo. Esc untuk batal.'
        : 'Klik permukaan model untuk menempatkan PNG. Esc untuk batal.'
      : items.length + ' stiker 3D';
  }
  function refresh() {
    $('stickerCount').textContent = items.length;
    $('stickerList').replaceChildren();
    for (const item of items) {
      const b = document.createElement('button');
      b.textContent = item.name;
      b.title = item.name;
      b.classList.toggle('active', item === selected);
      b.onclick = () => {
        selected = item;
        asset = item.asset;
        arm(false);
        moving = false;
        if (item.asset.textOptions) {
          const t = item.asset.textOptions;
          $('stampType').value = 'text';
          $('stampTextFields').hidden = false;
          $('stampText').value = t.text;
          $('stampFont').value = t.font;
          $('stampFontSize').value = t.size;
          $('stampColor').value = t.color;
          $('stampBold').checked = t.bold;
          $('stampItalic').checked = t.italic;
        }
        $('stickerSize').value = item.size;
        $('stickerRotation').value = item.rotation;
        $('stickerOpacity').value = item.opacity;
        $('stickerDepth').value = item.depth;
        $('stickerScope').value = item.scope;
        $('stickerProjection').value = item.projection;
        $('stickerSkin').checked = item.skin;
        refresh();
      };
      $('stickerList').append(b);
    }
    for (const id of ['stickerSize', 'stickerRotation', 'stickerOpacity', 'stickerDepth']) {
      $(id + 'Number').value = $(id).value;
      $(id).disabled = $(id + 'Number').disabled = !asset && !selected;
    }
    $('stampUpdateText').disabled = !selected?.asset.textOptions;
    $('stickerRemove').disabled = !selected;
    $('stickerBake').disabled = !selected;
    $('stickerMove').disabled = !selected;
    $('stickerClear').disabled = !items.length;
    $('stickerPlace').disabled = !asset;
  }
  function rebuild(item) {
    previewTextureLayer(item.binding || null);
    item.meshes.forEach((mesh) => {
      group.remove(mesh);
      mesh.geometry.dispose();
      mesh.material.dispose();
    });
    item.meshes = [];
    const box = new THREE.Box3();
    const targets = projectionTargets(getMeshes(), item.target, item.scope);
    item.targets = targets;
    [item.target].filter(Boolean).forEach((m) => {
      m.updateWorldMatrix(true, false);
      m.geometry.computeBoundingBox();
      box.union(m.geometry.boundingBox.clone().applyMatrix4(m.matrixWorld));
    });
    item.referenceLength ??= Math.max(box.getSize(new THREE.Vector3()).length(), 0.001);
    const width = (item.referenceLength * item.size) / 100;
    const projector = new THREE.Object3D();
    projector.position.copy(item.point);
    projector.lookAt(item.point.clone().add(item.normal));
    if (item.projection !== 'cylinder') projector.rotateZ(THREE.MathUtils.degToRad(item.rotation));
    const size = new THREE.Vector3(
      width,
      (width * item.asset.bitmap.height) / item.asset.bitmap.width,
      (width * item.depth) / 100,
    );
    projector.updateMatrixWorld();
    item.projector = projector.matrixWorld.clone();
    item.projectorSize = size;
    item.wrap =
      item.projection === 'cylinder'
        ? {
            radius: fitSurfaceRadius(targets, item.projector, size),
            rotation: THREE.MathUtils.degToRad(item.rotation),
          }
        : null;
    const dimensions = getTextureSize();
    item.projected = false;
    if (dimensions)
      try {
        const pixels = bakePixels(item, dimensions.w, dimensions.h);
        previewTextureLayer(item.binding || null, { pixels, skin: item.skin });
        item.projected = true;
      } catch (error) {
        $('stickerStatus').textContent = error.message;
      }
    render();
  }
  function bakePixels(item, width, height) {
    if (!item.asset.imageData) {
      const source = document.createElement('canvas');
      source.width = item.asset.bitmap.width;
      source.height = item.asset.bitmap.height;
      const context = source.getContext('2d');
      context.translate(0, source.height);
      context.scale(1, -1);
      context.drawImage(item.asset.bitmap, 0, 0);
      item.asset.imageData = context.getImageData(0, 0, source.width, source.height);
    }
    return projectTexture(
      projectionTargets(getMeshes(), item.target, item.scope),
      item.projector,
      item.projectorSize,
      item.asset.imageData,
      width,
      height,
      item.opacity / 100,
      item.side,
      item.wrap,
    );
  }
  function releaseUnusedAssets() {
    const used = new Set([asset, ...items.map((item) => item.asset)]);
    for (let i = assets.length - 1; i >= 0; i--)
      if (!used.has(assets[i])) {
        assets[i].map.dispose();
        assets[i].bitmap.close();
        assets.splice(i, 1);
      }
  }
  async function loadAsset(blob, name, textOptions = null, replace = null) {
    const version = generation;
    let bitmap;
    try {
      if (blob.size > 20 * 1024 * 1024) throw Error('Gambar maksimal 20 MB.');
      bitmap = await createImageBitmap(blob, { imageOrientation: 'flipY' });
      const pixels = bitmap.width * bitmap.height;
      releaseUnusedAssets();
      if (pixels > 16777216 || assets.reduce((n, a) => n + a.pixels, 0) + pixels > 33554432)
        throw Error(
          'Total gambar stamp maksimal 32 megapiksel; satu gambar maksimal 16 megapiksel.',
        );
      if (version !== generation || (replace && !items.includes(replace))) return;
      const map = new THREE.Texture(bitmap);
      map.colorSpace = THREE.SRGBColorSpace;
      map.anisotropy = 8;
      map.needsUpdate = true;
      asset = { map, bitmap, pixels, name, textOptions };
      assets.push(asset);
      bitmap = null;
      if (replace) {
        replace.asset = asset;
        replace.name = name;
        selected = replace;
        rebuild(replace);
        sync(replace);
      } else {
        selected = null;
        $('stickerSkin').checked = getTextureSize()?.skin || false;
        moving = false;
        arm(true);
      }
      releaseUnusedAssets();
      refresh();
    } catch (error) {
      $('stickerStatus').textContent = error.message;
      toast(error.message);
    } finally {
      bitmap?.close();
    }
  }
  async function textStamp(replace = null) {
    try {
      const canvas = document.createElement('canvas');
      const options = drawStampText(canvas, {
        text: $('stampText').value,
        font: $('stampFont').value,
        size: Number($('stampFontSize').value),
        color: $('stampColor').value,
        bold: $('stampBold').checked,
        italic: $('stampItalic').checked,
      });
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (!blob) throw Error('Teks tidak dapat dibuat.');
      await loadAsset(blob, 'Text · ' + options.text.slice(0, 40), options, replace);
    } catch (error) {
      toast(error.message);
    }
  }
  $('stampType').onchange = () => {
    $('stampTextFields').hidden = $('stampType').value !== 'text';
  };
  $('stampUpdateText').onclick = () => selected?.asset.textOptions && textStamp(selected);
  open.onclick = () => {
    if (!getMeshes().length) return toast('Buka model 3D terlebih dahulu.');
    root.open = true;
    if ($('stampType').value === 'text') textStamp();
    else $('stickerInput').click();
  };
  $('stickerInput').onchange = (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (file) loadAsset(file, file.name);
  };
  $('stickerPlace').onclick = () => {
    if (selected) asset = selected.asset;
    moving = false;
    arm(!armed);
  };
  $('stickerMove').onclick = () => {
    moving = true;
    arm(!armed);
  };
  function hitAt(event) {
    const rect = viewport.getBoundingClientRect();
    pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      (-(event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    camera.updateMatrixWorld();
    ray.setFromCamera(pointer, camera);
    const targets = getMeshes().filter((m) => m.visible);
    targets.forEach((m) => m.updateWorldMatrix(true, false));
    return ray.intersectObjects(targets, false)[0];
  }
  function locate(item, hit) {
    const matrix = new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld);
    const faceNormal = hit.face.normal.clone().applyMatrix3(matrix).normalize();
    const normal = (hit.normal || hit.face.normal).clone().applyMatrix3(matrix).normalize();
    item.target = hit.object;
    item.side = faceNormal.dot(ray.ray.direction) > 0 ? -1 : 1;
    if (normal.dot(ray.ray.direction) > 0) normal.negate();
    item.point = hit.point.clone();
    item.normal = normal;
    rebuild(item);
  }
  function sync(item) {
    try {
      const dimensions = getTextureSize();
      if (!dimensions) throw Error('Pilih tekstur untuk menyimpan tattoo ke kanvas 2D.');
      if (item.binding && item.binding.texture !== dimensions.texture)
        throw Error('Pilih kembali tekstur tempat tattoo ini dipasang.');
      const resolution = projectionResolution(
        dimensions.w,
        dimensions.h,
        Number($('stickerResolution').value),
      );
      const pixels = bakePixels(item, resolution.w, resolution.h);
      const layer = document.createElement('canvas');
      layer.width = resolution.w;
      layer.height = resolution.h;
      layer.projectionPixels = pixels;
      layer.preserveSourceAlpha = item.skin;
      layer.getContext('2d').putImageData(new ImageData(pixels, layer.width, layer.height), 0, 0);
      previewTextureLayer(null);
      item.binding = addTextureLayer(layer, item.name, item.binding);
      item.meshes.forEach((m) => (m.visible = false));
      $('stickerStatus').textContent =
        `Layer 2D diperbarui · ${resolution.w} × ${resolution.h} · ${item.targets.length} mesh · belum diekspor.`;
      render();
      return true;
    } catch (error) {
      previewTextureLayer(null);
      if (item.binding) item.meshes.forEach((m) => (m.visible = false));
      render();
      $('stickerStatus').textContent = error.message;
      toast(error.message);
      return false;
    }
  }
  viewport.addEventListener(
    'pointerdown',
    (event) => {
      if (event.button !== 0 || (!armed && !selected)) return;
      const hit = hitAt(event);
      if (!hit) return;
      if (!armed) {
        const localPoint = hit.point.clone().applyMatrix4(selected.projector.clone().invert());
        const local = surfacePoint(localPoint, selected.projectorSize, selected.wrap);
        const size = selected.projectorSize;
        if (
          Math.abs(local.x) > size.x / 2 ||
          Math.abs(local.y) > size.y / 2 ||
          Math.abs(local.depth) > size.z / 2
        )
          return;
        event.preventDefault();
        event.stopImmediatePropagation();
        dragging = {
          id: event.pointerId,
          item: selected,
          point: selected.point.clone(),
          normal: selected.normal.clone(),
          side: selected.side,
          target: selected.target,
          changed: false,
        };
        if (event.isTrusted) viewport.setPointerCapture?.(event.pointerId);
        return;
      }
      event.preventDefault();
      event.stopImmediatePropagation();
      if (moving && selected) {
        locate(selected, hit);
        arm(false);
        sync(selected);
        return;
      }
      if (items.length >= 16) {
        toast('Maksimum 16 stiker 3D.');
        return;
      }
      const item = {
        asset,
        name: asset.name,
        size: Number($('stickerSize').value),
        rotation: Number($('stickerRotation').value),
        opacity: Number($('stickerOpacity').value),
        depth: Number($('stickerDepth').value),
        scope: $('stickerScope').value,
        projection: $('stickerProjection').value,
        skin: $('stickerSkin').checked,
        meshes: [],
      };
      locate(item, hit);
      if (!item.projected) {
        toast('Pilih tekstur kulit/YTD terlebih dahulu, lalu pasang pada permukaan yang sesuai.');
        return;
      }
      items.push(item);
      selected = item;
      refresh();
      arm(false);
      sync(item);
      dragging = {
        id: event.pointerId,
        item,
        point: item.point.clone(),
        normal: item.normal.clone(),
        side: item.side,
        target: item.target,
        changed: false,
        created: true,
      };
      if (event.isTrusted) viewport.setPointerCapture?.(event.pointerId);
    },
    true,
  );
  viewport.addEventListener(
    'pointermove',
    (event) => {
      if (!dragging || event.pointerId !== dragging.id) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const hit = hitAt(event);
      if (hit) {
        locate(dragging.item, hit);
        dragging.changed = true;
      }
    },
    true,
  );
  function finishDrag(event) {
    if (!dragging || event.pointerId !== dragging.id) return;
    const drag = dragging;
    dragging = null;
    if (event.type === 'pointercancel' && drag.created) {
      previewTextureLayer(null);
      if (drag.item.binding) removeTextureLayer(drag.item.binding);
      items.splice(items.indexOf(drag.item), 1);
      selected = items.at(-1) || null;
      refresh();
      render();
    } else if (event.type === 'pointercancel') {
      Object.assign(drag.item, {
        point: drag.point,
        normal: drag.normal,
        side: drag.side,
        target: drag.target,
      });
      rebuild(drag.item);
      previewTextureLayer(null);
      if (drag.item.binding) drag.item.meshes.forEach((m) => (m.visible = false));
      render();
    } else if (drag.changed) sync(drag.item);
    if (viewport.hasPointerCapture?.(event.pointerId))
      viewport.releasePointerCapture(event.pointerId);
  }
  viewport.addEventListener('pointerup', finishDrag, true);
  viewport.addEventListener('pointercancel', finishDrag, true);
  document.addEventListener(
    'keydown',
    (e) => {
      if (e.key === 'Escape' && armed) {
        arm(false);
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    },
    true,
  );
  for (const [id, key] of [
    ['stickerSize', 'size'],
    ['stickerRotation', 'rotation'],
    ['stickerOpacity', 'opacity'],
    ['stickerDepth', 'depth'],
  ]) {
    for (const control of [id, id + 'Number']) {
      $(control).oninput = () => {
        const value = Number($(control).value);
        if (!Number.isFinite(value) || $(control).value === '') return;
        const clamped = Math.max(Number($(id).min), Math.min(Number($(id).max), value));
        $(id).value = clamped;
        if (control === id) $(id + 'Number').value = clamped;
        if (selected) {
          selected[key] = clamped;
          rebuild(selected);
        }
        $('stickerStatus').textContent = 'Preview · Lepaskan kontrol untuk sinkronkan 2D.';
      };
      $(control).onchange = () => {
        $(id + 'Number').value = $(id).value;
        if (selected) sync(selected);
      };
    }
  }
  $('stickerScope').onchange = () => {
    if (!selected) return;
    selected.scope = $('stickerScope').value;
    rebuild(selected);
    sync(selected);
  };
  for (const [id, key] of [
    ['stickerProjection', 'projection'],
    ['stickerSkin', 'skin'],
  ])
    $(id).onchange = () => {
      if (!selected) return;
      selected[key] = id === 'stickerSkin' ? $(id).checked : $(id).value;
      rebuild(selected);
      sync(selected);
    };
  $('stickerResolution').onchange = () => {
    if (selected) sync(selected);
  };
  $('stickerBake').onclick = () => selected && sync(selected);
  $('stickerRemove').onclick = () => {
    if (!selected) return;
    previewTextureLayer(null);
    if (selected.binding) removeTextureLayer(selected.binding);
    selected.meshes.forEach((m) => {
      group.remove(m);
      m.geometry.dispose();
      m.material.dispose();
    });
    items.splice(items.indexOf(selected), 1);
    releaseUnusedAssets();
    selected = items.at(-1) || null;
    $('stickerStatus').textContent = items.length
      ? items.length + ' tattoo'
      : 'Belum ada tattoo. Pilih Image atau Text, lalu klik Stamp.';
    refresh();
    render();
  };
  function clear() {
    previewTextureLayer(null);
    generation++;
    dragging = null;
    moving = false;
    arm(false);
    items.splice(0).forEach((item) =>
      item.meshes.forEach((m) => {
        group.remove(m);
        m.geometry.dispose();
        m.material.dispose();
      }),
    );
    assets.splice(0).forEach((a) => {
      a.map.dispose();
      a.bitmap.close();
    });
    asset = selected = null;
    $('stickerStatus').textContent = 'Tambah PNG, lalu klik permukaan model.';
    refresh();
    render();
  }
  $('stickerClear').onclick = clear;
  refresh();
  return { group, clear };
}
