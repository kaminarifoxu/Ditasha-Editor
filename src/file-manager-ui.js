import { ICON_CODES } from './ui-icons.js';
import { setProject } from './project-context.js';
const categories = {
  images: 'Gambar',
  clothing: 'Pakaian',
  hair: 'Rambut',
  vehicles: 'Kendaraan',
  models: 'Model lain',
  textures: 'Tekstur lain',
  archives: 'Arsip',
  other: 'Lainnya',
};
const icon = (name) =>
  `<i class="di-icon" aria-hidden="true" data-icon="${name}" data-glyph="${String.fromCodePoint(parseInt(ICON_CODES[name], 16))}"></i>`;
const size = (bytes) =>
  bytes >= 1073741824
    ? (bytes / 1073741824).toFixed(2) + ' GB'
    : bytes >= 1048576
      ? (bytes / 1048576).toFixed(1) + ' MB'
      : Math.ceil(bytes / 1024).toLocaleString('id-ID') + ' KB';
export function mountFileManager({ nav, activate, toast, openFile }) {
  const button = document.createElement('button');
  button.dataset.page = 'files';
  button.innerHTML = icon('folder-open') + '<span class="nav-label">File Manager</span>';
  nav.append(button);
  const root = document.createElement('section');
  root.className = 'file-manager';
  root.hidden = true;
  root.setAttribute('aria-label', 'File Manager dan sorting aset');
  root.innerHTML = `<aside class="fm-sidebar"><span class="eyebrow">ASSET LIBRARY</span><h2>File Manager</h2><button id="fmChoose" class="primary">${icon('folder-open')} Buka folder</button><p id="fmRoot" class="muted">Pilih folder aset di komputer.</p><label>Kategori<select id="fmCategory" aria-label="Kategori aset"><option value="">Semua aset</option>${Object.entries(
    categories,
  )
    .map(([key, label]) => `<option value="${key}">${label}</option>`)
    .join(
      '',
    )}</select></label><label class="check"><input id="fmRecursive" type="checkbox" checked>Semua subfolder</label><div id="fmCounts" class="fm-counts"></div><div class="fm-note"><strong>Sorting aman</strong><p>Salin ke folder baru, pertahankan nama asli dan struktur sumber. Pasangan pakaian serta kendaraan dikelompokkan dari nama file.</p><p>Metadata tetap disertakan sebagai file asli. Hasil ini folder terorganisasi, belum menjadi resource siap ensure.</p></div></aside><section class="fm-browser"><div class="fm-heading"><div><span class="eyebrow">LOCAL FILES</span><h2 id="fmFolderName">Asetmu, lebih rapi.</h2></div><button id="fmRefresh" title="Pindai ulang folder" aria-label="Pindai ulang folder">${icon('refresh')}</button></div><div class="fm-toolbar"><button id="fmUp" title="Folder induk" aria-label="Folder induk">${icon('arrow-up')}</button><button id="fmHome" title="Folder sumber" aria-label="Folder sumber">${icon('folder')}</button><input id="fmSearch" type="search" placeholder="Cari nama atau path file…" aria-label="Cari file aset"></div><p id="fmBreadcrumb" class="muted fm-breadcrumb">Belum ada folder</p><div class="fm-list-head"><span>FILE / FOLDER</span><span>JENIS</span><span>UKURAN</span></div><div id="fmList" class="fm-list"><div class="fm-empty">${icon('folder-open')}<h3>Mulai dari folder asetmu</h3><p>PNG, pakaian, rambut, kendaraan, dan file pendukung dalam satu tempat.</p></div></div><div class="fm-pagination"><button id="fmPrevious" aria-label="Halaman sebelumnya">${icon('arrow-left')}</button><span id="fmPage">0 file</span><button id="fmNext" aria-label="Halaman berikutnya">${icon('arrow-right')}</button></div></section><aside class="fm-inspector"><div class="fm-inspector-head"><span class="eyebrow">DETAIL & PREVIEW</span><span>${icon('eye')}</span></div><div id="fmImage" class="fm-preview"><span>Pilih file untuk melihat detail.</span></div><h3 id="fmName">Belum ada file dipilih</h3><p id="fmDetails" class="muted"></p><p id="fmNote" class="muted"></p><div class="fm-open-actions"><button id="fmOpen">${icon('cube')} Buka di editor</button><button id="fmReveal">${icon('folder-open')} Lihat lokasi file</button></div><div class="fm-sort-actions"><span class="eyebrow">ORGANIZE</span><p id="fmScope">Sorting mengikuti folder, pencarian, dan kategori aktif.</p><button id="fmPlan" class="primary">${icon('layers')} Pratinjau sorting</button><button id="fmShowOutput" hidden>${icon('folder-open')} Buka hasil sorting</button></div></aside><section id="fmPlanPanel" class="fm-plan" hidden><div class="fm-heading"><div><span class="eyebrow">RENCANA SORTING</span><h2 id="fmPlanTitle"></h2></div><button id="fmPlanClose" aria-label="Tutup pratinjau">${icon('cross')}</button></div><p class="muted">Periksa tujuan salinan berikut. Nama file dan struktur folder sumber dipertahankan di dalam kategori. Jika lebih dari 100 file, contoh 100 file pertama ditampilkan.</p><div id="fmPlanCounts" class="fm-counts"></div><div id="fmPlanEntries" class="fm-plan-entries"></div><div class="fm-plan-footer"><span class="muted">Pilih folder output di luar sumber. Setiap proses membuat folder hasil baru.</span><button id="fmCopy" class="primary">${icon('copy')} Pilih output & salin</button></div></section><footer class="fm-status"><span id="fmStatus" role="status">Buka folder aset untuk memulai.</span><button id="fmCancel" hidden>Batalkan proses</button></footer>`;
  nav.after(root);
  const $ = (id) => root.querySelector('#' + id),
    api = () => window.ditashaFiles;
  let location = '',
    offset = 0,
    total = 0,
    matchingFiles = 0,
    picked = null,
    rootInfo = null,
    plan = null,
    busy = false,
    imageURL = null,
    serial = 0,
    searchTimer;
  const query = () => ({
    folder: location,
    search: $('fmSearch').value,
    category: $('fmCategory').value,
    recursive: $('fmRecursive').checked,
    offset,
  });
  function controls() {
    root.querySelectorAll('button,input,select').forEach((e) => {
      e.disabled = busy;
    });
    $('fmCancel').hidden = !busy;
    $('fmCancel').disabled = false;
    if (busy) return;
    for (const id of ['fmRefresh', 'fmHome', 'fmSearch', 'fmCategory', 'fmRecursive'])
      $(id).disabled = !rootInfo;
    $('fmUp').disabled = !location;
    $('fmPrevious').disabled = offset === 0;
    $('fmNext').disabled = offset + 100 >= total;
    $('fmPlan').disabled = !matchingFiles;
    $('fmOpen').disabled =
      !picked ||
      !/\.(png|jpe?g|webp|ytd|dds|ydd|ydr|yft|rpf|zip|oiv)$/i.test(picked.name) ||
      picked.size > 64 * 1024 * 1024;
    $('fmReveal').disabled = !picked;
    $('fmCopy').disabled = !plan;
  }
  async function run(task) {
    if (busy) return;
    busy = true;
    controls();
    try {
      await task();
    } catch (e) {
      $('fmStatus').textContent = e.message;
      toast(e.message);
    } finally {
      busy = false;
      controls();
    }
  }
  function forgetPlan() {
    plan = null;
    $('fmPlanPanel').hidden = true;
  }
  function clearPreview() {
    serial++;
    picked = null;
    if (imageURL) URL.revokeObjectURL(imageURL);
    imageURL = null;
    $('fmImage').textContent = 'Pilih file untuk melihat detail.';
    $('fmName').textContent = 'Belum ada file dipilih';
    $('fmDetails').textContent = $('fmNote').textContent = '';
  }
  function counts(container, values) {
    container.replaceChildren();
    for (const [key, count] of Object.entries(values)) {
      const tag = document.createElement('span');
      tag.textContent = `${categories[key]} · ${count.toLocaleString('id-ID')}`;
      container.append(tag);
    }
  }
  async function select(file, row) {
    if (busy) return;
    clearPreview();
    picked = file;
    root.querySelectorAll('.fm-row.selected').forEach((e) => e.classList.remove('selected'));
    row.classList.add('selected');
    $('fmName').textContent = file.name;
    $('fmDetails').textContent =
      `${categories[file.category]} · ${size(file.size)}\n${file.relative}\nTujuan: ${file.destination}`;
    $('fmNote').textContent = file.note || '';
    $('fmOpen').innerHTML =
      icon(/\.(ydd|ydr|yft)$/i.test(file.name) ? 'cube' : 'picture') +
      (/\.(ydd|ydr|yft)$/i.test(file.name)
        ? ' Buka preview 3D'
        : /\.(rpf|zip|oiv)$/i.test(file.name)
          ? ' Buka di GTA V Explorer'
          : ' Buka di Texture & Model');
    controls();
    const current = serial;
    if (/\.(png|jpe?g|webp|gif|bmp)$/i.test(file.name) && file.size <= 64 * 1024 * 1024) {
      $('fmImage').textContent = 'Memuat gambar…';
      try {
        const data = await api().read(file.id);
        if (current !== serial) return;
        const image = document.createElement('img');
        image.alt = file.name;
        imageURL = URL.createObjectURL(new Blob([data.data]));
        image.src = imageURL;
        image.onerror = () => {
          if (current === serial) $('fmImage').textContent = 'Gambar tidak dapat dipreview.';
        };
        $('fmImage').replaceChildren(image);
      } catch (e) {
        if (current === serial) $('fmImage').textContent = e.message;
      }
    } else $('fmImage').innerHTML = icon(/\.(ydd|ydr|yft)$/i.test(file.name) ? 'cube' : 'document');
  }
  async function list() {
    const data = await api().list(query());
    total = data.totalItems;
    matchingFiles = data.total;
    $('fmScope').textContent =
      `${matchingFiles.toLocaleString('id-ID')} file mengikuti filter aktif · ${$('fmRecursive').checked || $('fmSearch').value ? 'termasuk subfolder' : 'folder ini saja'}.`;
    clearPreview();
    $('fmList').replaceChildren();
    for (const folder of data.folders) {
      const row = document.createElement('button');
      row.className = 'fm-row fm-directory';
      const name = document.createElement('span');
      name.innerHTML = icon('folder');
      name.append(document.createTextNode(folder.name));
      row.append(name, document.createElement('span'), document.createElement('span'));
      row.onclick = () =>
        run(async () => {
          location = folder.relative;
          offset = 0;
          forgetPlan();
          await list();
        });
      $('fmList').append(row);
    }
    for (const file of data.files) {
      const row = document.createElement('button');
      row.className = 'fm-row';
      row.dataset.fileId = file.id;
      const name = document.createElement('span');
      name.innerHTML = icon(
        file.category === 'images'
          ? 'picture'
          : ['models', 'vehicles', 'clothing', 'hair'].includes(file.category)
            ? 'cube'
            : 'document',
      );
      const label = document.createElement('span');
      label.textContent = file.name;
      const relative = document.createElement('small');
      relative.textContent = file.relative;
      const title = document.createElement('span');
      title.append(label, relative);
      name.append(title);
      const category = document.createElement('span');
      category.textContent = categories[file.category];
      const bytes = document.createElement('span');
      bytes.textContent = size(file.size);
      row.append(name, category, bytes);
      row.title = file.relative;
      row.onclick = () => select(file, row);
      row.ondblclick = async () => {
        await select(file, row);
        $('fmOpen').click();
      };
      $('fmList').append(row);
    }
    if (!data.files.length && !data.folders.length) {
      const empty = document.createElement('p');
      empty.className = 'fm-empty';
      empty.textContent = 'Tidak ada file yang cocok.';
      $('fmList').append(empty);
    }
    $('fmPage').textContent =
      `${total ? offset + 1 : 0}–${Math.min(offset + 100, total)} / ${total.toLocaleString('id-ID')} entri · ${size(data.bytes)}`;
    $('fmBreadcrumb').textContent = rootInfo.name + (location ? ' / ' + location : '');
    $('fmFolderName').textContent = location.split('/').at(-1) || rootInfo.name;
    counts($('fmCounts'), data.counts);
    controls();
  }
  async function choose(refresh = false) {
    if (!api()) throw Error('File Manager tersedia di aplikasi desktop DITASHA Editor.');
    const result = await api().choose(refresh);
    if (!result) return;
    rootInfo = result.root;
    location = '';
    offset = 0;
    forgetPlan();
    $('fmRoot').textContent = rootInfo.path;
    $('fmStatus').textContent =
      `${rootInfo.count.toLocaleString('id-ID')} file · ${size(rootInfo.bytes)} · ${rootInfo.skipped} entri dilewati (tautan/tidak terbaca).`;
    setProject('files', rootInfo.name);
    await list();
  }
  $('fmChoose').onclick = () => run(() => choose());
  $('fmRefresh').onclick = () => run(() => choose(true));
  $('fmHome').onclick = () =>
    run(async () => {
      location = '';
      offset = 0;
      forgetPlan();
      await list();
    });
  $('fmUp').onclick = () =>
    run(async () => {
      location = location.split('/').slice(0, -1).join('/');
      offset = 0;
      forgetPlan();
      await list();
    });
  for (const id of ['fmCategory', 'fmRecursive'])
    $(id).onchange = () =>
      run(async () => {
        offset = 0;
        forgetPlan();
        await list();
      });
  $('fmSearch').oninput = () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(
      () =>
        run(async () => {
          offset = 0;
          forgetPlan();
          await list();
        }),
      200,
    );
  };
  $('fmPrevious').onclick = () =>
    run(async () => {
      offset -= 100;
      await list();
    });
  $('fmNext').onclick = () =>
    run(async () => {
      offset += 100;
      await list();
    });
  $('fmReveal').onclick = () => run(() => api().reveal(picked.id));
  $('fmShowOutput').onclick = () => run(() => api().reveal('output'));
  $('fmCancel').onclick = () =>
    api()
      ?.cancel()
      .catch((e) => toast(e.message));
  $('fmOpen').onclick = () =>
    run(async () => {
      const data = await api().read(picked.id),
        files = [new File([data.data], data.name)];
      if (data.companion) {
        try {
          const paired = await api().read(data.companion.id);
          files.push(new File([paired.data], paired.name));
        } catch (e) {
          toast('Tekstur pendamping: ' + e.message);
        }
      }
      await openFile(files);
    });
  $('fmPlan').onclick = () =>
    run(async () => {
      plan = await api().plan(query());
      $('fmPlanTitle').textContent =
        `${plan.count.toLocaleString('id-ID')} file · ${size(plan.bytes)}`;
      counts($('fmPlanCounts'), plan.counts);
      $('fmPlanEntries').replaceChildren();
      for (const item of plan.entries) {
        const row = document.createElement('div');
        const source = document.createElement('span');
        source.textContent = item.source;
        const target = document.createElement('strong');
        target.textContent = '→ ' + item.destination;
        row.append(source, target);
        if (item.note) {
          const note = document.createElement('small');
          note.textContent = item.note;
          row.append(note);
        }
        $('fmPlanEntries').append(row);
      }
      $('fmPlanPanel').hidden = false;
    });
  $('fmPlanClose').onclick = forgetPlan;
  $('fmCopy').onclick = () =>
    run(async () => {
      const result = await api().sort(plan.id);
      if (!result) {
        $('fmStatus').textContent = 'Pemilihan output dibatalkan. Rencana tetap tersedia.';
        return;
      }
      $('fmShowOutput').hidden = false;
      forgetPlan();
      $('fmStatus').textContent =
        `${result.cancelled ? 'Dibatalkan' : 'Selesai'} · ${result.copied} tersalin · ${result.failed} gagal · ${result.output}`;
    });
  api()?.subscribe((state) => {
    $('fmStatus').textContent = state.message;
  });
  controls();
  return { root };
}
