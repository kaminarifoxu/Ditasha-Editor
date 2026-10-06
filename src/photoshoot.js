import * as THREE from 'three';

let studio;
export function mountPhotoshoot({ container, id, getSource, download, toast }) {
  const button = document.createElement('button');
  button.id = id;
  button.textContent = 'Photoshoot';
  button.title = 'Photoshoot · tiga sudut model';
  container.append(button);
  button.onclick = () => {
    const source = getSource();
    if (
      !source ||
      !source.objects.some((root) => {
        let found = false;
        root.traverseVisible((o) => {
          if (o.isMesh && o.visible) found = true;
        });
        return found;
      })
    )
      return toast('Buka model ped atau pakaian dan pasang teksturnya terlebih dahulu.');
    try {
      studio ||= createStudio(download, toast);
      studio.open(source);
    } catch (e) {
      toast('Photoshoot: ' + e.message);
    }
  };
}

function createStudio(download, toast) {
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    preserveDrawingBuffer: true,
  });
  const dialog = document.createElement('dialog');
  dialog.id = 'photoshootDialog';
  dialog.className = 'photoshoot-dialog';
  dialog.setAttribute('aria-labelledby', 'psHeading');
  dialog.innerHTML = `<div class="ps-header"><div><h2 id="psHeading">Photoshoot</h2><span id="psSource" class="muted"></span></div><button id="psClose" aria-label="Tutup Photoshoot">×</button></div>
    <div class="ps-layout"><aside class="ps-settings">
    <label>Susunan<select id="psPreset"><option value="ped">Ped · kiri / depan / kanan</option><option value="clothing">Pakaian · depan / belakang / depan</option></select></label>
    <label>Resolusi<select id="psSize"><option value="1920x1080">1920 × 1080</option><option value="2048x1152">2048 × 1152</option><option value="3000x2000">3000 × 2000</option></select></label>
    <label>Judul<input id="psTitle" maxlength="100" placeholder="Nama produk"></label>
    <label>Caption<input id="psCaption" maxlength="160" placeholder="Nama toko · Discord · keterangan"></label>
    <div class="ps-colors"><label>Background<input id="psColor" type="color" value="#eae6df"></label><label>Teks<input id="psTextColor" type="color" value="#252329"></label></div>
    <label class="check"><input id="psTransparent" type="checkbox">Background transparan</label>
    <div class="ps-assets"><button id="psBackground">Background</button><button id="psClearBackground" aria-label="Hapus background">×</button><button id="psLogo">Logo</button><button id="psClearLogo" aria-label="Hapus logo">×</button></div>
    <input id="psBackgroundInput" type="file" accept="image/png,image/jpeg,image/webp" hidden><input id="psLogoInput" type="file" accept="image/png,image/jpeg,image/webp" hidden>
    <label>Arah depan<select id="psFront"><option value="camera">Dari kamera preview</option><option value="z">+Z</option><option value="nz">−Z</option><option value="x">+X</option><option value="nx">−X</option></select></label>
    <label>Sudut tinggi<input id="psElevation" type="range" min="-40" max="40" value="0"></label>
    <label>Ukuran model<input id="psZoom" type="range" min="60" max="140" value="100"></label>
    <div id="psAngles"></div><button id="psReset">Reset sudut</button>
    <p class="muted">Tiga sudut dari model aktif, termasuk tekstur dan rambut. Ubah arah depan jika orientasi model berbeda.</p>
    </aside><section class="ps-output"><div class="ps-canvas-wrap"><canvas id="psCanvas" aria-label="Preview katalog tiga sudut"></canvas></div><div class="ps-footer"><p id="psStatus" role="status">Siap.</p><button id="psExport" class="primary">Simpan PNG</button></div></section></div>`;
  document.body.append(dialog);
  const $ = (id) => dialog.querySelector('#' + id);
  for (let i = 0; i < 3; i++) {
    const label = document.createElement('label');
    label.innerHTML = `Sudut ${i + 1}<input id="psAngle${i}" type="range" min="-180" max="180"><output id="psAngleValue${i}"></output>`;
    $('psAngles').append(label);
  }
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setPixelRatio(1);
  const scene = new THREE.Scene(),
    group = new THREE.Group();
  scene.add(group, new THREE.HemisphereLight(0xffffff, 0x8e91a1, 2.5));
  for (const [position, intensity] of [
    [[3, 5, 4], 3],
    [[-4, 2, -2], 1.5],
  ]) {
    const light = new THREE.DirectionalLight(0xffffff, intensity);
    light.position.set(...position);
    scene.add(light);
  }
  const camera = new THREE.PerspectiveCamera(35, 1, 0.001, 10000);
  let sourceCamera,
    sourceTarget,
    background = null,
    logo = null,
    pending = 0,
    busy = false;
  const materials = [];
  const versions = { background: 0, logo: 0 };
  function clear() {
    group.clear();
    materials.splice(0).forEach((m) => m.dispose());
  }
  function resetAngles() {
    const angles = $('psPreset').value === 'ped' ? [-28, 0, 28] : [-28, 180, 28];
    angles.forEach((angle, i) => {
      $('psAngle' + i).value = angle;
    });
    $('psElevation').value = 0;
    $('psZoom').value = 100;
  }
  function fitText(ctx, text, x, y, maxWidth, size, align = 'center') {
    ctx.textAlign = align;
    ctx.font = `600 ${size}px sans-serif`;
    while (ctx.measureText(text).width > maxWidth && size > 10)
      ctx.font = `600 ${--size}px sans-serif`;
    ctx.fillText(text, x, y);
  }
  function render() {
    if (!dialog.open) return;
    const canvas = $('psCanvas'),
      [width, height] = $('psSize').value.split('x').map(Number);
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!$('psTransparent').checked) {
      ctx.fillStyle = $('psColor').value;
      ctx.fillRect(0, 0, width, height);
      if (background) {
        const scale = Math.max(width / background.width, height / background.height);
        ctx.drawImage(
          background,
          (width - background.width * scale) / 2,
          (height - background.height * scale) / 2,
          background.width * scale,
          background.height * scale,
        );
      }
    }
    const box = new THREE.Box3();
    group.updateWorldMatrix(true, true);
    group.traverseVisible((o) => {
      if (o.isMesh) {
        o.geometry.computeBoundingBox();
        box.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld));
      }
    });
    if (box.isEmpty()) throw Error('Tidak ada mesh untuk difoto.');
    const center = box.getCenter(new THREE.Vector3());
    const radius = Math.max(box.getSize(new THREE.Vector3()).length() / 2, 0.001);
    const panelWidth = Math.floor(width * 0.31),
      panelHeight = Math.floor(height * 0.76),
      top = Math.floor(height * 0.14);
    renderer.setSize(panelWidth, panelHeight, false);
    camera.aspect = panelWidth / panelHeight;
    const up = sourceCamera.up.clone().normalize();
    let front = sourceCamera.position.clone().sub(sourceTarget);
    if ($('psFront').value !== 'camera') {
      const directions = { z: [0, 0, 1], nz: [0, 0, -1], x: [1, 0, 0], nx: [-1, 0, 0] };
      front.set(...directions[$('psFront').value]);
    }
    front.addScaledVector(up, -front.dot(up));
    if (front.lengthSq() < 0.000001) front.set(1, 0, 0).addScaledVector(up, -up.x);
    if (front.lengthSq() < 0.000001) front.set(0, 0, 1);
    front.normalize();
    const vertical = THREE.MathUtils.degToRad(camera.fov / 2);
    const limiting = Math.min(vertical, Math.atan(Math.tan(vertical) * camera.aspect));
    const distance = ((radius / Math.sin(limiting)) * 1.08) / (Number($('psZoom').value) / 100);
    camera.near = Math.max(0.00001, radius / 1000);
    camera.far = distance + radius * 100;
    camera.up.copy(up);
    camera.updateProjectionMatrix();
    for (let i = 0; i < 3; i++) {
      const angle = Number($('psAngle' + i).value),
        elevation = THREE.MathUtils.degToRad(Number($('psElevation').value));
      $('psAngleValue' + i).textContent = angle + '°';
      const direction = front
        .clone()
        .applyAxisAngle(up, THREE.MathUtils.degToRad(angle))
        .multiplyScalar(Math.cos(elevation))
        .addScaledVector(up, Math.sin(elevation));
      camera.position.copy(center).addScaledVector(direction, distance);
      camera.lookAt(center);
      renderer.setClearColor(0x000000, 0);
      renderer.render(scene, camera);
      ctx.drawImage(
        renderer.domElement,
        Math.round(width * (0.02 + i * 0.325)),
        top,
        panelWidth,
        panelHeight,
      );
    }
    ctx.fillStyle = $('psTextColor').value;
    fitText(
      ctx,
      $('psTitle').value,
      width / 2,
      height * 0.09,
      width * 0.62,
      Math.round(height * 0.05),
    );
    fitText(
      ctx,
      $('psCaption').value,
      width / 2,
      height * 0.965,
      width * 0.92,
      Math.round(height * 0.027),
    );
    if (logo) {
      const scale = Math.min((width * 0.13) / logo.width, (height * 0.1) / logo.height);
      ctx.drawImage(logo, width * 0.025, height * 0.02, logo.width * scale, logo.height * scale);
    }
    $('psStatus').textContent = width + ' × ' + height + ' · PNG';
  }
  function schedule() {
    clearTimeout(pending);
    pending = setTimeout(() => {
      try {
        render();
      } catch (e) {
        $('psStatus').textContent = e.message;
      }
    }, 20);
  }
  async function readImage(file) {
    if (!file || !/^image\/(png|jpeg|webp)$/.test(file.type))
      throw Error('Pilih PNG, JPG, atau WebP.');
    if (file.size > 20 * 1024 * 1024) throw Error('Gambar maksimal 20 MB.');
    const result = await createImageBitmap(file);
    if (result.width * result.height > 32 * 1024 * 1024) {
      result.close();
      throw Error('Gambar maksimal 32 megapiksel.');
    }
    return result;
  }
  for (const [kind, suffix] of [
    ['background', 'Background'],
    ['logo', 'Logo'],
  ]) {
    $('ps' + suffix).onclick = () => $('ps' + suffix + 'Input').click();
    $('ps' + suffix + 'Input').onchange = async (e) => {
      const file = e.target.files[0];
      e.target.value = '';
      if (!file) return;
      const version = ++versions[kind];
      try {
        const image = await readImage(file);
        if (version !== versions[kind]) {
          image.close();
          return;
        }
        if (kind === 'background') {
          background?.close();
          background = image;
          $('psTransparent').checked = false;
        } else {
          logo?.close();
          logo = image;
        }
        schedule();
      } catch (e) {
        $('psStatus').textContent = e.message;
      }
    };
    $('psClear' + suffix).onclick = () => {
      versions[kind]++;
      if (kind === 'background') {
        background?.close();
        background = null;
      } else {
        logo?.close();
        logo = null;
      }
      schedule();
    };
  }
  dialog
    .querySelectorAll('input:not([type=file]),select')
    .forEach((input) => input.addEventListener('input', schedule));
  $('psPreset').addEventListener('change', () => {
    resetAngles();
    schedule();
  });
  $('psReset').onclick = () => {
    resetAngles();
    schedule();
  };
  $('psClose').onclick = () => {
    if (!busy) dialog.close();
  };
  dialog.addEventListener('cancel', (e) => {
    if (busy) e.preventDefault();
  });
  dialog.addEventListener('close', () => {
    // A queued close event can arrive after this reusable dialog has reopened.
    if (dialog.open) return;
    clearTimeout(pending);
    clear();
  });
  $('psExport').onclick = async () => {
    if (busy) return;
    busy = true;
    $('psExport').disabled = true;
    try {
      render();
      const blob = await new Promise((resolve) => $('psCanvas').toBlob(resolve, 'image/png'));
      if (!blob) throw Error('PNG tidak dapat dibuat.');
      const saved = await download(blob, 'ditasha-photoshoot.png', 'image/png');
      $('psStatus').textContent = saved ? 'Photoshoot tersimpan.' : 'Simpan dibatalkan.';
      if (saved) toast('Photoshoot PNG tersimpan.');
    } catch (e) {
      $('psStatus').textContent = e.message;
    } finally {
      busy = false;
      $('psExport').disabled = false;
    }
  };
  return {
    open(source) {
      clear();
      sourceCamera = source.camera.clone();
      sourceTarget = source.target.clone();
      source.objects.forEach((root) => {
        root.updateWorldMatrix(true, true);
        const copy = root.clone(true);
        const guides = [];
        copy.traverse((o) => {
          if (o.isPoints || o.isLine) guides.push(o);
        });
        guides.forEach((o) => o.removeFromParent());
        root.matrixWorld.decompose(copy.position, copy.quaternion, copy.scale);
        copy.traverse((o) => {
          if (!o.isMesh) return;
          const clone = (material) => {
            const m = material.clone();
            m.wireframe = false;
            materials.push(m);
            return m;
          };
          o.material = Array.isArray(o.material) ? o.material.map(clone) : clone(o.material);
        });
        group.add(copy);
      });
      $('psSource').textContent = source.name || 'Model aktif';
      resetAngles();
      if (!dialog.open) dialog.showModal();
      render();
    },
  };
}
