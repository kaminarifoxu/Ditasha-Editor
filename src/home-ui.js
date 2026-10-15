import { ICON_CODES } from './ui-icons.js';

const icon = (name) =>
  `<i class="di-icon" aria-hidden="true" data-icon="${name}" data-glyph="${String.fromCodePoint(parseInt(ICON_CODES[name], 16))}"></i>`;
const workspaces = [
  [
    'editor',
    'layers',
    'Texture & Model',
    'Edit tekstur, layer, dan tattoo dalam 2D atau 3D.',
    'YTD · YDD · YDR',
  ],
  [
    'archives',
    'folder',
    'GTA V Explorer',
    'Jelajahi arsip dengan preview model langsung di dalamnya.',
    'RPF · OIV · ZIP',
  ],
  [
    'vehicles',
    'cube',
    'Vehicle Workshop',
    'Atur material, livery, debadge, dan posisi strobo.',
    'VEHICLE TOOLS',
  ],
  [
    'code',
    'document',
    'Code Studio',
    'Buka workspace IDE lokal atau edit skrip dengan cepat.',
    'CODE - OSS',
  ],
  [
    'converter',
    'exchange',
    'Converter',
    'Konversi gambar, tekstur, dan model dalam satu proses.',
    'IMAGE · DDS · GLB',
  ],
  [
    'pack',
    'tshirt',
    'Clothing Pack',
    'Kelompokkan pakaian dan siapkan paket resource.',
    'FIVEM RESOURCE',
  ],
];

export function mountHome({
  nav,
  activate,
  preview,
  getSessionFiles = () => [],
  selectSessionFile,
}) {
  const button = document.createElement('button');
  button.dataset.page = 'home';
  button.id = 'openHome';
  button.innerHTML =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 10 9-7 9 7v10H3Z"/><path d="M9 20v-7h6v7"/></svg><span class="nav-label">Home</span>';
  nav.prepend(button);
  const root = document.createElement('section');
  root.className = 'home-workspace';
  root.hidden = true;
  root.setAttribute('aria-label', 'Homepage DITASHA Editor');
  root.innerHTML = `<div class="home-inner"><div class="home-heading"><span class="home-kicker"><span></span> YOUR LOCAL CREATIVE SPACE</span><span class="home-version"></span></div><section class="home-hero"><div class="home-hero-copy"><p class="home-overline">DITASHA / EDITOR</p><h1>Ruang untuk<br><em>karyamu.</em></h1><p class="home-description">Dari tekstur pertama sampai detail terakhir.<br>Semua alatmu, dalam satu workspace.</p><div class="home-hero-actions"><button class="primary" data-home="import">${icon('plus')}<span>Buka file</span></button><button data-home="resume">Masuk ke editor ${icon('arrow-right')}</button></div><small>Tarik file ke sini untuk mulai mengedit</small></div><div class="home-art" aria-hidden="true"><div class="home-art-orbit"></div><div class="home-art-orbit second"></div><div class="home-art-tile"><img src="assets/ditasha-emblem.webp" alt=""></div><span class="home-art-label">BUILT FOR YOUR NEXT IDEA</span></div></section><div class="home-section-heading"><div><span class="home-overline">PILIH WORKSPACE</span><h2>Mau buat apa hari ini?</h2></div><span>06 / TOOLS</span></div><div class="home-workspace-grid"></div><section class="home-session"><div class="home-section-heading"><div><span class="home-overline">SESI AKTIF</span><h2>Lanjutkan pekerjaanmu</h2></div><span data-home="session-count">0 FILE</span></div><div class="home-session-files"></div></section><footer class="home-footer"><span>© 2026 Ditasha-Workshop</span><span>Crafted by GANOMABI <span class="home-footer-dot">•</span> Offline workspace</span></footer></div>`;
  nav.after(root);
  for (const [page, symbol, title, description, format] of workspaces) {
    const card = document.createElement('button');
    card.className = 'home-workspace-card';
    card.dataset.homePage = page;
    card.innerHTML = `<span class="home-card-top"><span class="home-card-icon">${icon(symbol)}</span><span class="home-card-arrow">${icon('arrow-right')}</span></span><strong>${title}</strong><span class="home-card-description">${description}</span><span class="home-card-format">${format}</span>`;
    card.onclick = () => activate(page);
    root.querySelector('.home-workspace-grid').append(card);
  }
  function refresh() {
    const files = getSessionFiles();
    const list = root.querySelector('.home-session-files');
    root.querySelector('[data-home=session-count]').textContent = files.length + ' FILE';
    list.replaceChildren();
    if (!files.length) {
      const empty = document.createElement('div');
      empty.className = 'home-session-empty';
      empty.innerHTML = `${icon('folder-open')}<div><strong>Workspace masih kosong</strong><span>Buka file untuk memulai. File yang dimuat akan muncul di sini.</span></div><button>Jelajahi file ${icon('arrow-right')}</button>`;
      empty.querySelector('button').onclick = open;
      list.append(empty);
    }
    files.slice(0, 6).forEach((file, index) => {
      const row = document.createElement('button');
      row.className = 'home-session-file';
      const type = document.createElement('span');
      type.className = 'home-file-type';
      type.textContent = (file.ext || 'FILE').toUpperCase();
      const name = document.createElement('strong');
      name.textContent = file.name;
      name.title = file.name;
      const size = document.createElement('span');
      size.textContent = Math.ceil((file.size || 0) / 1024).toLocaleString('id-ID') + ' KB';
      row.append(type, name, size);
      row.onclick = () => {
        activate('editor');
        selectSessionFile?.(index);
      };
      list.append(row);
    });
    root.querySelector('[data-home=resume]').innerHTML =
      (files.length ? 'Lanjutkan edit ' : 'Masuk ke editor ') + icon('arrow-right');
    root.querySelector('.home-version').textContent =
      document.getElementById('appVersion')?.textContent || '';
  }
  function open() {
    activate('editor');
    document.getElementById('open').click();
  }
  root.querySelector('[data-home=import]').onclick = open;
  root.querySelector('[data-home=resume]').onclick = () => activate('editor');
  root.addEventListener('dragover', (event) => {
    event.preventDefault();
    root.classList.add('home-drag');
  });
  root.addEventListener('dragleave', (event) => {
    if (!root.contains(event.relatedTarget)) root.classList.remove('home-drag');
  });
  document.addEventListener(
    'drop',
    (event) => {
      if (root.hidden) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      root.classList.remove('home-drag');
      if (!event.dataTransfer.files.length) return;
      activate('editor');
      preview(event.dataTransfer.files);
    },
    true,
  );
  new MutationObserver(() => {
    if (!root.hidden) refresh();
  }).observe(document.getElementById('fileList'), { childList: true });
  new MutationObserver(() => {
    if (!root.hidden) refresh();
  }).observe(document.getElementById('appVersion'), {
    childList: true,
    subtree: true,
    characterData: true,
  });
  return { root, refresh };
}
