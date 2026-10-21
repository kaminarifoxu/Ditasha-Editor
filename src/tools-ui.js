import { mountCompressor } from './compressor-ui.js';
import { mountCraft, craftWorkspaces } from './craft-ui.js';
import { ICON_CODES } from './ui-icons.js';
import { mountVehicleWorkspace } from './vehicle-ui.js';
import { mountViewers } from './viewers-ui.js';
import { mountArchives } from './archive-ui.js';
import { mountEmbeddedIDE } from './embedded-ide-ui.js';
import { mountHome } from './home-ui.js';
import { mountFileManager } from './file-manager-ui.js';
import { conversionModes, accepts, convertFile, picturesToYtd } from './converter.js';
import { zipFiles, MAX_EXPORT, safePath } from './asset-tools.js';
import {
  clothingInfo,
  importPath,
  analyzePack,
  buildPack,
  MAX_PACK_BYTES,
  MAX_PACK_FILE_BYTES,
  MAX_PACK_FILES,
} from './clothing-pack.js';
import { decodeResource } from './resource-client.js';
export function mountTools({
  download,
  toast,
  preview,
  confirmDiscard,
  onVehicleBuild,
  getSessionFiles,
  selectSessionFile,
}) {
  const $ = (id) => document.getElementById(id),
    editor = document.querySelector('main'),
    viewer = document.querySelector('.right'),
    home = viewer.parentElement;
  const nav = document.createElement('nav');
  nav.className = 'workspace-nav';
  nav.setAttribute('aria-label', 'Workspace tools');
  nav.innerHTML =
    '<button data-page="editor" class="active"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1.5"/><path d="m3 16 5-5 4 4 4-5 5 6"/></svg>Texture & Model</button><button data-page="converter"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7h17m-4-4 4 4-4 4M21 17H4m4-4-4 4 4 4"/></svg>Converter</button><button data-page="pack"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 3-5 3 3 5 2-1v11h8V10l2 1 3-5-5-3a4 4 0 0 1-8 0Z"/></svg>Clothing pack</button>';
  document.querySelector('header').after(nav);
  const root = document.createElement('section');
  root.className = 'tool-workspace';
  root.hidden = true;
  root.innerHTML = `
 <aside class="tool-sidebar"><span class="eyebrow" id="toolEyebrow"></span><h2 id="toolHeading"></h2>
 <div id="convertSettings"><label>Format tujuan<select id="conversionMode" hidden aria-hidden="true" tabindex="-1"></select></label><div id="conversionButtons" class="conversion-buttons" role="group" aria-label="Format konversi"></div><p id="conversionHint" class="muted"></p><label>Nama YTD<input id="dictionaryName" value="ditasha_textures"></label><p class="muted">YTD / DDS: tanpa kompresi, satu mipmap. GLB: mesh & UV saja; tanpa rig, animasi atau material GTA.</p></div>
 <details id="packSettings" hidden><summary>Pengaturan pack</summary><label>Nama resource<input id="packName" value="ditasha_clothing" maxlength="64"></label><label>Mode pack<select id="packMode"><option value="replace">Replacement clothing</option><option value="addon">Existing add-on collection</option></select></label><p class="muted" id="packHint">Nama file menentukan ped dan slot replacement.</p><label>Catatan build<textarea id="packNote" rows="3" placeholder="Apa yang berubah?"></textarea></label></details>
 <div class="tool-buttons"><button id="toolAdd">+ File</button><button id="toolFolder">Folder</button><button id="toolClear">Kosongkan</button></div><input id="toolFileInput" type="file" multiple hidden><input id="toolFolderInput" type="file" webkitdirectory multiple hidden>
 <input id="toolSearch" class="search" placeholder="Cari file…" aria-label="Cari file tools"><select id="packFilter" aria-label="Filter ped" hidden><option value="All">All</option><option>Male</option><option>Female</option><option>Unknown</option></select><div id="toolQueue"></div><p id="toolCount" class="muted"></p></aside>
 <section class="tool-center"><div id="toolEmpty" class="empty"><div class="empty-symbol"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m-4-4 4 4 4-4M4 15v5h16v-5"/></svg></div><span class="emptykicker">DITASHA WORKSHOP</span><h3 id="toolEmptyTitle">Drop files here</h3><p id="toolEmptyHelp"></p><button id="toolChoose" class="primary">Pilih file</button></div><div id="packViewer"></div><div id="convertResults" hidden><h2>Hasil konversi</h2><p class="muted">Pilih simpan untuk setiap hasil, atau simpan semuanya sebagai ZIP.</p><div id="outputFiles"></div></div></section>
 <aside class="tool-details"><span class="eyebrow">DETAILS</span><h2 id="toolDetailsHeading">Siap memulai</h2><p id="toolDetailsText" class="muted"></p><label id="packPathLabel" hidden>Path ekspor<input id="packPath"></label><button id="packPreview" hidden>Lihat model 3D</button><div id="packStats" class="pack-stats" hidden></div><details id="packFindings" open><summary>Hasil pemeriksaan</summary><ul id="toolFindings"></ul></details><p id="toolStatus" role="status"></p><progress id="toolProgress" hidden></progress><div class="tool-bottom"><button id="toolRun" class="primary" disabled>Convert</button><button id="saveAll" hidden>Simpan semua (ZIP)</button><p class="muted" id="toolSaved"></p></div></aside>`;
  nav.after(root);
  const optimize = document.createElement('details');
  optimize.open = false;
  optimize.innerHTML = `<summary>Optimasi tekstur otomatis</summary><label class="check"><input id="packOptimize" type="checkbox" checked>Optimalkan YTD saat build</label><label>Resolusi maksimum<select id="packMaxSize"><option value="512">512 px · hemat</option><option value="1024" selected>1K · seimbang</option><option value="2048">2K · detail</option><option value="4096">4K · tinggi</option></select></label><p class="muted">Auto DXT1 / DXT5 sesuai alpha, mipmap, tanpa memperbesar gambar. YTD yang sudah sesuai dipertahankan. File asli tetap utuh.</p><p class="muted">5.000 file · 512 MB per pack · 256 MB per file. Slot game tetap mengikuti collection/YMT; tidak membuat YMT baru.</p>`;
  $('packSettings').append(optimize);
  const slotFilter = document.createElement('select');
  slotFilter.id = 'packSlotFilter';
  slotFilter.hidden = true;
  slotFilter.setAttribute('aria-label', 'Filter jenis pakaian');
  for (const label of [
    'All',
    'Head',
    'Mask',
    'Hair',
    'Torso',
    'Legs',
    'Bag',
    'Shoes',
    'Accessories',
    'Undershirt',
    'Armor',
    'Decal',
    'Top',
    'Hat',
    'Glasses',
    'Ears',
    'Left wrist',
    'Right wrist',
    'Other',
  ]) {
    const option = document.createElement('option');
    option.value = label;
    option.textContent = label === 'All' ? 'Semua jenis pakaian' : label;
    slotFilter.append(option);
  }
  $('packFilter').after(slotFilter);
  for (const [id, title] of conversionModes) {
    const o = document.createElement('option');
    o.value = id;
    o.textContent = title;
    $('conversionMode').append(o);
    const button = document.createElement('button');
    button.dataset.conversionMode = id;
    button.title = title;
    const icon =
      id === 'glb' ? 'cube' : id === 'ytd' ? 'layers' : id === 'dds' ? 'document' : 'picture';
    button.innerHTML = `<i class="di-icon" aria-hidden="true" data-icon="${icon}" data-glyph="${String.fromCodePoint(parseInt(ICON_CODES[icon], 16))}"></i><span>${id.toUpperCase()}</span>`;
    button.onclick = () => {
      if (busy) return;
      $('conversionMode').value = id;
      $('conversionMode').dispatchEvent(new Event('change'));
    };
    $('conversionButtons').append(button);
  }
  let nativeRoot = null,
    nativeMode = '';
  const nativeHost = document.createElement('div');
  nativeHost.className = 'vehicle-native-host';
  let page = 'editor',
    queue = [],
    pack = [],
    outputs = [],
    selection = null,
    busy = false,
    revision = 0,
    savedRevision = 0,
    buildVersion = 1;
  let packOptimizationReport = [];
  const previewFiles = new WeakMap();
  const previewPanelState = new Map();
  const viewers = mountViewers({
    nav,
    download,
    toast,
    activate,
    confirmDiscard,
    getActivePage: () => page,
  });
  const archives = mountArchives({
    nav,
    download,
    toast,
    preview,
    confirmDiscard,
    activate,
    viewers,
  });
  const vehicles = mountVehicleWorkspace({ nav, viewers, onVehicleBuild });
  vehicles.root.append(nativeHost);
  const ide = mountEmbeddedIDE({ nav, toast, openQuickEditor: archives.openCode });
  const fileManager = mountFileManager({
    nav,
    activate,
    toast,
    openFile: async (files) => {
      const name = files[0].name;
      if (/\.(rpf|zip|oiv)$/i.test(name)) return archives.openFile(files[0]);
      if (/\.(ydd|ydr|yft)$/i.test(name)) {
        activate(/\.yft$/i.test(name) ? 'vehicles' : 'modelviewer');
        return viewers.openModels(files);
      }
      activate('editor');
      return preview(files);
    },
  });
  const craft = mountCraft({ nav, activate, toast, preview });
  const homepage = mountHome({ nav, activate, preview, getSessionFiles, selectSessionFile });
  const modelHome = viewers.modelRoot.parentElement;
  const compressor = mountCompressor({ nav, activate, viewers, toast });
  const dirty = () => pack.length && revision !== savedRevision;
  const touch = () => {
    revision++;
    packOptimizationReport = [];
    $('toolSaved').textContent = 'Perubahan pack belum diekspor.';
  };
  const mode = () => $('conversionMode').value;
  function activate(next) {
    if (busy) return;
    if (next === 'textureviewer') next = 'editor';
    if (nativeRoot) {
      nativeRoot.hidden = !(
        next === 'rig' ||
        (next === 'vehicles' && nativeMode && nativeMode !== 'ped')
      );
      vehicles.host.hidden = next === 'vehicles' && !nativeRoot.hidden;
    }
    if (next === 'code' && !window.ditashaIDE) {
      archives.openCode();
      return;
    }
    if (page !== next) selection = null;
    if (page === 'pack' && next !== 'pack') {
      for (const [panel, open] of previewPanelState) panel.open = open;
      previewPanelState.clear();
    }
    if (page !== 'pack' && next === 'pack') {
      viewer.querySelectorAll('.inspector details').forEach((panel) => {
        previewPanelState.set(panel, panel.open);
        panel.open = false;
      });
      $('packFindings').open = false;
    }
    if (next === 'converter') $('packFindings').open = true;
    page = next;
    compressor.root.hidden = next !== 'compressor';
    $('workspaceLabel').textContent =
      next === 'compressor'
        ? 'Asset Compressor'
        : next === 'files'
          ? 'File Manager'
          : next === 'rig'
            ? 'Auto rig ped'
            : next === 'home'
              ? 'Home'
              : next === 'editor'
                ? 'Texture & Model'
                : next === 'pack'
                  ? 'Clothing pack'
                  : next === 'archives'
                    ? 'GTA V Explorer'
                    : next === 'vehicles'
                      ? 'Vehicle workshop'
                      : next === 'textureviewer'
                        ? 'Texture viewer'
                        : next === 'modelviewer'
                          ? 'Model viewer'
                          : next === 'code'
                            ? 'Integrated IDE'
                            : 'Converter';
    craft.root.hidden = !next.startsWith('craft-');
    if (next.startsWith('craft-')) {
      $('workspaceLabel').textContent =
        craftWorkspaces.find((s) => 'craft-' + s[0] === next)?.[1] || 'Creative Studio';
      craft.activate(next);
    }
    ide.root.hidden = next !== 'code';
    fileManager.root.hidden = next !== 'files';
    homepage.root.hidden = next !== 'home';
    document.body.dataset.workspace = next;
    if (next === 'home') homepage.refresh();
    if (next === 'code') ide.activate();
    editor.hidden = next !== 'editor';
    root.hidden = !['converter', 'pack'].includes(next);
    archives.root.hidden = next !== 'archives';
    viewers.textureRoot.hidden = next !== 'textureviewer';
    vehicles.root.hidden = next !== 'vehicles';
    const vehicleMode = next === 'vehicles';
    const explorerMode = next === 'archives' && archives.previewVisible();
    (next === 'compressor'
      ? compressor.host
      : vehicleMode
        ? vehicles.host
        : explorerMode
          ? archives.previewHost
          : modelHome
    ).append(viewers.modelRoot);
    viewers.modelRoot.classList.toggle('explorer-embedded', explorerMode);
    viewers.modelRoot.classList.toggle('compressor-embedded', next === 'compressor');
    viewers.modelRoot.hidden =
      !explorerMode && !['modelviewer', 'vehicles', 'compressor'].includes(next);
    viewers.vehicleControls.hidden = !vehicleMode;
    viewers.modelRoot.querySelector('.tool-sidebar > h2').textContent = vehicleMode
      ? 'Kendaraan'
      : 'Model viewer';
    viewers.modelRoot
      .querySelectorAll('.ped-attachments, .material-preview')
      .forEach((e) => (e.hidden = vehicleMode));
    nav
      .querySelectorAll('button')
      .forEach((b) => b.classList.toggle('active', b.dataset.page === next));
    if (!['converter', 'pack'].includes(next)) {
      home.append(viewer);
      return;
    }
    const isPack = next === 'pack';
    $('convertSettings').hidden = isPack;
    $('packSettings').hidden = !isPack;
    $('packFilter').hidden = !isPack;
    slotFilter.hidden = !isPack;
    $('toolFolder').hidden = !isPack;
    $('toolEyebrow').textContent = isPack ? 'FIVEM RESOURCE' : 'BATCH CONVERTER';
    $('toolHeading').textContent = isPack ? 'Clothing pack' : 'Converter';
    $('toolEmptyTitle').textContent = isPack ? 'Drop clothing here' : 'Drop files here';
    $('toolEmptyHelp').textContent = isPack
      ? 'YDD + YTD. Add-on: sertakan YMT dan shop .meta. Import file atau folder resource.'
      : 'Tambahkan file untuk konversi lokal. Hasil dapat disimpan satu per satu atau sebagai ZIP.';
    $('toolRun').textContent = isPack ? 'Build pack ZIP' : 'Convert';
    $('toolSaved').hidden = !isPack;
    $('toolStatus').textContent = isPack
      ? 'Siap membangun pack.'
      : outputs.length
        ? 'Hasil siap disimpan.'
        : 'Tambahkan file untuk konversi.';
    $('toolFileInput').accept = isPack
      ? '.ydd,.ytd,.ymt,.yld,.meta'
      : mode() === 'glb'
        ? '.ydd,.ydr,.yft,.obj,.stl'
        : '.png,.jpg,.jpeg,.webp,.dds,.ytd';
    if (isPack) $('packViewer').append(viewer);
    else home.append(viewer);
    $('packViewer').hidden = !isPack;
    root.classList.toggle('is-pack', isPack);
    render();
  }
  nav.querySelectorAll('button').forEach((b) => (b.onclick = () => activate(b.dataset.page)));
  function findings(messages) {
    $('toolFindings').replaceChildren();
    for (const text of messages) {
      const li = document.createElement('li');
      li.textContent = text;
      $('toolFindings').append(li);
    }
  }
  function render() {
    if (page === 'editor') return;
    const isPack = page === 'pack',
      list = isPack ? pack : queue,
      q = $('toolSearch').value.toLowerCase();
    $('toolQueue').replaceChildren();
    const filtered = list.filter(
      (e) =>
        (e.path || e.file.name).toLowerCase().includes(q) &&
        (!isPack ||
          $('packFilter').value === 'All' ||
          clothingInfo(e.path).gender === $('packFilter').value) &&
        (!isPack || slotFilter.value === 'All' || clothingInfo(e.path).slot === slotFilter.value),
    );
    const groups = new Map();
    for (const e of filtered) {
      const group = isPack
        ? clothingInfo(e.path).gender + ' · ' + clothingInfo(e.path).slot
        : 'FILES';
      if (!groups.has(group)) groups.set(group, []);
      groups.get(group).push(e);
    }
    for (const [group, items] of groups) {
      const title = document.createElement('h3');
      title.className = 'queue-group';
      title.textContent = group + ' · ' + items.length;
      $('toolQueue').append(title);
      for (const e of items) {
        const row = document.createElement('div');
        row.className = 'tool-file';
        const b = document.createElement('button');
        const path = e.path || e.file.name;
        b.textContent = path;
        b.title = path;
        b.setAttribute('aria-pressed', String(e === selection));
        if (isPack) {
          const name = document.createElement('span');
          name.className = 'pack-file-name';
          name.textContent = path.split('/').at(-1).split('^').at(-1);
          const type = document.createElement('small');
          type.className = 'pack-file-type';
          type.textContent = path.split('.').at(-1).toUpperCase();
          b.replaceChildren(type, name);
          b.setAttribute('aria-label', path);
        }
        b.classList.toggle('selected', e === selection);
        b.onclick = () => {
          if (busy) return;
          selection = e;
          render();
          if (isPack && /\.ydd$/i.test(e.path)) previewSelection();
        };
        const del = document.createElement('button');
        del.textContent = '×';
        del.setAttribute('aria-label', 'Hapus ' + path);
        del.title = 'Hapus file';
        del.onclick = () => {
          if (busy) return;
          list.splice(list.indexOf(e), 1);
          if (isPack) touch();
          if (selection === e) selection = null;
          render();
        };
        row.append(b, del);
        $('toolQueue').append(row);
      }
    }
    $('toolCount').textContent =
      list.length +
      ' file · ' +
      (list.reduce((n, e) => n + (isPack ? e.data.length : e.file.size), 0) / 1048576).toFixed(1) +
      ' MB';
    $('toolEmpty').hidden = isPack || outputs.length > 0;
    $('convertResults').hidden = isPack || !outputs.length;
    $('saveAll').hidden = isPack || !outputs.length;
    $('packStats').hidden = !isPack;
    $('packPathLabel').hidden = !isPack || !selection;
    $('packPreview').hidden = true;
    $('toolDetailsHeading').textContent = selection
      ? (selection.path || selection.file.name).split('/').at(-1)
      : 'Siap memulai';
    $('toolDetailsText').textContent = selection
      ? isPack
        ? clothingInfo(selection.path).key
        : (selection.file.size / 1024).toFixed(0) + ' KB'
      : 'Pilih file untuk melihat detail.';
    if (isPack) {
      if (selection) $('packPath').value = selection.path;
      $('packPath').disabled = $('packMode').value === 'addon';
      const check = analyzePack(pack, $('packMode').value);
      $('packStats').replaceChildren();
      for (const [title, n] of [
        ['Models', check.models],
        ['Textures', check.textures],
        ['YMT', check.ymts],
        ['Shop meta', check.metas],
      ]) {
        const tile = document.createElement('div'),
          small = document.createElement('small'),
          strong = document.createElement('strong');
        small.textContent = title;
        strong.textContent = n;
        tile.append(small, strong);
        $('packStats').append(tile);
      }
      findings([
        ...check.errors,
        ...check.warnings,
        ...packOptimizationReport.filter((r) => r.warning).map((r) => r.path + ': ' + r.warning),
        ...check.slots.map(
          (s) =>
            s.key +
            ': ' +
            s.models +
            (s.component
              ? ' model (panduan 128 per tipe/collection; varian a–z)'
              : ' model prop (batas mengikuti versi game/client)'),
        ),
      ]);
      $('toolRun').disabled = busy || check.errors.length > 0 || !pack.length;
      $('packHint').textContent =
        $('packMode').value === 'addon'
          ? 'YMT dan shop .meta wajib. Collection ID dan nama file dipertahankan. Tidak membuat YMT baru.'
          : 'Nama file menentukan ped dan slot replacement. Prefix mp_m_freemode_01 / mp_f_freemode_01 wajib.';
    } else {
      findings(
        queue
          .filter((e) => !accepts(mode(), e.file.name))
          .map((e) => 'Input tidak sesuai: ' + e.file.name),
      );
      $('toolRun').disabled =
        busy || !queue.length || queue.some((e) => !accepts(mode(), e.file.name));
    }
  }
  function setBusy(value) {
    busy = value;
    root.querySelectorAll('input,select,textarea,button').forEach((e) => (e.disabled = value));
    nav.querySelectorAll('button').forEach((e) => (e.disabled = value));
    $('toolProgress').hidden = !value;
    if (!value) render();
  }
  async function add(files) {
    if (busy) return;
    setBusy(true);
    let skipped = 0;
    try {
      if (page === 'pack') {
        let total = pack.reduce((n, e) => n + e.data.length, 0);
        for (const file of files) {
          if (!/\.(ydd|ytd|ymt|yld|meta)$/i.test(file.name)) {
            skipped++;
            continue;
          }
          if (
            pack.length >= MAX_PACK_FILES ||
            file.size > MAX_PACK_FILE_BYTES ||
            total + file.size > MAX_PACK_BYTES - 1024 * 1024
          )
            throw Error('Pack maksimum 5.000 file / 512 MB, setiap file maksimum 256 MB.');
          const path = importPath(file.webkitRelativePath || file.name);
          if (pack.some((e) => e.path.toLowerCase() === path.toLowerCase()))
            throw Error('File duplikat: ' + path);
          const data = new Uint8Array(await file.arrayBuffer());
          if (
            /\.(ydd|ytd|yld)$/i.test(path) &&
            (data.length < 16 || new DataView(data.buffer).getUint32(0, true) !== 0x37435352)
          )
            throw Error('Resource RSC7 tidak valid: ' + path);
          if (/\.meta$/i.test(path)) {
            const xml = new DOMParser().parseFromString(
              new TextDecoder().decode(data),
              'application/xml',
            );
            if (
              xml.querySelector('parsererror') ||
              xml.documentElement.tagName !== 'ShopPedApparel'
            )
              throw Error('File harus shop apparel XML: ' + path);
          }
          pack.push({ path, data, file });
          total += data.length;
          touch();
        }
      } else
        for (const file of files) {
          if (file.size > 64 * 1024 * 1024) throw Error('File maksimum 64 MB.');
          if (
            queue.length >= 256 ||
            queue.reduce((n, e) => n + e.file.size, 0) + file.size > MAX_EXPORT
          )
            throw Error('Batch maksimum 256 file / 128 MB.');
          queue.push({ file });
        }
      if (skipped) toast(skipped + ' file non-clothing dilewati.');
      $('toolStatus').textContent = 'File ditambahkan.';
    } catch (e) {
      toast(e.message);
      $('toolStatus').textContent = e.message;
    } finally {
      setBusy(false);
    }
  }
  $('toolAdd').onclick = $('toolChoose').onclick = () => $('toolFileInput').click();
  $('toolFolder').onclick = () => $('toolFolderInput').click();
  for (const id of ['toolFileInput', 'toolFolderInput'])
    $(id).onchange = async (e) => {
      await add([...e.target.files]);
      e.target.value = '';
    };
  $('toolSearch').oninput = $('packFilter').onchange = slotFilter.onchange = render;
  $('conversionMode').onchange = () => {
    outputs = [];
    updateHint();
    activate('converter');
  };
  function updateHint() {
    $('conversionButtons')
      .querySelectorAll('button')
      .forEach((b) => {
        b.classList.toggle('active', b.dataset.conversionMode === mode());
        b.setAttribute('aria-pressed', String(b.dataset.conversionMode === mode()));
      });
    $('conversionHint').textContent = conversionModes.find((m) => m[0] === mode())[2];
    $('dictionaryName').parentElement.hidden = mode() !== 'ytd';
  }
  updateHint();
  $('toolClear').onclick = async () => {
    if (busy) return;
    if (page === 'pack') {
      if (
        dirty() &&
        (await confirmDiscard('pack', [{ name: 'Clothing pack · ' + $('packName').value }])) !==
          'discard'
      )
        return;
      pack = [];
      selection = null;
      touch();
    } else {
      queue = [];
      outputs = [];
      selection = null;
    }
    render();
  };
  for (const id of ['packName', 'packMode', 'packNote', 'packOptimize', 'packMaxSize'])
    $(id).oninput = () => {
      if (pack.length) touch();
      render();
    };
  $('packPath').onchange = () => {
    if (!selection || busy || $('packMode').value === 'addon') return;
    try {
      const path = safePath($('packPath').value);
      if (
        !path.startsWith('stream/') ||
        !path.toLowerCase().endsWith('.' + selection.file.name.split('.').at(-1).toLowerCase())
      )
        throw Error('Simpan asset ke stream/ dan pertahankan ekstensi.');
      selection.path = path;
      touch();
      render();
    } catch (e) {
      toast(e.message);
      render();
    }
  };
  async function previewSelection() {
    if (!selection || busy) return;
    const e = selection;
    setBusy(true);
    try {
      const paired = pack.find(
        (t) => /\.ytd$/i.test(t.path) && clothingInfo(t.path).key === clothingInfo(e.path).key,
      );
      await preview(
        [e, ...(paired ? [paired] : [])].map((t) => {
          const name = t.path.split('/').at(-1);
          let file = previewFiles.get(t);
          if (!file || file.name !== name) {
            file = new File([t.data], name);
            previewFiles.set(t, file);
          }
          return file;
        }),
        { reuse: true },
      );
    } catch (error) {
      toast('Preview gagal: ' + error.message);
    } finally {
      setBusy(false);
    }
  }
  $('packPreview').onclick = previewSelection;
  function renderOutputs() {
    $('outputFiles').replaceChildren();
    for (const out of outputs) {
      const row = document.createElement('div');
      row.className = 'output-file';
      const text = document.createElement('span');
      text.textContent = out.name + ' · ' + (out.data.length / 1024).toFixed(0) + ' KB';
      const b = document.createElement('button');
      b.textContent = 'Simpan';
      b.onclick = async () => {
        if (busy) return;
        setBusy(true);
        try {
          const saved = await download(
            out.data,
            out.name.split('/').at(-1),
            'application/octet-stream',
          );
          b.textContent = saved ? 'Tersimpan' : 'Simpan';
          $('toolStatus').textContent = saved ? 'File tersimpan.' : 'Simpan dibatalkan.';
        } catch (e) {
          toast(e.message);
        } finally {
          setBusy(false);
        }
      };
      row.append(text, b);
      $('outputFiles').append(row);
    }
  }
  $('toolRun').onclick = async () => {
    if (busy) return;
    setBusy(true);
    $('toolStatus').textContent = 'Memproses…';
    try {
      await new Promise((r) => setTimeout(r, 25));
      if (page === 'pack') {
        const entries = [];
        packOptimizationReport = [];
        const maxSize = Number($('packMaxSize').value),
          enabled = $('packOptimize').checked;
        for (const [index, entry] of pack.entries()) {
          $('toolStatus').textContent =
            'Menyiapkan ' + (index + 1) + '/' + pack.length + ' · ' + entry.path;
          if (enabled && /\.ytd$/i.test(entry.path)) {
            try {
              const result = await decodeResource('optimize-ytd', entry.data.slice().buffer, {
                maxSize,
              });
              entries.push({ ...entry, data: result.bytes });
              packOptimizationReport.push({
                path: entry.path,
                changed: result.changed,
                textureMemoryBefore: result.before,
                textureMemoryAfter: result.after,
                inputBytes: entry.data.length,
                outputBytes: result.bytes.length,
                textures: result.details,
              });
            } catch (error) {
              entries.push(entry);
              packOptimizationReport.push({
                path: entry.path,
                warning: 'File asli dipertahankan: ' + error.message,
              });
            }
          } else entries.push(entry);
        }
        const bytes = buildPack(entries, {
          name: $('packName').value,
          mode: $('packMode').value,
          note: $('packNote').value,
          version: buildVersion,
          optimization: packOptimizationReport,
        });
        const saved = await download(
          bytes,
          $('packName').value + '-v' + buildVersion + '.zip',
          'application/zip',
        );
        $('toolStatus').textContent = saved ? 'Build pack selesai.' : 'Penyimpanan dibatalkan.';
        if (saved) {
          savedRevision = revision;
          buildVersion++;
          $('toolSaved').textContent = 'Pack tersimpan.';
          const before = packOptimizationReport.reduce(
              (s, r) => s + (r.textureMemoryBefore || 0),
              0,
            ),
            after = packOptimizationReport.reduce((s, r) => s + (r.textureMemoryAfter || 0), 0);
          $('toolSaved').textContent += enabled
            ? ' Memori tekstur: ' +
              (before / 1048576).toFixed(1) +
              ' → ' +
              (after / 1048576).toFixed(1) +
              ' MB. ' +
              packOptimizationReport.filter((r) => r.warning).length +
              ' file memakai asli.'
            : ' Optimasi dimatikan.';
        } else $('toolSaved').textContent = 'Simpan dibatalkan; pack belum diekspor.';
      } else {
        outputs = [];
        if (mode() === 'ytd') {
          const name = $('dictionaryName').value;
          if (!/^[a-z0-9_-]{1,64}$/.test(name)) throw Error('Nama YTD: a–z, angka, _ atau -.');
          outputs = await picturesToYtd(
            queue.map((e) => e.file),
            name,
          );
        } else {
          let total = 0;
          for (let i = 0; i < queue.length; i++) {
            $('toolStatus').textContent = 'Konversi ' + (i + 1) + ' / ' + queue.length + '…';
            await new Promise((r) => setTimeout(r, 0));
            const converted = await convertFile(queue[i].file, mode());
            total += converted.reduce((n, e) => n + e.data.length, 0);
            if (total > MAX_EXPORT) throw Error('Hasil batch melebihi 128 MB.');
            outputs.push(...converted);
          }
        }
        renderOutputs();
        $('toolStatus').textContent = outputs.length + ' hasil siap disimpan.';
      }
    } catch (e) {
      $('toolStatus').textContent = e.message;
      toast(e.message);
      if (page === 'converter') {
        outputs = [];
        renderOutputs();
      }
    } finally {
      setBusy(false);
    }
  };
  $('saveAll').onclick = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const saved = await download(zipFiles(outputs), 'ditasha-converted.zip', 'application/zip');
      $('toolStatus').textContent = saved ? 'ZIP tersimpan.' : 'Simpan dibatalkan.';
    } catch (e) {
      toast(e.message);
    } finally {
      setBusy(false);
    }
  };
  document.addEventListener(
    'drop',
    (e) => {
      if (page !== 'converter' && page !== 'pack') return;
      e.preventDefault();
      e.stopImmediatePropagation();
      $('drop').classList.remove('drag');
      add([...e.dataTransfer.files]);
    },
    true,
  );
  activate('home');
  return {
    getVehicleSource: viewers.getVehicleSource,
    activate,
    attachNative: (element, mode) => {
      if (nativeRoot && nativeRoot !== element) nativeRoot.hidden = true;
      nativeRoot = element;
      nativeMode = mode;
      (mode === 'ped' || !mode ? document.body : nativeHost).append(element);
      element.classList.toggle('embedded-native', !!mode && mode !== 'ped');
      if (!mode) element.hidden = true;
    },
    unsavedItems: () => [
      ...(dirty() ? [{ name: 'Clothing pack · ' + $('packName').value }] : []),
      ...compressor.unsavedItems(),
      ...archives.unsavedItems(),
      ...viewers.unsavedItems(),
    ],
    isActive: () => page !== 'editor',
  };
}
