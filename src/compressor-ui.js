import { decodeResource } from './resource-client.js';
import { ICON_CODES } from './ui-icons.js';
import {
  COMPRESSOR_MAX_BYTES,
  COMPRESSOR_MAX_FILES,
  COMPRESSOR_YTD_BYTES,
  COMPRESSOR_SIZES,
  assetKind,
  textureCap,
  previewCompanions,
} from './compressor-plan.js';
const icon = (name) =>
  `<i class="di-icon" aria-hidden="true" data-icon="${name}" data-glyph="${String.fromCodePoint(parseInt(ICON_CODES[name], 16))}"></i>`;
const size = (n) =>
  n >= 1024 ** 3 ? (n / 1024 ** 3).toFixed(2) + ' GB' : (n / 1024 ** 2).toFixed(1) + ' MB';
const kinds = { mlo: 'MLO', vehicle: 'Kendaraan', clothing: 'Pakaian', ped: 'Ped' };
export function mountCompressor({ nav, activate, viewers, toast }) {
  const button = document.createElement('button');
  button.dataset.page = 'compressor';
  button.innerHTML = icon('compress') + '<span>Asset Compressor</span>';
  button.onclick = () => activate('compressor');
  nav.append(button);
  const root = document.createElement('section');
  root.className = 'compressor-workspace';
  root.hidden = true;
  root.innerHTML = `<header class="ac-header"><div><span class="eyebrow">BATCH TEXTURE OPTIMIZATION</span><h1>Asset Compressor</h1><p>MLO, kendaraan, pakaian & ped · hingga 25 GB / 50.000 file</p></div><div class="ac-actions"><button id="acAdd">${icon('plus')} File</button><button id="acFolder">${icon('folder')} Folder</button><button id="acClear" title="Kosongkan antrean">${icon('trash')}</button></div></header>
  <input id="acFiles" type="file" multiple hidden><input id="acFolders" type="file" webkitdirectory multiple hidden>
  <div class="ac-layout"><aside class="ac-files"><label>Jenis default untuk file baru<select id="acImportKind"><option value="vehicle">Kendaraan</option><option value="mlo">MLO</option><option value="clothing">Pakaian</option><option value="ped">Ped</option></select></label><p class="muted">Nama/folder yang dikenali dipilah otomatis. Jenis dan resolusi tiap YTD dapat diubah.</p><p id="acImportNotice" role="status"></p><input id="acSearch" placeholder="Cari file atau folder…" aria-label="Cari file kompresi"><select id="acFilter" aria-label="Filter jenis"><option value="all">Semua jenis</option><option value="mlo">MLO</option><option value="vehicle">Kendaraan</option><option value="clothing">Pakaian</option><option value="ped">Ped</option><option value="ytd">Hanya YTD</option></select><div id="acQueue"></div><div class="ac-pagination"><button id="acPrevious" aria-label="Halaman sebelumnya">←</button><span id="acPage"></span><button id="acNext" aria-label="Halaman berikutnya">→</button></div><p id="acCount" class="muted">Belum ada file</p></aside>
  <section class="ac-center"><div class="ac-preview-bar"><div><span class="eyebrow">SOURCE PREVIEW · 3D</span><strong id="acSelected">Pilih model YFT, YDD atau YDR</strong></div><button id="acPreviewTools">${icon('cube')} Kontrol model</button></div><div class="ac-variant"><label>Varian YTD<select id="acVariant" disabled><option>Otomatis</option></select></label></div><div class="ac-preview-host"></div><p class="ac-preview-note">Preview memakai file asli. Untuk MLO pilih YDR objek; penyusunan peta YMAP belum tersedia. Model preview maks. 64 MB, YTD maks. 256 MB.</p></section>
  <aside class="ac-settings"><span class="eyebrow">RESOLUSI MAKSIMUM</span><h2>Ukuran sesuai aset</h2><div id="acProfiles"></div><p class="muted">Rasio gambar dijaga, tanpa upscale. Tekstur yang sudah sesuai dipertahankan; alpha dipertahankan lewat DXT5.</p><details id="acFileSettings"><summary>Pengaturan file terpilih</summary><p id="acPath" class="muted"></p><label>Jenis<select id="acKind"></select></label><label>Resolusi khusus YTD<select id="acOverride"><option value="0">Ikuti profil jenis</option></select></label><label class="ac-check"><input id="acPreserve" type="checkbox"> Salin YTD asli tanpa optimasi</label><button id="acRemove">Hapus dari antrean</button></details><details><summary>Cakupan & batas</summary><p>Kompresi eksternal YTD Legacy, satu file per proses. YDD/YFT/YDR, tekstur tertanam, rig, YMAP, YTYP, YBN, metadata, skrip dan struktur folder disalin utuh. Bukan pengurangan polygon atau pengubah limit game.</p><p>YTD di atas 256 MB, format tak didukung, dan hasil yang tidak lebih kecil disalin asli dengan laporan. Kompresi DXT bersifat lossy. File sumber tidak ditimpa.</p></details><div class="ac-progress"><strong id="acSummary">Siap menerima file</strong><p id="acStatus" role="status">Tambahkan file/folder resource, lalu pilih folder hasil.</p><progress id="acProgress" aria-label="Progress kompresi" max="1" value="0"></progress><button id="acRun" class="primary" disabled>${icon('compress')} Compress ke folder baru</button><button id="acCancel" disabled>Hentikan setelah file aktif</button><button id="acReveal" disabled>${icon('folder-open')} Buka hasil & laporan</button></div></aside></div>`;
  nav.after(root);
  const $ = (id) => root.querySelector('#' + id),
    api = window.ditashaCompressor,
    host = root.querySelector('.ac-preview-host');
  let entries = [],
    selected = null,
    previewModel = null,
    offset = 0,
    busy = false,
    previewBusy = false,
    stop = false,
    lastJob = null,
    selectedVariant = '',
    doneBytes = 0,
    processedBytes = 0;
  const profiles = { mlo: 2048, vehicle: 2048, clothing: 1024, ped: 1024 };
  function options(select, inherit = false) {
    for (const n of COMPRESSOR_SIZES) {
      const o = document.createElement('option');
      o.value = n;
      o.textContent = n < 1024 ? n + ' px' : n / 1024 + 'K';
      select.append(o);
    }
    if (inherit) select.value = '0';
  }
  for (const [key, label] of Object.entries(kinds)) {
    const l = document.createElement('label');
    l.textContent = label;
    const s = document.createElement('select');
    s.id = 'acProfile-' + key;
    s.setAttribute('aria-label', 'Resolusi ' + label);
    options(s);
    s.value = profiles[key];
    s.onchange = () => {
      profiles[key] = Number(s.value);
      render();
    };
    l.append(s);
    $('acProfiles').append(l);
    const o = document.createElement('option');
    o.value = key;
    o.textContent = label;
    $('acKind').append(o);
  }
  options($('acOverride'), true);
  function status(text) {
    $('acStatus').textContent = text;
  }
  function render() {
    const query = $('acSearch').value.toLowerCase(),
      filter = $('acFilter').value;
    const filtered = entries.filter(
      (e) =>
        e.path.toLowerCase().includes(query) &&
        (filter === 'all' || (filter === 'ytd' && /\.ytd$/i.test(e.path)) || e.kind === filter),
    );
    offset = Math.max(
      0,
      Math.min(offset, Math.max(0, Math.floor((filtered.length - 1) / 80) * 80)),
    );
    $('acQueue').replaceChildren();
    for (const e of filtered.slice(offset, offset + 80)) {
      const row = document.createElement('div');
      row.className = 'ac-file';
      const b = document.createElement('button');
      b.classList.toggle('selected', selected === e);
      b.title = e.path;
      b.setAttribute('aria-pressed', String(selected === e));
      const name = document.createElement('strong');
      name.textContent = e.path.split('/').at(-1);
      const meta = document.createElement('small');
      meta.textContent =
        kinds[e.kind] +
        ' · ' +
        size(e.file.size) +
        (/\.ytd$/i.test(e.path) ? ' · ' + textureCap(e, profiles) + ' px' : ' · asli') +
        (e.result ? ' · ' + e.result : '');
      b.append(name, meta);
      b.onclick = () => {
        if (busy || previewBusy) return;
        selected = e;
        render();
        selectPreview(e);
      };
      row.append(b);
      $('acQueue').append(row);
    }
    $('acPage').textContent = filtered.length
      ? `${offset + 1}–${Math.min(offset + 80, filtered.length)} / ${filtered.length}`
      : '0 file';
    $('acPrevious').disabled = !offset;
    $('acNext').disabled = offset + 80 >= filtered.length;
    $('acCount').textContent =
      entries.length + ' file · ' + size(entries.reduce((n, e) => n + e.file.size, 0));
    $('acRun').disabled = !entries.length || busy || previewBusy || !api;
    $('acCancel').disabled = !busy || stop;
    for (const id of [
      'acAdd',
      'acFolder',
      'acClear',
      'acImportKind',
      'acKind',
      'acOverride',
      'acPreserve',
      'acRemove',
      ...Object.keys(kinds).map((k) => 'acProfile-' + k),
    ])
      $(id).disabled = busy;
    $('acFileSettings').hidden = !selected;
    if (selected) {
      $('acPath').textContent = selected.path;
      $('acKind').value = selected.kind;
      $('acOverride').value = selected.maxSize || 0;
      $('acOverride').disabled = busy || !/\.ytd$/i.test(selected.path) || !!selected.keepOriginal;
      $('acPreserve').checked = !!selected.keepOriginal;
      $('acPreserve').disabled = busy || !/\.ytd$/i.test(selected.path);
    }
    if (!api) status('Kompresi folder tersedia pada aplikasi desktop DITASHA.');
  }
  function add(files) {
    if (busy) return;
    let total = entries.reduce((n, e) => n + e.file.size, 0),
      skipped = 0;
    const known = new Map(entries.map((e) => [e.path.toLowerCase(), e.file])),
      pending = [];
    try {
      for (const file of files) {
        const path = file.webkitRelativePath || file.name,
          key = path.toLowerCase(),
          parts = path.split('/');
        if (
          parts.some(
            (p) => p.toLowerCase() === '.ditasha-compressor' || p.startsWith('DITASHA-compressed-'),
          )
        ) {
          skipped++;
          continue;
        }
        if (
          parts.some(
            (p) =>
              !p ||
              p === '..' ||
              p === '.' ||
              /[\x00-\x1f<>:"\\|?*]/.test(p) ||
              /[. ]$/.test(p) ||
              /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(p),
          )
        )
          throw Error('Path tidak aman: ' + path);
        const old = known.get(key);
        if (old) {
          if (old.size !== file.size || old.lastModified !== file.lastModified)
            throw Error('Path bertabrakan: ' + path);
          skipped++;
          continue;
        }
        if (
          entries.length + pending.length >= COMPRESSOR_MAX_FILES ||
          total + file.size > COMPRESSOR_MAX_BYTES
        )
          throw Error('Batch melebihi 25 GB / 50.000 file');
        known.set(key, file);
        total += file.size;
        pending.push({
          path,
          file,
          kind: assetKind(path, $('acImportKind').value),
          maxSize: 0,
          result: '',
        });
      }
      entries.push(...pending);
      render();
      $('acImportNotice').textContent = skipped
        ? skipped + ' duplikat/output lama tidak dimasukkan.'
        : '';
      status('File siap. Pilih model untuk preview 3D, atau mulai kompresi.');
    } catch (error) {
      $('acImportNotice').textContent =
        'Impor dibatalkan seluruhnya: ' +
        error.message +
        '. Tidak ada file dari pilihan ini yang ditambahkan.';
      status($('acImportNotice').textContent);
    }
  }

  async function selectPreview(e) {
    if (busy || previewBusy) return;
    let model = /\.(ydd|ydr|yft)$/i.test(e.path) ? e : null;
    if (!model && /\.ytd$/i.test(e.path))
      model = entries.find(
        (t) => /\.(ydd|ydr|yft)$/i.test(t.path) && previewCompanions(t, entries).includes(e),
      );
    if (!model) {
      status(
        'File ini disalin utuh. Pilih YFT/YDD/YDR untuk preview, atau YTD dengan model pasangan dalam folder yang sama.',
      );
      return;
    }
    if (model.file.size > 64 * 1024 ** 2) {
      status('Model melebihi batas preview 64 MB; tetap dapat disalin dalam batch.');
      return;
    }
    previewModel = model;
    const paired = previewCompanions(model, entries);
    $('acVariant').replaceChildren();
    const auto = document.createElement('option');
    auto.value = '';
    auto.textContent = 'Otomatis · ' + paired.length + ' YTD';
    $('acVariant').append(auto);
    paired.forEach((t, i) => {
      const o = document.createElement('option');
      o.value = String(i);
      o.textContent = t.path.split('/').at(-1);
      $('acVariant').append(o);
    });
    if (e !== model && paired.includes(e)) selectedVariant = String(paired.indexOf(e));
    else selectedVariant = '';
    $('acVariant').value = selectedVariant;
    $('acVariant').disabled = !paired.length;
    await loadPreview();
  }
  async function loadPreview() {
    if (!previewModel || busy || previewBusy) return;
    previewBusy = true;
    render();
    try {
      const paired = previewCompanions(previewModel, entries),
        textures =
          selectedVariant === ''
            ? paired.slice(0, 1)
            : paired.slice(Number(selectedVariant), Number(selectedVariant) + 1);
      $('acSelected').textContent = previewModel.path.split('/').at(-1);
      await viewers.openModels(
        [
          previewModel.file,
          ...textures.filter((t) => t.file.size <= COMPRESSOR_YTD_BYTES).map((t) => t.file),
        ],
        { page: 'compressor' },
      );
      status(
        'Preview sumber. Tambahkan YTD pasangan/varian bila tekstur belum ditemukan. Untuk YTD lintas folder gunakan Kontrol model → +Textures.',
      );
    } catch (e) {
      toast(e.message);
      status('Preview gagal: ' + e.message);
    } finally {
      previewBusy = false;
      render();
    }
  }
  $('acVariant').onchange = () => {
    selectedVariant = $('acVariant').value;
    loadPreview();
  };
  $('acPreviewTools').onclick = () => viewers.modelRoot.classList.toggle('compressor-tools-open');
  $('acAdd').onclick = () => $('acFiles').click();
  $('acFolder').onclick = () => $('acFolders').click();
  for (const id of ['acFiles', 'acFolders'])
    $(id).onchange = () => {
      add([...$(id).files]);
      $(id).value = '';
    };
  $('acClear').onclick = () => {
    if (busy) return;
    entries = [];
    selected = null;
    previewModel = null;
    offset = 0;
    $('acSelected').textContent = 'Antrean kosong · preview terakhir';
    render();
    status('Antrean dikosongkan; file sumber dan hasil tetap utuh.');
  };
  $('acSearch').oninput = $('acFilter').onchange = () => {
    offset = 0;
    render();
  };
  $('acPrevious').onclick = () => {
    offset -= 80;
    render();
  };
  $('acNext').onclick = () => {
    offset += 80;
    render();
  };
  $('acKind').onchange = () => {
    if (selected && !busy) {
      selected.kind = $('acKind').value;
      render();
    }
  };
  $('acOverride').onchange = () => {
    if (selected && !busy) {
      selected.maxSize = Number($('acOverride').value);
      render();
    }
  };
  $('acPreserve').onchange = () => {
    if (selected && !busy) {
      selected.keepOriginal = $('acPreserve').checked;
      render();
    }
  };
  $('acRemove').onclick = () => {
    if (selected && !busy && !previewBusy) {
      entries.splice(entries.indexOf(selected), 1);
      selected = null;
      render();
      status('File dikeluarkan dari antrean; sumber tetap utuh.');
    }
  };
  root.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
  });
  root.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    add([...e.dataTransfer.files]);
  });
  $('acCancel').onclick = () => {
    stop = true;
    status(
      'Menghentikan setelah file aktif. File yang belum diproses tercatat pending di laporan.',
    );
    render();
  };
  $('acReveal').onclick = () => api?.reveal(lastJob).catch((e) => toast(e.message));
  $('acRun').onclick = async () => {
    if (busy || previewBusy || !entries.length || !api) return;
    busy = true;
    stop = false;
    render();
    $('acProgress').value = 0;
    doneBytes = 0;
    processedBytes = 0;
    let job;
    try {
      job = await api.begin(entries.map(({ path, file }) => ({ path, file })));
      if (job.cancelled) {
        status('Pemilihan folder dibatalkan.');
        return;
      }
      lastJob = job.id;
      $('acReveal').disabled = false;
      entries.forEach((e) => (e.result = ''));
      let failures = 0,
        processed = 0,
        lastPaint = 0;
      for (let index = 0; index < entries.length && !stop; index++) {
        const e = entries[index];
        status(`Memproses ${index + 1}/${entries.length}: ${e.path}`);
        let bytes = null,
          metrics = null,
          reason = 'File pendamping disalin utuh';
        if (/\.ytd$/i.test(e.path)) {
          if (e.keepOriginal) reason = 'Asli dipertahankan sesuai pengaturan file';
          else if (e.file.size > COMPRESSOR_YTD_BYTES)
            reason = 'YTD di atas 256 MB: asli dipertahankan';
          else
            try {
              const result = await decodeResource('optimize-ytd', await e.file.arrayBuffer(), {
                maxSize: textureCap(e, profiles),
              });
              if (
                (result.changed || result.repacked) &&
                (result.bytes.length < e.file.size ||
                  result.allocation?.after < result.allocation?.before)
              ) {
                bytes = result.bytes;
                metrics = {
                  before: result.before,
                  after: result.after,
                  allocation: result.allocation,
                };
                reason =
                  'Resize/repack maksimal ' +
                  textureCap(e, profiles) +
                  ' px; alokasi GPU ' +
                  size(result.allocation.before) +
                  ' → ' +
                  size(result.allocation.after);
              } else reason = 'Sudah sesuai / hasil tidak lebih kecil: asli dipertahankan';
            } catch (error) {
              reason = 'Asli dipertahankan: ' + error.message;
            }
        }
        try {
          const out = await api.write({ id: job.id, index, bytes, reason, metrics });
          doneBytes += out.outputBytes;
          processedBytes += e.file.size;
          e.result = out.status === 'optimized' ? 'dioptimalkan' : 'asli';
        } catch (error) {
          e.result = 'gagal';
          failures++;
          toast(e.path + ': ' + error.message);
        }
        processed++;
        $('acProgress').value = processed / entries.length;
        $('acSummary').textContent =
          processed +
          '/' +
          entries.length +
          ' · ' +
          size(processedBytes) +
          ' → ' +
          size(doneBytes) +
          ' · ' +
          failures +
          ' gagal';
        if (Date.now() - lastPaint > 300 || processed === entries.length) {
          render();
          lastPaint = Date.now();
        }
        await new Promise((r) => setTimeout(r, 0));
      }
      const report = await api.finish({ id: job.id, cancelled: stop });
      status(
        `${report.status === 'cancelled' ? 'Dihentikan' : report.failed ? 'Selesai dengan file gagal' : 'Selesai'}. ${processed}/${entries.length} file · ${size(doneBytes)} hasil. Laporan: .ditasha-compressor/report.json. Folder: ${report.folder}`,
      );
    } catch (error) {
      status('Kompresi terhenti: ' + error.message);
      toast(error.message);
      if (job?.id)
        try {
          await api.finish({ id: job.id, cancelled: true });
        } catch {}
    } finally {
      busy = false;
      render();
    }
  };
  render();
  return {
    root,
    host,
    add,
    unsavedItems: () => (busy ? [{ name: 'Asset Compressor · batch sedang berjalan' }] : []),
  };
}
