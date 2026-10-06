import * as THREE from 'three';
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
  root.innerHTML = `<summary>PNG di permukaan 3D</summary><input id="stickerInput" type="file" accept="image/png" hidden><p id="stickerStatus" role="status" class="muted">Tambah PNG, lalu klik permukaan model.</p><button id="stickerPlace" disabled>Tempatkan PNG</button><div id="stickerList"></div><label>Ukuran<input id="stickerSize" type="range" min="1" max="80" value="20"></label><label>Rotasi<input id="stickerRotation" type="range" min="-180" max="180" value="0"></label><label>Opacity<input id="stickerOpacity" type="range" min="1" max="100" value="100"></label><div class="viewer-button-row"><button id="stickerRemove" disabled>Hapus stiker</button><button id="stickerClear" disabled>Hapus semua</button></div><p class="muted">Stiker 3D untuk preview, foto PNG, dan Photoshoot. Belum dibake ke YTD. Stiker dibersihkan saat ganti model/drawable.</p>`;
  container.append(root);
  const $ = (id) => root.querySelector('#' + id),
    assets = [],
    items = [];
  let asset = null,
    selected = null,
    armed = false,
    generation = 0;
  const ray = new THREE.Raycaster(),
    pointer = new THREE.Vector2();
  function arm(value) {
    armed = value;
    viewport.classList.toggle('placing-sticker', value);
    $('stickerPlace').setAttribute('aria-pressed', String(value));
    $('stickerStatus').textContent = value
      ? 'Klik permukaan model untuk menempatkan PNG. Esc untuk batal.'
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
      arm(true);
      toast('Klik permukaan model 3D untuk menempelkan PNG.');
    } catch (e) {
      bitmap?.close();
      $('stickerStatus').textContent = e.message;
      toast(e.message);
    }
  };
  $('stickerPlace').onclick = () => arm(!armed);
  viewport.addEventListener(
    'pointerdown',
    (event) => {
      if (!armed || event.button !== 0) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const rect = viewport.getBoundingClientRect();
      pointer.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        (-(event.clientY - rect.top) / rect.height) * 2 + 1,
      );
      camera.updateMatrixWorld();
      ray.setFromCamera(pointer, camera);
      const targets = getMeshes().filter((m) => m.visible);
      targets.forEach((m) => m.updateWorldMatrix(true, false));
      const hit = ray.intersectObjects(targets, false)[0];
      if (!hit) {
        $('stickerStatus').textContent = 'Klik bagian model yang terlihat.';
        return;
      }
      if (items.length >= 16) {
        toast('Maksimum 16 stiker 3D.');
        return;
      }
      const normal = hit.face.normal
        .clone()
        .applyMatrix3(new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld))
        .normalize();
      if (normal.dot(ray.ray.direction) > 0) normal.negate();
      const item = {
        asset,
        name: asset.name,
        point: hit.point.clone(),
        normal,
        size: Number($('stickerSize').value),
        rotation: Number($('stickerRotation').value),
        opacity: Number($('stickerOpacity').value),
        meshes: [],
      };
      rebuild(item);
      if (!item.meshes.length) {
        toast('Stiker tidak mengenai permukaan.');
        return;
      }
      items.push(item);
      selected = item;
      refresh();
      arm(false);
    },
    true,
  );
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
  $('stickerRemove').onclick = () => {
    if (!selected) return;
    selected.meshes.forEach((m) => {
      group.remove(m);
      m.geometry.dispose();
      m.material.dispose();
    });
    items.splice(items.indexOf(selected), 1);
    selected = items.at(-1) || null;
    refresh();
    render();
  };
  function clear() {
    generation++;
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
    refresh();
    render();
  }
  $('stickerClear').onclick = clear;
  refresh();
  return { group, clear };
}
