import { zipFiles } from './asset-tools.js';
export const slotNames = ['Left', 'Right', 'Front', 'Back', 'Top', 'Window'];
export function createSlots() {
  return slotNames.map((name, i) => ({
    name,
    enabled: false,
    x: (i % 3) / 3,
    y: Math.floor(i / 3) / 2,
    w: 1 / 3,
    h: 1 / 2,
    text: 'POLICE',
    pattern: 'stripe',
    color: '#173e91',
    accent: '#ffffff',
    px: 50,
    py: 50,
    scale: 80,
    rotation: 0,
    opacity: 100,
    image: null,
  }));
}
export function slotRect(slot, width, height) {
  if (
    ![slot.x, slot.y, slot.w, slot.h].every(Number.isFinite) ||
    slot.x < 0 ||
    slot.y < 0 ||
    slot.w <= 0 ||
    slot.h <= 0 ||
    slot.x + slot.w > 1.000001 ||
    slot.y + slot.h > 1.000001
  )
    throw Error('Area UV harus berada di dalam atlas (0–100%).');
  return { x: slot.x * width, y: slot.y * height, w: slot.w * width, h: slot.h * height };
}
export function drawSlot(canvas, slot) {
  const ctx = canvas.getContext('2d'),
    w = canvas.width,
    h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  ctx.save();
  ctx.globalAlpha = slot.opacity / 100;
  ctx.translate((w * slot.px) / 100, (h * slot.py) / 100);
  ctx.rotate((slot.rotation * Math.PI) / 180);
  const sw = (w * slot.scale) / 100,
    sh = (h * slot.scale) / 100;
  if (slot.image) {
    const ih = (sw * slot.image.height) / slot.image.width;
    ctx.drawImage(slot.image, -sw / 2, -ih / 2, sw, ih);
  } else {
    ctx.fillStyle = slot.color;
    if (slot.pattern === 'stripe') {
      ctx.beginPath();
      ctx.moveTo(-sw / 2, sh * 0.25);
      ctx.lineTo(sw / 2, -sh * 0.35);
      ctx.lineTo(sw / 2, -sh * 0.05);
      ctx.lineTo(-sw / 2, sh * 0.45);
      ctx.fill();
    } else if (slot.pattern === 'checker') {
      const size = sw / 16;
      for (let x = 0; x < 16; x++)
        for (let y = 0; y < 2; y++)
          if ((x + y) % 2 === 0) ctx.fillRect(-sw / 2 + x * size, sh * 0.22 + y * size, size, size);
    } else if (slot.pattern === 'chevron') {
      ctx.save();
      ctx.beginPath();
      ctx.rect(-sw / 2, -sh / 2, sw, sh);
      ctx.clip();
      ctx.lineWidth = sh * 0.13;
      for (let i = -2; i < 5; i++) {
        ctx.strokeStyle = i % 2 ? slot.accent : slot.color;
        ctx.beginPath();
        ctx.moveTo(-sw, -sh + i * sh * 0.28);
        ctx.lineTo(0, i * sh * 0.28);
        ctx.lineTo(sw, -sh + i * sh * 0.28);
        ctx.stroke();
      }
      ctx.restore();
    }
    if (slot.text) {
      ctx.font = `700 ${Math.max(12, sh * 0.18)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.strokeStyle = slot.accent;
      ctx.lineWidth = Math.max(2, sh * 0.012);
      ctx.lineJoin = 'round';
      ctx.strokeText(slot.text, 0, -sh * 0.12, sw * 0.9);
      ctx.fillText(slot.text, 0, -sh * 0.12, sw * 0.9);
    }
  }
  ctx.restore();
}
async function readPng(blob) {
  const header = new DataView(await blob.slice(0, 32).arrayBuffer());
  if (
    header.byteLength < 24 ||
    header.getUint32(0) !== 0x89504e47 ||
    header.getUint32(4) !== 0x0d0a1a0a ||
    header.getUint32(12) !== 0x49484452
  )
    throw Error('File harus PNG yang valid.');
  const w = header.getUint32(16),
    h = header.getUint32(20);
  if (!w || !h || w * h > 4194304 || w > 8192 || h > 8192) throw Error('PNG maksimum 4 megapixel.');
  return createImageBitmap(blob);
}
export function mountLivery({ toolbar, getTarget, applyLayer, download, toast }) {
  const button = document.createElement('button');
  button.id = 'openLivery';
  button.textContent = 'Livery studio';
  toolbar.append(button);
  const dialog = document.createElement('dialog');
  dialog.id = 'liveryDialog';
  dialog.className = 'studio-dialog livery-dialog';
  dialog.innerHTML = `<div class="studio-dialog-head"><div><span class="eyebrow">OFFLINE WORKSPACE</span><h2>Livery studio</h2></div><button id="lvClose" aria-label="Tutup livery">×</button></div>
  <div class="livery-layout"><aside><h3>Slot</h3><div id="lvSlots" class="livery-slots"></div><label>Resolusi PNG per slot<select id="lvResolution"><option>512</option><option selected>1024</option><option>2048</option></select></label><button id="lvImport">Impor PNG ke slot</button><input id="lvInput" type="file" accept="image/png" hidden><button id="lvRemoveImage">Gunakan pola manual</button><label>Pola<select id="lvPattern"><option value="stripe">Stripe</option><option value="checker">Checker</option><option value="chevron">Chevron</option><option value="text">Teks</option></select></label><label>Tulisan<input id="lvText" maxlength="60" value="POLICE"></label><div class="studio-fields"><label>Warna<input id="lvColor" type="color" value="#173e91"></label><label>Aksen<input id="lvAccent" type="color" value="#ffffff"></label></div><div id="lvTransforms" class="studio-fields"></div><button id="lvReset">Reset slot</button></aside>
  <section><div class="livery-tabs"><button id="lvSlotView" class="active">Desain slot</button><button id="lvAtlasView">Posisi di atlas UV</button></div><div class="livery-canvas"><canvas id="lvCanvas" width="1024" height="1024" aria-label="Preview livery; tarik desain untuk memindahkan"></canvas></div><p class="muted">Tarik desain untuk memindahkan. Slot adalah area persegi pada atlas, bukan deteksi panel kendaraan otomatis. Atur area UV sesuai template model sebelum menerapkan.</p><p id="lvStatus" role="status"></p></section>
  <aside><h3>Area slot pada atlas UV</h3><div id="lvUv" class="studio-fields"></div><label class="check"><input id="lvEnabled" type="checkbox"> Sertakan slot ini</label><p class="muted">Slot yang tumpang tindih dilukis sesuai urutan daftar. Gunakan PNG dengan alpha untuk livery tanpa kotak latar.</p><button id="lvApply" class="primary">Terapkan ke layer 2D & 3D</button><button id="lvZip">Ekspor slot PNG (ZIP)</button><button id="lvProjectSave">Simpan proyek livery</button><button id="lvProjectOpen">Buka proyek livery</button><input id="lvProjectInput" type="file" accept=".json" hidden><p class="muted">Perubahan studio disimpan dalam proyek JSON. Setelah diterapkan, ekspor YTD dari editor untuk membawa tekstur ke game. Tidak mengubah mesh atau rig kendaraan.</p></aside></div>`;
  document.body.append(dialog);
  const $ = (id) => dialog.querySelector('#' + id),
    canvas = $('lvCanvas');
  let slots = createSlots(),
    index = 0,
    target = null,
    binding = null,
    atlasView = false,
    busy = false,
    dirty = false;
  for (const [key, label, min, max] of [
    ['px', 'Posisi X', -100, 200],
    ['py', 'Posisi Y', -100, 200],
    ['scale', 'Ukuran %', 1, 300],
    ['rotation', 'Rotasi °', -180, 180],
    ['opacity', 'Opacity %', 0, 100],
  ]) {
    const l = document.createElement('label');
    l.textContent = label;
    const input = document.createElement('input');
    input.id = 'lv_' + key;
    input.type = 'number';
    input.min = min;
    input.max = max;
    input.oninput = () => {
      const v = Number(input.value);
      if (!Number.isFinite(v) || v < min || v > max) return;
      slots[index][key] = v;
      slots[index].enabled = true;
      refresh(false);
    };
    l.append(input);
    $('lvTransforms').append(l);
  }
  for (const [key, label] of [
    ['x', 'X %'],
    ['y', 'Y %'],
    ['w', 'Lebar %'],
    ['h', 'Tinggi %'],
  ]) {
    const l = document.createElement('label');
    l.textContent = label;
    const input = document.createElement('input');
    input.id = 'lv_uv_' + key;
    input.type = 'number';
    input.min = '0';
    input.max = '100';
    input.step = '.1';
    input.onchange = () => {
      const value = Number(input.value);
      if (!Number.isFinite(value)) return;
      const s = { ...slots[index], [key]: value / 100 };
      try {
        slotRect(s, 1, 1);
        slots[index] = s;
        refresh();
      } catch (e) {
        toast(e.message);
        refresh();
      }
    };
    l.append(input);
    $('lvUv').append(l);
  }
  dialog.addEventListener('input', () => (dirty = true));
  const surface = () => {
    const c = document.createElement('canvas');
    c.width = c.height = Number($('lvResolution').value);
    return c;
  };
  function paintAtlas() {
    if (!target) throw Error('Pilih tekstur atlas terlebih dahulu.');
    const c = document.createElement('canvas');
    c.width = target.w;
    c.height = target.h;
    const ctx = c.getContext('2d'),
      s = surface();
    for (const slot of slots)
      if (slot.enabled) {
        const r = slotRect(slot, c.width, c.height);
        drawSlot(s, slot);
        ctx.drawImage(s, r.x, r.y, r.w, r.h);
      }
    return c;
  }
  function refresh(fields = true) {
    const s = slots[index];
    $('lvSlots').replaceChildren();
    slots.forEach((slot, i) => {
      const b = document.createElement('button');
      b.classList.toggle('active', i === index);
      b.textContent = (slot.enabled ? '● ' : '○ ') + slot.name;
      b.onclick = () => {
        index = i;
        refresh();
      };
      $('lvSlots').append(b);
    });
    if (fields) {
      for (const key of ['px', 'py', 'scale', 'rotation', 'opacity']) $('lv_' + key).value = s[key];
      for (const key of ['x', 'y', 'w', 'h']) $('lv_uv_' + key).value = +(s[key] * 100).toFixed(2);
      $('lvText').value = s.text;
      $('lvPattern').value = s.pattern;
      $('lvColor').value = s.color;
      $('lvAccent').value = s.accent;
    }
    $('lvEnabled').checked = s.enabled;
    canvas.width = atlasView ? target?.w || 1024 : Number($('lvResolution').value);
    canvas.height = atlasView ? target?.h || 1024 : canvas.width;
    if (atlasView && target) {
      const ctx = canvas.getContext('2d');
      ctx.drawImage(target.canvas, 0, 0);
      ctx.drawImage(paintAtlas(), 0, 0);
      const r = slotRect(s, canvas.width, canvas.height);
      ctx.strokeStyle = '#ba9cff';
      ctx.lineWidth = Math.max(2, canvas.width / 300);
      ctx.strokeRect(r.x, r.y, r.w, r.h);
    } else drawSlot(canvas, s);
    $('lvStatus').textContent =
      s.name +
      ' · ' +
      slots.filter((s) => s.enabled).length +
      ' slot aktif' +
      (target ? ' · ' + target.name : ' · pilih tekstur untuk menerapkan');
  }
  function edit(id, key) {
    $(id).oninput = () => {
      slots[index][key] = $(id).value;
      slots[index].enabled = true;
      refresh(false);
    };
  }
  for (const [id, key] of [
    ['lvText', 'text'],
    ['lvPattern', 'pattern'],
    ['lvColor', 'color'],
    ['lvAccent', 'accent'],
  ])
    edit(id, key);
  $('lvEnabled').onchange = () => {
    slots[index].enabled = $('lvEnabled').checked;
    refresh(false);
  };
  $('lvResolution').onchange = () => refresh();
  $('lvSlotView').onclick = () => {
    atlasView = false;
    $('lvSlotView').classList.add('active');
    $('lvAtlasView').classList.remove('active');
    refresh();
  };
  $('lvAtlasView').onclick = () => {
    if (!target) return toast('Pilih tekstur atlas terlebih dahulu.');
    atlasView = true;
    $('lvSlotView').classList.remove('active');
    $('lvAtlasView').classList.add('active');
    refresh();
  };
  async function run(fn) {
    if (busy) return;
    busy = true;
    dialog.querySelectorAll('button,input,select').forEach((e) => (e.disabled = true));
    await new Promise((r) => setTimeout(r, 20));
    try {
      await fn();
    } catch (e) {
      toast(e.message);
      $('lvStatus').textContent = e.message;
    } finally {
      busy = false;
      dialog.querySelectorAll('button,input,select').forEach((e) => (e.disabled = false));
    }
  }
  $('lvImport').onclick = () => $('lvInput').click();
  $('lvInput').onchange = () =>
    run(async () => {
      const f = $('lvInput').files[0];
      $('lvInput').value = '';
      if (!f) return;
      if (f.size > 16 * 1024 * 1024) throw Error('PNG maksimum 16 MB.');
      const img = await readPng(f);
      if (img.width * img.height > 4194304) {
        img.close();
        throw Error('PNG maksimum 4 megapixel.');
      }
      slots[index].image?.close();
      slots[index].image = img;
      slots[index].enabled = true;
      dirty = true;
      refresh();
    });
  $('lvRemoveImage').onclick = () => {
    slots[index].image?.close();
    slots[index].image = null;
    dirty = true;
    refresh();
  };
  $('lvReset').onclick = () => {
    slots[index].image?.close();
    slots[index] = createSlots()[index];
    dirty = true;
    refresh();
  };
  $('lvApply').onclick = () =>
    run(async () => {
      if (!target || getTarget()?.identity !== target.identity)
        throw Error('Tekstur tujuan berubah. Tutup dan buka kembali studio.');
      if (!slots.some((s) => s.enabled)) throw Error('Aktifkan minimal satu slot.');
      binding = applyLayer(paintAtlas(), 'Livery studio', binding);
      dirty = false;
      $('lvStatus').textContent =
        'Layer livery diperbarui. Tutup studio untuk memeriksa 3D; simpan YTD dari editor.';
    });
  const png = async (c) => {
    const b = await new Promise((r) => c.toBlob(r, 'image/png'));
    if (!b) throw Error('PNG gagal dibuat.');
    return new Uint8Array(await b.arrayBuffer());
  };
  $('lvZip').onclick = () =>
    run(async () => {
      const out = [],
        c = surface();
      for (const s of slots)
        if (s.enabled) {
          drawSlot(c, s);
          out.push({ name: s.name + '.png', data: await png(c) });
          await new Promise((r) => setTimeout(r, 0));
        }
      if (!out.length) throw Error('Aktifkan minimal satu slot.');
      out.push({
        name: 'slot-mapping.json',
        data: JSON.stringify(
          {
            version: 1,
            atlas: target ? { w: target.w, h: target.h } : null,
            slots: slots.filter((s) => s.enabled).map(({ image, ...s }) => s),
          },
          null,
          2,
        ),
      });
      $('lvStatus').textContent = (await download(
        zipFiles(out),
        'ditasha-livery-slots.zip',
        'application/zip',
      ))
        ? 'ZIP tersimpan.'
        : 'Penyimpanan dibatalkan.';
    });
  $('lvProjectSave').onclick = () =>
    run(async () => {
      const c = surface(),
        data = [];
      for (const { image, ...s } of slots) {
        let png = null;
        if (image) {
          c.width = image.width;
          c.height = image.height;
          c.getContext('2d').clearRect(0, 0, c.width, c.height);
          c.getContext('2d').drawImage(image, 0, 0);
          png = c.toDataURL('image/png');
        }
        data.push({ ...s, png });
      }
      if (
        await download(
          JSON.stringify({ format: 'ditasha-livery', version: 1, slots: data }),
          'ditasha-livery.json',
          'application/json',
        )
      )
        dirty = false;
    });
  $('lvProjectOpen').onclick = () => $('lvProjectInput').click();
  $('lvProjectInput').onchange = () =>
    run(async () => {
      const f = $('lvProjectInput').files[0];
      $('lvProjectInput').value = '';
      if (!f) return;
      if (f.size > 40 * 1024 * 1024) throw Error('Proyek maksimum 40 MB.');
      const data = JSON.parse(await f.text());
      if (data.format !== 'ditasha-livery' || data.version !== 1 || data.slots?.length !== 6)
        throw Error('Proyek livery tidak valid.');
      const next = [];
      try {
        for (const [i, s] of data.slots.entries()) {
          slotRect(s, 1, 1);
          for (const [key, min, max] of [
            ['px', -100, 200],
            ['py', -100, 200],
            ['scale', 1, 300],
            ['rotation', -180, 180],
            ['opacity', 0, 100],
          ])
            if (!Number.isFinite(s[key]) || s[key] < min || s[key] > max)
              throw Error('Transform proyek tidak valid.');
          if (
            !/^#[a-f0-9]{6}$/i.test(s.color) ||
            !/^#[a-f0-9]{6}$/i.test(s.accent) ||
            !['stripe', 'checker', 'chevron', 'text'].includes(s.pattern) ||
            typeof s.text !== 'string' ||
            s.text.length > 60
          )
            throw Error('Desain proyek tidak valid.');
          if (typeof s.enabled !== 'boolean') throw Error('Status slot tidak valid.');
          const item = { ...createSlots()[i], ...s, name: slotNames[i], image: null };
          next.push(item);
          if (s.png) {
            if (!/^data:image\/png;base64,[a-z0-9+/=]+$/i.test(s.png))
              throw Error('Gambar proyek tidak valid.');
            item.image = await readPng(await (await fetch(s.png)).blob());
            if (item.image.width * item.image.height > 4194304)
              throw Error('Gambar proyek terlalu besar.');
          }
          delete item.png;
        }
      } catch (e) {
        next.forEach((s) => s.image?.close());
        throw e;
      }
      slots.forEach((s) => s.image?.close());
      slots = next;
      binding = null;
      dirty = false;
      refresh();
    });
  let drag = null;
  canvas.onpointerdown = (e) => {
    if (atlasView || busy || e.button !== 0) return;
    drag = { x: e.clientX, y: e.clientY, px: slots[index].px, py: slots[index].py };
    canvas.setPointerCapture(e.pointerId);
  };
  canvas.onpointermove = (e) => {
    if (!drag) return;
    const r = canvas.getBoundingClientRect();
    slots[index].px = Math.max(
      -100,
      Math.min(200, drag.px + ((e.clientX - drag.x) / r.width) * 100),
    );
    slots[index].py = Math.max(
      -100,
      Math.min(200, drag.py + ((e.clientY - drag.y) / r.height) * 100),
    );
    slots[index].enabled = true;
    dirty = true;
    refresh();
  };
  canvas.onpointerup = canvas.onpointercancel = () => (drag = null);
  button.onclick = () => {
    const next = getTarget(binding);
    if (next?.identity !== target?.identity) binding = null;
    target = next;
    refresh();
    dialog.showModal();
  };
  $('lvClose').onclick = () => dialog.close();
  return {
    button,
    unsavedItems: () =>
      dirty ? [{ name: 'Livery studio · desain belum diterapkan/disimpan' }] : [],
  };
}
