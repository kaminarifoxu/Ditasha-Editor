import * as THREE from 'three';
import { projectTexture } from './project-texture.js';
import { DecalGeometry } from 'three/addons/geometries/DecalGeometry.js';

export function mountStickers3D({
  scene,
  viewport,
  camera,
  container,
  toolbar,
  getMeshes,
  render,
  toast,
  getTextureSize,
  addTextureLayer,
  removeTextureLayer,
}) {
  const group = new THREE.Group();
  group.name = 'PNG stickers 3D';
  scene.add(group);
  const open = document.createElement('button');
  open.id = 'addPng3d';
  open.textContent = 'PNG 3D';
  toolbar.append(open);
  const root = document.createElement('details');
  root.className = 'stickers-3d';
  root.innerHTML = `<summary>PNG di permukaan 3D</summary><input id="stickerInput" type="file" accept="image/png" hidden><p id="stickerStatus" role="status" class="muted">Tambah PNG, lalu klik permukaan model.</p><button id="stickerPlace" disabled>Tempatkan PNG</button><button id="stickerMove" disabled>Pindahkan tattoo</button><div id="stickerList"></div><label>Ukuran<input id="stickerSize" type="range" min="1" max="80" value="20"></label><label>Rotasi<input id="stickerRotation" type="range" min="-180" max="180" value="0"></label><label>Opacity<input id="stickerOpacity" type="range" min="1" max="100" value="100"></label><button id="stickerBake" disabled>Sinkronkan ke tekstur</button><div class="viewer-button-row"><button id="stickerRemove" disabled>Hapus stiker</button><button id="stickerClear" disabled>Hapus semua</button></div><p class="muted">Klik atau tarik tattoo untuk memindahkan. Setelah penempatan, perubahan otomatis masuk ke layer UV pada kanvas 2D dan bisa disimpan ke YTD.</p>`;
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
    $('stickerList').replaceChildren();
    for (const item of items) {
      const b = document.createElement('button');
      b.textContent = item.name;
      b.classList.toggle('active', item === selected);
      b.onclick = () => {
        selected = item;
        $('stickerSize').value = item.size;
        $('stickerRotation').value = item.rotation;
        $('stickerOpacity').value = item.opacity;
        refresh();
      };
      $('stickerList').append(b);
    }
    $('stickerRemove').disabled = !selected;
    $('stickerBake').disabled = !selected;
    $('stickerMove').disabled = !selected;
    $('stickerClear').disabled = !items.length;
    $('stickerPlace').disabled = !asset;
  }
  function rebuild(item) {
    item.meshes.forEach((mesh) => {
      group.remove(mesh);
      mesh.geometry.dispose();
      mesh.material.dispose();
    });
    item.meshes = [];
    const box = new THREE.Box3();
    const targets = getMeshes().filter((m) => m.visible);
    targets.forEach((m) => {
      m.updateWorldMatrix(true, false);
      m.geometry.computeBoundingBox();
      box.union(m.geometry.boundingBox.clone().applyMatrix4(m.matrixWorld));
    });
    const width = (Math.max(box.getSize(new THREE.Vector3()).length(), 0.001) * item.size) / 100;
    const projector = new THREE.Object3D();
    projector.position.copy(item.point);
    projector.lookAt(item.point.clone().add(item.normal));
    projector.rotateZ(THREE.MathUtils.degToRad(item.rotation));
    const size = new THREE.Vector3(
      width,
      (width * item.asset.bitmap.height) / item.asset.bitmap.width,
      width * 0.4,
    );
    projector.updateMatrixWorld();
    item.projector = projector.matrixWorld.clone();
    item.projectorSize = size;
    for (const mesh of targets) {
      const geometry = new DecalGeometry(mesh, item.point, projector.rotation, size);
      if (!geometry.getAttribute('position').count) {
        geometry.dispose();
        continue;
      }
      const material = new THREE.MeshStandardMaterial({
        map: item.asset.map,
        transparent: true,
        opacity: item.opacity / 100,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -4,
        roughness: 0.8,
        alphaTest: 0.005,
      });
      const decal = new THREE.Mesh(geometry, material);
      decal.name = 'PNG 3D · ' + item.name;
      group.add(decal);
      item.meshes.push(decal);
    }
    render();
  }
  open.onclick = () => {
    if (!getMeshes().length) return toast('Buka model 3D terlebih dahulu.');
    root.open = true;
    $('stickerInput').click();
  };
  $('stickerInput').onchange = async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    const version = generation;
    let bitmap;
    try {
      if (file.size > 20 * 1024 * 1024) throw Error('PNG maksimal 20 MB.');
      bitmap = await createImageBitmap(file, { imageOrientation: 'flipY' });
      const pixels = bitmap.width * bitmap.height;
      if (pixels > 16777216 || assets.reduce((n, a) => n + a.pixels, 0) + pixels > 33554432)
        throw Error('Total gambar stiker maksimal 32 megapiksel; satu PNG maksimal 16 megapiksel.');
      if (version !== generation) {
        bitmap.close();
        return;
      }
      const map = new THREE.Texture(bitmap);
      map.colorSpace = THREE.SRGBColorSpace;
      map.needsUpdate = true;
      asset = { map, bitmap, pixels, name: file.name };
      assets.push(asset);
      bitmap = null;
      refresh();
      moving = false;
      arm(true);
      toast('Klik permukaan model 3D untuk menempelkan PNG.');
    } catch (e) {
      bitmap?.close();
      $('stickerStatus').textContent = e.message;
      toast(e.message);
    }
  };
  $('stickerPlace').onclick = () => {
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
    const normal = hit.face.normal
      .clone()
      .applyMatrix3(new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld))
      .normalize();
    item.side = normal.dot(ray.ray.direction) > 0 ? -1 : 1;
    if (item.side < 0) normal.negate();
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
      const source = document.createElement('canvas');
      source.width = item.asset.bitmap.width;
      source.height = item.asset.bitmap.height;
      const context = source.getContext('2d');
      context.translate(0, source.height);
      context.scale(1, -1);
      context.drawImage(item.asset.bitmap, 0, 0);
      const pixels = projectTexture(
        getMeshes(),
        item.projector,
        item.projectorSize,
        context.getImageData(0, 0, source.width, source.height),
        dimensions.w,
        dimensions.h,
        item.opacity / 100,
        item.side,
      );
      const layer = document.createElement('canvas');
      layer.width = dimensions.w;
      layer.height = dimensions.h;
      layer.getContext('2d').putImageData(new ImageData(pixels, layer.width, layer.height), 0, 0);
      item.binding = addTextureLayer(layer, item.name, item.binding);
      item.meshes.forEach((m) => (m.visible = false));
      $('stickerStatus').textContent = 'Tattoo tersinkron ke kanvas 2D · belum diekspor ke YTD';
      render();
      return true;
    } catch (error) {
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
        const local = hit.point.clone().applyMatrix4(selected.projector.clone().invert());
        const size = selected.projectorSize;
        if (
          Math.abs(local.x) > size.x / 2 ||
          Math.abs(local.y) > size.y / 2 ||
          Math.abs(local.z) > size.z / 2
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
        meshes: [],
      };
      locate(item, hit);
      if (!item.meshes.length) {
        toast('Stiker tidak mengenai permukaan.');
        return;
      }
      items.push(item);
      selected = item;
      refresh();
      arm(false);
      sync(item);
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
    if (event.type === 'pointercancel') {
      Object.assign(drag.item, { point: drag.point, normal: drag.normal, side: drag.side });
      rebuild(drag.item);
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
  ])
    $(id).oninput = () => {
      if (selected) {
        selected[key] = Number($(id).value);
        rebuild(selected);
      }
    };
  for (const id of ['stickerSize', 'stickerRotation', 'stickerOpacity'])
    $(id).onchange = () => selected && sync(selected);
  $('stickerBake').onclick = () => selected && sync(selected);
  $('stickerRemove').onclick = () => {
    if (!selected) return;
    if (selected.binding) removeTextureLayer(selected.binding);
    selected.meshes.forEach((m) => {
      group.remove(m);
      m.geometry.dispose();
      m.material.dispose();
    });
    items.splice(items.indexOf(selected), 1);
    selected = items.at(-1) || null;
    $('stickerStatus').textContent = items.length
      ? items.length + ' tattoo'
      : 'Belum ada tattoo. Tambah PNG untuk mulai.';
    refresh();
    render();
  };
  function clear() {
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
