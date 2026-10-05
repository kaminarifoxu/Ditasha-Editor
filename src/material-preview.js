import * as THREE from 'three';
import { hairTexturePixels } from './ped-attachments.js';

export function previewAlpha(settings, textured) {
  return {
    transparent: !!textured && settings.mode === 'blend',
    alphaTest: textured && settings.mode !== 'opaque' ? settings.cutoff : 0,
    depthWrite: !textured || settings.mode !== 'blend',
  };
}

// Preview settings and colour-keyed maps never modify editor pixels or export data.
export function mountMaterialPreview({ container, prefix, onChange }) {
  const root = document.createElement('details');
  root.className = 'material-preview';
  root.innerHTML = `<summary>Material ped · alis &amp; alpha</summary><label>Bagian model<select id="${prefix}MaterialPart"></select></label><label>Transparansi<select id="${prefix}MaterialMode"><option value="cutout">Cutout · alis / bulu mata</option><option value="blend">Blend · alpha lembut</option><option value="opaque">Opaque · tanpa alpha</option></select></label><label>Batas alpha · 0–1<input id="${prefix}MaterialCutoff" type="number" min="0" max="1" step="0.05" value="0.25"></label><label class="check"><input id="${prefix}MaterialBlack" type="checkbox">Hilangkan latar hitam pada bagian terpilih</label><button id="${prefix}MaterialReset">Reset material terpilih</button><p class="muted">Pilih bagian alis/bulu mata untuk mengatur terpisah. Cutout memakai alpha tekstur. Latar hitam tanpa alpha dapat dihilangkan secara opsional, tetapi warna hitam asli juga terhapus. Preview saja; tekstur dan ekspor tetap utuh.</p>`;
  const before = container.querySelector('.ped-attachments, .layerinspector');
  if (before) container.insertBefore(root, before);
  else container.append(root);
  const $ = (suffix) => root.querySelector('#' + prefix + 'Material' + suffix);
  let items = [],
    settings = new Map(),
    keyedMaps = new Set(),
    selectedKey = 'all';
  const defaults = () => ({ mode: 'cutout', cutoff: 0.25, removeBlack: false });
  function selected() {
    return $('Part').value === 'all' ? items : items.filter((item) => item.key === $('Part').value);
  }
  function refresh() {
    const value = selected()[0]?.settings || defaults();
    $('Mode').value = value.mode;
    $('Cutoff').value = value.cutoff;
    $('Black').checked = value.removeBlack;
    root.querySelectorAll('select,input,button').forEach((el) => (el.disabled = !items.length));
  }
  function releaseMaps() {
    for (const item of items) {
      if (keyedMaps.has(item.material.map)) item.material.map = item.source;
    }
    keyedMaps.forEach((map) => map.dispose());
    keyedMaps.clear();
  }
  function apply() {
    // The editor may supply a freshly composited texture before this call.
    for (const item of items)
      if (!keyedMaps.has(item.material.map)) item.source = item.material.map;
    releaseMaps();
    const cache = new Map();
    for (const item of items) {
      const { material, source, settings: value } = item;
      let map = source;
      if (source?.image && value.removeBlack) {
        map = cache.get(source);
        if (!map) {
          const image = source.image,
            canvas = document.createElement('canvas');
          canvas.width = image.width;
          canvas.height = image.height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(image, 0, 0);
          const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
          pixels.data.set(hairTexturePixels({ out: pixels.data }, true));
          ctx.putImageData(pixels, 0, 0);
          map = source.clone();
          map.source = new THREE.Source(canvas);
          map.needsUpdate = true;
          keyedMaps.add(map);
          cache.set(source, map);
        }
      }
      material.map = map;
      Object.assign(material, previewAlpha(value, !!map));
      material.needsUpdate = true;
    }
    onChange();
  }
  function change(update) {
    for (const item of selected()) Object.assign(item.settings, update);
    apply();
    refresh();
  }
  $('Part').onchange = () => {
    selectedKey = $('Part').value;
    refresh();
  };
  $('Mode').onchange = () => change({ mode: $('Mode').value });
  $('Cutoff').onchange = () => {
    const value = Number($('Cutoff').value);
    if ($('Cutoff').value === '' || !Number.isFinite(value) || value < 0 || value > 1) {
      refresh();
      return;
    }
    change({ cutoff: value });
  };
  $('Black').onchange = () => change({ removeBlack: $('Black').checked });
  $('Reset').onclick = () => change(defaults());
  function clear(reset = false) {
    releaseMaps();
    items = [];
    if (reset) {
      settings.clear();
      selectedKey = 'all';
    }
  }
  return {
    apply,
    clear(reset = true) {
      clear(reset);
      $('Part').replaceChildren();
      refresh();
    },
    setMeshes(meshes) {
      const target = selectedKey;
      clear();
      meshes.forEach((mesh, index) => {
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        materials.forEach((material, slot) => {
          const key = (mesh.name || 'Mesh ' + (index + 1)) + ' · ' + slot;
          if (!settings.has(key)) settings.set(key, defaults());
          items.push({ key, material, source: material.map, settings: settings.get(key) });
        });
      });
      const option = (value, name) => {
        const el = document.createElement('option');
        el.value = value;
        el.textContent = name;
        return el;
      };
      $('Part').replaceChildren(
        option('all', 'Semua bagian · ubah bersama'),
        ...items.map((item) => option(item.key, item.key)),
      );
      selectedKey = items.some((item) => item.key === target) ? target : 'all';
      $('Part').value = selectedKey;
      apply();
      refresh();
    },
  };
}
