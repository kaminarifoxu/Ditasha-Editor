import { blendModes, alignLayer } from './editor.js';
import { decodeCanvasProject, serializeCanvas } from './canvas-project.js';
export function mountCanvasStudio({
  container,
  getTexture,
  remember,
  refresh,
  setMode,
  download,
  onOpen,
  markSaved,
  toast,
}) {
  const root = document.createElement('section');
  root.className = 'canvas-studio';
  root.innerHTML = `<div class="sectiontitle">CANVAS STUDIO</div><label>Blend mode<select id="csBlend">${blendModes.map((v, i) => `<option value="${v}">${i ? v : 'Normal'}</option>`).join('')}</select></label><div class="cs-button-row"><button id="csLock">Kunci layer</button><button id="csMaskHide">Mask · sembunyikan</button><button id="csMaskReveal">Mask · pulihkan</button><button id="csMaskClear">Hapus mask</button></div><div class="cs-align" role="group" aria-label="Alignment layer">${[
    ['left', 'Kiri'],
    ['center-x', 'Tengah X'],
    ['right', 'Kanan'],
    ['top', 'Atas'],
    ['center-y', 'Tengah Y'],
    ['bottom', 'Bawah'],
  ]
    .map(([k, v]) => `<button data-align="${k}">${v}</button>`)
    .join(
      '',
    )}</div><label class="check"><input id="csSnap" type="checkbox">Snap posisi · 8 px</label><label class="check"><input id="csAutoSelect" type="checkbox">Pilih layer lewat kanvas</label><div class="cs-button-row"><button id="csSave">Simpan proyek 2D</button><button id="csOpen">Buka proyek 2D</button></div><input id="csProjectInput" type="file" accept=".json,.ditasha" hidden><p id="csStatus" role="status" class="muted">Mask menyembunyikan piksel tanpa menghapus gambar sumber. Alt saat geser: lewati snap.</p>`;
  container.append(root);
  const $ = (id) => root.querySelector('#' + id),
    layer = () => {
      const t = getTexture();
      return t?.layers[t.selected];
    };
  function action(change) {
    const l = layer();
    if (!l || l.locked) return toast('Pilih layer yang tidak terkunci.');
    remember();
    change(l);
    refresh();
  }
  $('csBlend').onchange = () => action((l) => (l.blend = $('csBlend').value));
  $('csLock').onclick = () => {
    const l = layer();
    if (!l) return;
    remember();
    l.locked = !l.locked;
    refresh();
  };
  for (const mode of ['Hide', 'Reveal'])
    $('csMask' + mode).onclick = () => setMode(mode === 'Hide' ? 'mask-hide' : 'mask-reveal');
  $('csMaskClear').onclick = () => action((l) => (l.mask = null));
  root
    .querySelectorAll('[data-align]')
    .forEach(
      (b) =>
        (b.onclick = () =>
          action((l) =>
            Object.assign(l, alignLayer(l, getTexture().w, getTexture().h, b.dataset.align)),
          )),
    );
  $('csSave').onclick = async () => {
    const t = getTexture();
    if (!t) return;
    const revision = t.revision || 0;
    try {
      const data = serializeCanvas(t);
      if (new Blob([data]).size > 64 * 1024 * 1024) throw Error('Proyek canvas maksimum 64 MB.');
      if (await download(data, 'ditasha-canvas.json', 'application/json')) {
        markSaved(t, revision);
        $('csStatus').textContent = 'Proyek layer dan mask tersimpan.';
      }
    } catch (e) {
      toast(e.message);
    }
  };
  $('csOpen').onclick = () => $('csProjectInput').click();
  $('csProjectInput').onchange = async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      const project = await decodeCanvasProject(file);
      await onOpen(project);
      $('csStatus').textContent = 'Proyek dibuka pada tab baru.';
    } catch (e) {
      toast(e.message);
    }
  };
  function sync() {
    const l = layer();
    root
      .querySelectorAll('button,select')
      .forEach(
        (b) => (b.disabled = !l || (!!l.locked && !['csLock', 'csSave', 'csOpen'].includes(b.id))),
      );
    $('csOpen').disabled = false;
    $('csSave').disabled = !getTexture();
    $('csBlend').value = l?.blend || 'source-over';
    $('csLock').textContent = l?.locked ? 'Buka kunci' : 'Kunci layer';
    $('csMaskClear').disabled = !l?.mask || !!l?.locked;
  }
  sync();
  return {
    sync,
    root,
    snap: () => $('csSnap').checked,
    autoSelect: () => $('csAutoSelect').checked,
  };
}
