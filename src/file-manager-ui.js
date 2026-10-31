import { createFilePreview } from './file-preview.js';
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
  root.className = 'file-manager fm-modern';
  root.hidden = true;
  root.setAttribute('aria-label', 'File Manager dan sorting aset');
  root.innerHTML = `<header class="fm-top">
  <div class="fm-title"><span class="fm-app-icon">${icon('folder-open')}</span><div><span class="eyebrow">DITASHA FILES</span><h2>File Manager</h2></div></div>
  <div class="fm-top-actions"><button id="fmChoose" class="primary">${icon('folder-open')} Buka folder</button><button id="fmNative" title="Buka folder aktif di aplikasi Files Windows">${icon('folder-open')} Buka di Files</button><button id="fmGetFiles">${icon('download')} Dapatkan Files</button></div>
</header>
<aside class="fm-sidebar">
  <span class="eyebrow">QUICK ACCESS</span><div id="fmQuick" class="fm-quick"></div>
  <details class="fm-filters"><summary>Filter folder</summary><label>Kategori<select id="fmCategory" aria-label="Kategori aset"><option value="">Semua aset</option>${Object.entries(
    categories,
  )
    .map(([key, label]) => `<option value="${key}">${label}</option>`)
    .join(
      '',
    )}</select></label><label class="check"><input id="fmRecursive" type="checkbox" checked>Semua subfolder</label></details>
  <div class="fm-tree-head"><span class="eyebrow">FOLDERS</span><button id="fmNewTab" title="Tab folder baru" aria-label="Tab folder baru">${icon('plus')}</button></div><nav id="fmTree" class="fm-tree" aria-label="Navigasi folder"><p class="muted">Buka folder untuk mulai.</p></nav>
  <details class="fm-note"><summary>Tentang sorting & Files</summary><p>Sorting menyalin ke folder baru dengan nama asli. Pasangan pakaian dan kendaraan tetap dikelompokkan. Hasil belum menjadi resource siap ensure.</p><p>Browser ini dibuat untuk DITASHA dengan pola navigasi Files. Tombol Buka di Files menjalankan aplikasi Files Community asli dalam jendela Windows sendiri.</p><p id="fmNativeState" role="status">Memeriksa aplikasi Files…</p><p id="fmRoot">Pilih folder aset di komputer.</p></details>
</aside>
<section class="fm-browser">
  <div class="fm-tabbar"><div id="fmTabs" role="tablist" aria-label="Tab folder"></div><button id="fmRefresh" title="Pindai ulang folder" aria-label="Pindai ulang folder">${icon('refresh')}</button></div>
  <div class="fm-navigation"><div class="fm-nav-buttons"><button id="fmBack" title="Kembali" aria-label="Kembali">${icon('arrow-left')}</button><button id="fmForward" title="Maju" aria-label="Maju">${icon('arrow-right')}</button><button id="fmUp" title="Folder induk" aria-label="Folder induk">${icon('arrow-up')}</button><button id="fmHome" title="Folder sumber" aria-label="Folder sumber">${icon('folder')}</button></div><div id="fmPath" class="fm-path" aria-label="Path folder"></div><input id="fmSearch" type="search" placeholder="Cari aset…" aria-label="Cari file aset"></div>
  <div class="fm-heading"><div><span class="eyebrow">ASSET BROWSER</span><h2 id="fmFolderName">Semua aset, satu tempat.</h2><p id="fmBreadcrumb" class="muted fm-breadcrumb">Belum ada folder</p></div><span id="fmResultCount" class="badge">0</span></div>
  <div class="fm-commandbar"><label class="fm-sort-label">Urutkan<select id="fmOrder" aria-label="Urutkan file"><option value="name">Nama</option><option value="type">Jenis</option><option value="size">Ukuran</option><option value="modified">Diubah</option></select></label><button id="fmDescending" aria-label="Balik urutan" aria-pressed="false">${icon('arrow-down')}</button><div class="fm-view-buttons" role="group" aria-label="Tampilan file"><button id="fmListView" aria-pressed="true" title="Daftar" aria-label="Tampilan daftar">${icon('document')}</button><button id="fmGridView" aria-pressed="false" title="Grid" aria-label="Tampilan grid">${icon('layers')}</button></div><button id="fmToggleDetails" aria-pressed="true">${icon('eye')} Detail</button><button id="fmPlan" class="primary">${icon('layers')} Sorting aset</button></div>
  <div id="fmCounts" class="fm-counts"></div><div class="fm-list-head"><span>FILE / FOLDER</span><span>JENIS</span><span>UKURAN</span></div>
  <div id="fmList" class="fm-list" aria-label="File dan folder"><div class="fm-empty">${icon('folder-open')}<h3>Ruang untuk semua asetmu</h3><p>Buka folder, telusuri model dan tekstur, lalu atur hasil sorting.</p></div></div>
  <div class="fm-pagination"><button id="fmPrevious" aria-label="Halaman sebelumnya">${icon('arrow-left')}</button><span id="fmPage">0 file</span><button id="fmNext" aria-label="Halaman berikutnya">${icon('arrow-right')}</button></div>
</section>
<aside class="fm-inspector"><div class="fm-inspector-head"><span class="eyebrow">DETAIL & PREVIEW</span><button id="fmExpandPreview" type="button" aria-pressed="false" title="Perbesar atau kecilkan preview 3D">⛶ Perbesar 3D</button></div><div id="fmImage" class="fm-preview"><span>Pilih file untuk melihat detail.</span></div><section id="fmYtdPreview" class="fm-ytd-preview" hidden><div class="fm-ytd-heading"><strong>Preview tekstur YTD</strong><span id="fmYtdName"></span></div><div id="fmYtdCanvas" class="fm-ytd-canvas"></div></section><h3 id="fmName">Belum ada file dipilih</h3><p id="fmDetails" class="muted"></p><p id="fmNote" class="muted"></p><div class="fm-open-actions"><button id="fmOpen" class="primary">${icon('cube')} Buka di editor</button><button id="fmReveal">${icon('folder-open')} Lihat lokasi file</button></div><div id="fmCompanion" class="fm-companion" hidden></div><div class="fm-sort-actions"><span class="eyebrow">SORTING SCOPE</span><p id="fmScope">Sorting mengikuti folder, pencarian, dan kategori aktif.</p><button id="fmShowOutput" hidden>${icon('folder-open')} Buka hasil sorting</button></div></aside>
<section id="fmPlanPanel" class="fm-plan" hidden><div class="fm-heading"><div><span class="eyebrow">RENCANA SORTING</span><h2 id="fmPlanTitle"></h2></div><button id="fmPlanClose" aria-label="Tutup pratinjau">${icon('cross')}</button></div><p class="muted">Periksa tujuan salinan. Nama dan struktur sumber dipertahankan di dalam kategori. Maksimal 100 contoh file ditampilkan.</p><div id="fmPlanCounts" class="fm-counts"></div><div id="fmPlanEntries" class="fm-plan-entries"></div><div class="fm-plan-footer"><span class="muted">Pilih output di luar sumber. Setiap proses membuat folder hasil baru.</span><button id="fmCopy" class="primary">${icon('copy')} Pilih output & salin</button></div></section>
<footer class="fm-status"><span id="fmStatus" role="status">Buka folder aset untuk memulai.</span><button id="fmCancel" hidden>Batalkan proses</button></footer>
`;
  // Inspector has two stable columns in expanded mode: 3D on the left,
  // details and companion YTD on the right. Keep texture out of the 3D canvas.
  const inspector = root.querySelector('.fm-inspector');
  const meta = document.createElement('div');
  meta.className = 'fm-inspector-meta';
  for (const selector of ['#fmName','#fmDetails','#fmNote','.fm-open-actions','#fmYtdPreview','#fmCompanion','.fm-sort-actions']) {
    const item = inspector.querySelector(selector);
    if (item) meta.append(item);
  }
  inspector.append(meta);
  root.classList.add('fm-explorer');
  const side = root.querySelector('.fm-sidebar'),
    bar = root.querySelector('.fm-commandbar');
  const chooseButton = root.querySelector('#fmChoose');
  chooseButton.classList.remove('primary');
  bar.prepend(chooseButton);
  const filters = root.querySelector('.fm-filters');
  filters.querySelector('summary').textContent = 'Filter';
  filters.prepend(root.querySelector('#fmQuick'));
  filters.append(root.querySelector('#fmCategory').closest('label'));
  bar.append(filters);
  const more = document.createElement('details');
  more.className = 'fm-more-menu';
  more.innerHTML = '<summary aria-label="Opsi lain">•••</summary><div></div>';
  more
    .querySelector('div')
    .append(
      root.querySelector('#fmNative'),
      root.querySelector('#fmGetFiles'),
      root.querySelector('.fm-note'),
    );
  const smbButton = document.createElement('button');
  smbButton.type = 'button';
  smbButton.id = 'fmSmb';
  smbButton.textContent = 'Pengaturan SMB';
  smbButton.title = 'Buka folder jaringan Windows menggunakan \\\\server\\share';
  more.querySelector('div').prepend(smbButton);
  const modelOnlyButton=document.createElement('button');
  modelOnlyButton.id='fmModelOnly';modelOnlyButton.type='button';
  modelOnlyButton.textContent='3D saja: Aktif';
  bar.append(modelOnlyButton);
  bar.append(more);
  side.prepend(root.querySelector('.fm-tree-head'));
  side.querySelector('.fm-tree-head .eyebrow').textContent = 'Navigasi';
  side.querySelector(':scope > .eyebrow')?.remove();
  root.querySelector('#fmPlan').classList.remove('primary');
  root.querySelector('#fmPlan').title = 'Kelompokkan dan salin aset ke folder output';
  root.querySelector('#fmToggleDetails').innerHTML = icon('eye') + ' Panel preview';
  root.querySelector('.fm-inspector-head .eyebrow').textContent = 'Preview';
  more.querySelector('div').append(root.querySelector('#fmShowOutput'));
  root.querySelector('.fm-sort-actions').hidden = true;
  root.querySelector('#fmScope').setAttribute('aria-live', 'polite');
  nav.after(root);
  const $ = (id) => root.querySelector('#' + id),
    api = () => window.ditashaFiles;
  const settings=document.createElement('section');
  settings.className='fm-network-settings';settings.hidden=true;
  settings.innerHTML='<header><strong>Pengaturan SMB / Jaringan</strong><button type="button" data-close aria-label="Tutup">✕</button></header><label>Alamat folder jaringan (UNC)<input data-path type="text" spellcheck="false" placeholder="\\\\NAS\\Assets" /></label><p>Gunakan share yang sudah bisa diakses melalui Windows. Tidak menyimpan username atau password.</p><div class="fm-network-actions"><button type="button" data-save>Simpan alamat</button><button type="button" data-connect>Buka di File Manager</button></div><p data-feedback role="status"></p>';
  root.append(settings);
  const assetPreview = createFilePreview($('fmImage'));
  const ytdPreview = createFilePreview($('fmYtdCanvas'));
  let modelController = null;
  let activeTextureVariant = null;
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
  let orderBy = 'name',
    descending = false,
    view = 'list',
    detailsOpen = true,
    modelOnly = true;
  let history = [''],
    historyIndex = 0,
    tabSerial = 1;
  let tabs = [{ id: 1, folder: '' }],
    activeTab = tabs[0];
  let thumbnailGeneration = 0;
  const thumbnails = [];
  function clearThumbnails() {
    thumbnailGeneration++;
    thumbnails.splice(0).forEach((url) => URL.revokeObjectURL(url));
  }
  function saveTab() {
    Object.assign(activeTab, {
      folder: location,
      search: $('fmSearch').value,
      category: $('fmCategory').value,
      recursive: $('fmRecursive').checked,
      offset,
      orderBy,
      descending,
      history: [...history],
      historyIndex,
    });
  }
  function renderTabs() {
    $('fmTabs').replaceChildren();
    for (const tab of tabs) {
      const wrapper = document.createElement('div');
      wrapper.className = 'fm-tab' + (tab === activeTab ? ' active' : '');
      const button = document.createElement('button');
      button.setAttribute('role', 'tab');
      button.setAttribute('aria-selected', String(tab === activeTab));
      button.textContent = tab.folder.split('/').at(-1) || rootInfo?.name || 'Aset';
      button.onclick = () =>
        run(async () => {
          if (tab === activeTab) return;
          saveTab();
          activeTab = tab;
          location = tab.folder;
          offset = tab.offset || 0;
          $('fmSearch').value = tab.search || '';
          $('fmCategory').value = tab.category || '';
          $('fmRecursive').checked = tab.recursive ?? false;
          orderBy = tab.orderBy || 'name';
          descending = tab.descending || false;
          $('fmOrder').value = orderBy;
          history = [...(tab.history || [location])];
          historyIndex = tab.historyIndex || 0;
          forgetPlan();
          await list();
        });
      wrapper.append(button);
      if (tabs.length > 1) {
        const close = document.createElement('button');
        close.className = 'fm-tab-close';
        close.textContent = '×';
        close.setAttribute('aria-label', 'Tutup tab ' + button.textContent);
        close.onclick = () =>
          run(async () => {
            if (activeTab === tab) {
              activeTab = tabs.find((item) => item !== tab);
              location = activeTab.folder;
              offset = 0;
              $('fmSearch').value = activeTab.search || '';
              $('fmCategory').value = activeTab.category || '';
              $('fmRecursive').checked = activeTab.recursive ?? false;
              orderBy = activeTab.orderBy || 'name';
              descending = activeTab.descending || false;
              $('fmOrder').value = orderBy;
              history = [...(activeTab.history || [location])];
              historyIndex = activeTab.historyIndex || 0;
            }
            tabs = tabs.filter((item) => item !== tab);
            forgetPlan();
            await list();
          });
        wrapper.append(close);
      }
      $('fmTabs').append(wrapper);
    }
  }
  async function navigate(folder, remember = true) {
    location = folder;
    offset = 0;
    forgetPlan();
    if (remember && history[historyIndex] !== folder) {
      history = history.slice(0, historyIndex + 1);
      history.push(folder);
      historyIndex++;
    }
    await list();
  }
  function folderButton(label, folder) {
    const button = document.createElement('button');
    button.textContent = label;
    button.title = folder || rootInfo?.name || label;
    button.onclick = () => run(() => navigate(folder));
    return button;
  }
  function navigation(folders) {
    $('fmPath').replaceChildren();
    $('fmTree').replaceChildren();
    const parts = location ? location.split('/') : [];
    $('fmPath').append(folderButton(rootInfo.name, ''));
    $('fmTree').append(folderButton(rootInfo.name, ''));
    parts.forEach((name, i) => {
      const folder = parts.slice(0, i + 1).join('/');
      $('fmPath').append(document.createTextNode(' / '), folderButton(name, folder));
      const button = folderButton('↳ ' + name, folder);
      button.style.paddingLeft = 12 + Math.min(i, 5) * 10 + 'px';
      $('fmTree').append(button);
    });
    for (const folder of folders) {
      const button = folderButton('↳ ' + folder.name, folder.relative);
      button.style.paddingLeft = 16 + Math.min(parts.length, 5) * 10 + 'px';
      $('fmTree').append(button);
    }
  }
  for (const [key, label] of [['', 'Semua aset'], ...Object.entries(categories)]) {
    const button = document.createElement('button');
    button.dataset.category = key;
    button.innerHTML = icon(
      !key ? 'folder' : key === 'images' ? 'picture' : key === 'archives' ? 'file-zipper' : 'cube',
    );
    button.append(document.createTextNode(label));
    button.onclick = () => {
      $('fmCategory').value = key;
      $('fmCategory').dispatchEvent(new Event('change'));
    };
    $('fmQuick').append(button);
  }
  async function nativeState() {
    if (!api()?.filesApp) {
      $('fmNativeState').textContent = 'Tersedia pada aplikasi desktop Windows.';
      return;
    }
    const state = await api().filesApp({ action: 'status' });
    $('fmNativeState').textContent = state.available
      ? 'Files terpasang · membuka folder aktif di jendela Windows.'
      : state.supported
        ? 'Files belum terpasang. Unduh melalui situs resminya.'
        : 'Files asli memerlukan Windows.';
    $('fmGetFiles').hidden = state.available;
  }

  const query = () => ({
    folder: location,
    search: $('fmSearch').value,
    category: $('fmCategory').value,
    recursive: $('fmRecursive').checked,
    offset,
    orderBy,
    descending,
    modelOnly,
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
    for (const id of ['fmNative', 'fmOrder', 'fmDescending', 'fmNewTab'])
      $(id).disabled = !rootInfo;
    $('fmBack').disabled = !rootInfo || historyIndex === 0;
    $('fmForward').disabled = !rootInfo || historyIndex >= history.length - 1;
    $('fmDescending').setAttribute('aria-pressed', String(descending));
    $('fmQuick')
      .querySelectorAll('button')
      .forEach((b) => {
        b.disabled = !rootInfo;
        b.setAttribute('aria-pressed', String(b.dataset.category === $('fmCategory').value));
      });
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
    assetPreview.clear();
    ytdPreview.clear();
    modelController = null;
    activeTextureVariant = null;
    serial++;
    $('fmYtdPreview').hidden = true;
    $('fmYtdName').textContent = '';
    picked = null;
    if (imageURL) URL.revokeObjectURL(imageURL);
    imageURL = null;
    $('fmImage').textContent = 'Pilih file untuk melihat detail.';
    $('fmName').textContent = 'Belum ada file dipilih';
    $('fmDetails').textContent = $('fmNote').textContent = '';
    $('fmCompanion').hidden = true;
    $('fmCompanion').replaceChildren();
  }
  function counts(container, values) {
    container.replaceChildren();
    for (const [key, count] of Object.entries(values)) {
      const tag = document.createElement('span');
      tag.textContent = `${categories[key]} · ${count.toLocaleString('id-ID')}`;
      container.append(tag);
    }
  }
  async function select(file, row, restore = false) {
    if (busy && !restore) return;
    clearPreview();
    picked = file;
    root.querySelectorAll('.fm-row.selected').forEach((e) => e.classList.remove('selected'));
    row.classList.add('selected');
    $('fmName').textContent = file.name;
    $('fmDetails').textContent =
      `${categories[file.category]} · ${size(file.size)}\n${file.relative}\nTujuan: ${file.destination}`;
    $('fmNote').textContent = file.note || '';
    $('fmCompanion').hidden = true;
    $('fmCompanion').replaceChildren();
    if (/\.(ydd|ydr|yft)$/i.test(file.name)) {
      const current = serial;
      const grouped = file.textures || [];
      const presentTextures = textures => {
        if(current!==serial || !textures.length)return;
        const box=$('fmCompanion');
        const title=document.createElement('strong');
        title.textContent='Tekstur terkait · '+textures.length+' YTD';
        const buttons=document.createElement('div');buttons.className='fm-ytd-variants';
        const show=texture=>{
          if(current!==serial)return;
          $('fmYtdName').textContent=texture.name;
          activeTextureVariant = texture.id;
          if(modelController?.setTextureVariant)modelController.setTextureVariant(texture.id).catch(error=>{
            if(current===serial)$('fmNote').textContent='Gagal mengganti tekstur 3D: '+error.message;
          });
          $('fmYtdPreview').hidden=false;
          buttons.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.textureId===String(texture.id))));
          ytdPreview.show({id:texture.id,name:texture.name},api()).catch(error=>{
            if(current===serial)$('fmYtdCanvas').textContent='YTD gagal dimuat: '+error.message;
          });
        };
        for(const texture of textures){
          const button=document.createElement('button');
          button.type='button';button.dataset.textureId=texture.id;
          button.textContent=texture.name;button.title=texture.name;
          button.onclick=()=>show(texture);
          buttons.append(button);
        }
        box.replaceChildren(title,buttons);box.hidden=false;
        show(textures[0]);
      };
      if(grouped.length)presentTextures(grouped);
      else api().read(file.id).then(data=>{
        if(current!==serial || !data.companion)return;
        presentTextures([data.companion]);
      }).catch(()=>{});
    }
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
    } else if (/\.(ydd|ydr|yft|ytd|dds)$/i.test(file.name)) {
      const previewController = await assetPreview.show(file, api());
      if(current!==serial)return;
      modelController = previewController?.setTextureVariant ? previewController : null;
      if(activeTextureVariant && modelController)await modelController.setTextureVariant(activeTextureVariant);
    }
    else $('fmImage').innerHTML = icon('document');
  }
  async function list() {
    const previous = picked?.id;
    const data = await api().list(query());
    clearThumbnails();
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
          await navigate(folder.relative);
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
      if(file.textures?.length){const badge=document.createElement('small');badge.className='fm-ytd-count';badge.textContent=' · '+file.textures.length+' YTD';label.append(badge);}
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
      const modified = document.createElement('time');
      modified.textContent = new Date(file.modified).toLocaleDateString('id-ID');
      modified.title = new Date(file.modified).toLocaleString('id-ID');
      row.append(modified);
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
    $('fmResultCount').textContent = data.total.toLocaleString('id-ID') + ' file';
    navigation(data.navigationFolders || data.folders);
    activeTab.folder = location;
    saveTab();
    renderTabs();
    $('fmList').classList.toggle('fm-grid', view === 'grid');
    root.classList.toggle('fm-grid-mode', view === 'grid');
    controls();
    const previousFile = data.files.find((file) => file.id === previous);
    if (previousFile)
      await select(
        previousFile,
        [...$('fmList').querySelectorAll('[data-file-id]')].find(
          (row) => row.dataset.fileId === previous,
        ),
        true,
      );
    if (view === 'grid') loadThumbnails(data.files, thumbnailGeneration);
  }
  async function loadThumbnails(files, version) {
    // Images are cheap; YDD/YDR/YFT need the existing GTA decoder and WebGL renderer.
    const candidates = files.filter(f => /\.(png|jpe?g|webp|gif|bmp|ydd|ydr|yft)$/i.test(f.name) &&
      f.size <= 32 * 1024 * 1024).slice(0, 42);
    for (const file of candidates) {
      if (version !== thumbnailGeneration || view !== 'grid') return;
      const row = [...$('fmList').querySelectorAll('[data-file-id]')].find(r => r.dataset.fileId === file.id);
      if (!row) continue;
      try {
        let blob;
        if (/\.(ydd|ydr|yft)$/i.test(file.name)) {
          const host = document.createElement('div');
          host.className = 'fm-thumbnail-render-host';
          document.body.append(host);
          const preview = createFilePreview(host);
          try { blob = await preview.show(file, api(), {snapshot:true}); }
          finally { preview.clear(); host.remove(); }
        } else {
          const data = await api().read(file.id);
          const bitmap = await createImageBitmap(new Blob([data.data]), {resizeWidth:180,resizeQuality:'high'});
          const canvas = document.createElement('canvas');
          canvas.width = bitmap.width; canvas.height = bitmap.height;
          canvas.getContext('2d').drawImage(bitmap,0,0);
          bitmap.close();
          blob = await new Promise(resolve => canvas.toBlob(resolve,'image/png'));
          canvas.width = canvas.height = 1;
        }
        if (!blob || version !== thumbnailGeneration) return;
        const url = URL.createObjectURL(blob);
        thumbnails.push(url);
        const img = document.createElement('img');
        img.className = 'fm-thumbnail'; img.alt = 'Preview 3D '+file.name; img.src = url;
        row.querySelector('span').prepend(img);
      } catch {
        // Invalid or unsupported RSC assets retain the normal icon.
      }
    }
  }
  async function choose(refresh = false) {
    if (!api()) throw Error('File Manager tersedia di aplikasi desktop DITASHA Editor.');
    const result = await api().choose(refresh);
    if (!result) return;
    rootInfo = result.root;
    tabs = [{ id: ++tabSerial, folder: '' }];
    activeTab = tabs[0];
    history = [''];
    historyIndex = 0;
    location = '';
    offset = 0;
    forgetPlan();
    $('fmRoot').textContent = rootInfo.path;
    $('fmStatus').textContent =
      `${rootInfo.count.toLocaleString('id-ID')} file · ${size(rootInfo.bytes)} · ${rootInfo.skipped} entri dilewati (tautan/tidak terbaca).`;
    setProject('files', rootInfo.name);
    await list();
  }
  const smbInput=settings.querySelector('[data-path]');
  const smbFeedback=settings.querySelector('[data-feedback]');
  const loadSmb=async()=>{const stored=await api().networkSettings();smbInput.value=stored.networkPath||'';};
  $('fmSmb').onclick=()=>{
    more.open=false;settings.hidden=false;
    loadSmb().catch(e=>{smbFeedback.textContent=e.message;});
  };
  settings.querySelector('[data-close]').onclick=()=>{settings.hidden=true;};
  settings.querySelector('[data-save]').onclick=async()=>{
    try{await api().networkSettings({networkPath:smbInput.value.trim()});smbFeedback.textContent='Alamat SMB tersimpan permanen.';}
    catch(e){smbFeedback.textContent=e.message;}
  };
  settings.querySelector('[data-connect]').onclick=async()=>{
    try{
      const saved=await api().networkSettings({networkPath:smbInput.value.trim()});
      if(!saved.networkPath)throw Error('Isi alamat SMB terlebih dahulu.');
      settings.hidden=true;
      run(()=>choose({networkPath:saved.networkPath}));
    }catch(e){smbFeedback.textContent=e.message;}
  };
  $('fmModelOnly').onclick=()=>run(async()=>{
    modelOnly=!modelOnly;
    $('fmModelOnly').textContent='3D saja: '+(modelOnly?'Aktif':'Nonaktif');
    $('fmModelOnly').setAttribute('aria-pressed',String(modelOnly));
    offset=0;
    if(rootInfo)await list();
  });
  $('fmModelOnly').setAttribute('aria-pressed','true');
  $('fmChoose').onclick = () => run(() => choose());
  $('fmRefresh').onclick = () => run(() => choose(true));
  $('fmHome').onclick = () => run(() => navigate(''));
  $('fmUp').onclick = () => run(() => navigate(location.split('/').slice(0, -1).join('/')));
  $('fmBack').onclick = () =>
    run(async () => {
      historyIndex--;
      await navigate(history[historyIndex], false);
    });
  $('fmForward').onclick = () =>
    run(async () => {
      historyIndex++;
      await navigate(history[historyIndex], false);
    });
  $('fmNewTab').onclick = () =>
    run(async () => {
      if (tabs.length >= 10) return toast('Maksimum 10 tab folder.');
      saveTab();
      activeTab = { ...activeTab, id: ++tabSerial, history: [...history] };
      tabs.push(activeTab);
      forgetPlan();
      await list();
    });
  $('fmOrder').onchange = () =>
    run(async () => {
      orderBy = $('fmOrder').value;
      offset = 0;
      await list();
    });
  $('fmDescending').onclick = () =>
    run(async () => {
      descending = !descending;
      offset = 0;
      await list();
    });
  for (const [id, mode] of [
    ['fmListView', 'list'],
    ['fmGridView', 'grid'],
  ])
    $(id).onclick = () =>
      run(async () => {
        view = mode;
        $('fmListView').setAttribute('aria-pressed', String(view === 'list'));
        $('fmGridView').setAttribute('aria-pressed', String(view === 'grid'));
        if (rootInfo) await list();
        else {
          $('fmList').classList.toggle('fm-grid', view === 'grid');
          root.classList.toggle('fm-grid-mode', view === 'grid');
        }
      });
  $('fmToggleDetails').onclick = () => {
    detailsOpen = getComputedStyle(root.querySelector('.fm-inspector')).display === 'none';
    root.classList.toggle('fm-hide-details', !detailsOpen);
    root.classList.toggle('fm-details-requested', detailsOpen);
    $('fmToggleDetails').setAttribute('aria-pressed', String(detailsOpen));
  };
  $('fmNative').onclick = () =>
    run(async () => {
      await nativeState();
      await api().filesApp({ action: 'open', folder: location });
      $('fmStatus').textContent = 'Folder aktif dibuka di aplikasi Files Windows.';
    });
  $('fmGetFiles').onclick = () =>
    run(async () => {
      await api()?.filesApp({ action: 'download' });
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
  $('fmPlanPanel').addEventListener('keydown', (event) => { if (event.key === 'Escape') forgetPlan(); });
  root.addEventListener('keydown', (event) => { if (event.key === 'Escape') { forgetPlan(); root.classList.remove('fm-preview-expanded'); } });
  $('fmExpandPreview').onclick = () => {
    const enlarged = root.classList.toggle('fm-preview-expanded');
    $('fmExpandPreview').setAttribute('aria-pressed', String(enlarged));
    $('fmExpandPreview').textContent = enlarged ? '✕ Kecilkan preview' : '⛶ Perbesar 3D';
    window.dispatchEvent(new Event('resize'));
  };
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
  renderTabs();
  nativeState().catch((error) => {
    $('fmNativeState').textContent = error.message;
  });
  return { root };
}
