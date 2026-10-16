import { ICON_CODES } from './ui-icons.js';

const icon = (name) =>
  `<i class="di-icon" aria-hidden="true" data-icon="${name}" data-glyph="${String.fromCodePoint(parseInt(ICON_CODES[name], 16))}"></i>`;

const workspaces = [
  {
    page: 'editor',
    category: 'texture',
    name: 'Texture & Model',
    icon: 'layers',
    tag: 'CREATE',
    color: 'gold',
    description: 'Susun layer, edit tekstur, dan lihat hasilnya langsung di model.',
    formats: 'YTD · YDD · PNG',
    number: '01',
  },
  {
    page: 'textureviewer',
    category: 'texture',
    name: 'Texture viewer',
    icon: 'picture',
    tag: 'INSPECT',
    color: 'violet',
    description: 'Telusuri isi texture dictionary dan ekspor gambar yang kamu butuhkan.',
    formats: 'YTD · DDS',
    number: '02',
  },
  {
    page: 'modelviewer',
    category: 'model',
    name: 'Model viewer',
    icon: 'cube',
    tag: 'PREVIEW',
    color: 'teal',
    description: 'Periksa model, pasangkan tekstur, dan atur tampilan preview.',
    formats: 'YDD · YDR · YFT',
    number: '03',
  },
  {
    page: 'archives',
    category: 'utility',
    name: 'GTA V Explorer',
    icon: 'folder',
    tag: 'EXPLORE',
    color: 'teal',
    description: 'Buka arsip, jelajahi resource, dan preview isi file di satu tempat.',
    formats: 'RPF · OIV',
    number: '04',
  },
  {
    page: 'vehicles',
    category: 'model',
    name: 'Vehicle workshop',
    icon: 'cube',
    tag: 'CUSTOMIZE',
    color: 'gold',
    description: 'Siapkan model kendaraan dan kerjakan perubahan tampilannya.',
    formats: 'YFT · YTD',
    number: '05',
  },
  {
    page: 'converter',
    category: 'utility',
    name: 'Converter',
    icon: 'exchange',
    tag: 'CONVERT',
    color: 'violet',
    description: 'Ubah format aset dalam batch, lalu simpan hasil satu per satu atau ZIP.',
    formats: 'IMAGE · DDS · GLB',
    number: '06',
  },
  {
    page: 'pack',
    category: 'utility',
    name: 'Clothing pack',
    icon: 'tshirt',
    tag: 'PACKAGE',
    color: 'gold',
    description: 'Kelompokkan pakaian dan bangun resource clothing untuk FiveM.',
    formats: 'YDD · YTD · META',
    number: '07',
  },
  {
    page: 'code',
    category: 'utility',
    name: 'Code editor',
    icon: 'document',
    tag: 'EDIT',
    color: 'teal',
    description: 'Edit script dan file teks dengan editor kode offline.',
    formats: 'LUA · XML · JSON',
    number: '08',
  },
  {
    action: 'openNativeBuild',
    category: 'model',
    name: 'Auto rig ped',
    icon: 'tshirt',
    tag: 'BUILD',
    color: 'violet',
    description: 'Buka workspace build dan konfigurasi engine rig yang tersedia.',
    formats: 'NATIVE ENGINE',
    number: '09',
  },
];

export function mountStudioHome({ nav, activate }) {
  const home = document.createElement('section');
  home.id = 'studioHome';
  home.className = 'studio-home';
  home.setAttribute('aria-label', 'Home studio DITASHA');
  home.hidden = true;
  home.innerHTML = `
    <div class="studio-home-inner">
      <div class="studio-home-heading"><div><span class="studio-overline">YOUR CREATIVE WORKSPACE</span><h1>Studio overview<span class="studio-title-dot">.</span></h1></div><span class="studio-local"><span></span>LOCAL FIRST <b>·</b> GTA V LEGACY</span></div>
      <section class="studio-hero" aria-labelledby="studioHeroTitle">
        <div class="studio-hero-copy"><span class="studio-edition"><span></span> DITASHA WORKSHOP / ASSET STUDIO</span><h2 id="studioHeroTitle">Your assets.<br>Your vision.<br><em>Your studio.</em></h2><p>Tempat model, tekstur, dan ide kamu bertemu. Pilih workspace dan mulai membangun sesuatu yang jadi ciri khasmu.</p><div class="studio-hero-actions"><button id="studioStart" class="primary">${icon('folder-open')}<span>Buka file & mulai</span>${icon('arrow-right')}</button><button id="studioContinue">${icon('layers')}<span>Masuk ke editor</span></button></div><div class="studio-format-line"><span>BUILT FOR</span><b>.YTD</b><b>.YDD</b><b>.YFT</b><b>.RPF</b></div></div>
        <div class="studio-hero-art" aria-hidden="true"><div class="studio-grid"></div><div class="studio-orbit studio-orbit-one"></div><div class="studio-orbit studio-orbit-two"></div><div class="studio-art-core"><img src="assets/ditasha-emblem.webp" alt="" draggable="false"></div><span class="studio-art-label studio-art-label-top">${icon('cube')} MODEL / 3D</span><span class="studio-art-label studio-art-label-bottom">${icon('layers')} TEXTURE / 2D</span><span class="studio-art-cross studio-art-cross-a">+</span><span class="studio-art-cross studio-art-cross-b">+</span><div class="studio-art-coordinate">DITASHA<br><b>CREATOR EDITION</b></div></div>
      </section>
      <div class="studio-session"><div>${icon('folder-open')}<span><b id="studioFileCount">0 file</b> di editor</span></div><span class="studio-session-divider"></span><div>${icon('disk')}<span>File tetap di perangkatmu</span></div><button id="studioMotionToggle" aria-pressed="false" title="Matikan animasi dekoratif">${icon('eye')}<span>Animasi aktif</span></button></div>
      <section class="studio-directory" aria-labelledby="studioToolsTitle"><div class="studio-directory-heading"><div><span class="studio-overline">MAKE SOMETHING YOURS</span><h2 id="studioToolsTitle">Pilih ruang kerjamu</h2></div><label class="studio-tool-search">${icon('interrogation')}<input id="studioToolSearch" type="search" placeholder="Cari workspace…" aria-label="Cari workspace studio"></label></div><div class="studio-filter-row" role="group" aria-label="Filter workspace"><button class="active" data-studio-filter="all" aria-pressed="true">Semua <span>09</span></button><button data-studio-filter="texture" aria-pressed="false">Texture & design</button><button data-studio-filter="model" aria-pressed="false">Model & 3D</button><button data-studio-filter="utility" aria-pressed="false">Tools & build</button><span id="studioResults" class="studio-results" role="status">9 workspace</span></div><div class="studio-tool-grid">${workspaces.map((item, i) => `<button class="studio-tool-card" data-studio-index="${i}" data-tone="${item.color}" style="--card-order:${i % 3}" aria-label="Buka ${item.name}"><span class="studio-card-top"><span class="studio-tool-icon">${icon(item.icon)}</span><span class="studio-tool-tag">${item.tag}</span><span class="studio-card-arrow">${icon('arrow-right')}</span></span><span class="studio-card-name">${item.name}</span><span class="studio-card-description">${item.description}</span><span class="studio-card-bottom"><span>${item.formats}</span><b>${item.number}</b></span></button>`).join('')}</div><p class="studio-no-results" id="studioNoResults" hidden>Tidak ada workspace yang cocok. Coba nama lain atau pilih Semua.</p></section>
      <footer class="studio-home-footer"><span><img src="assets/ditasha-emblem.webp" alt=""> DITASHA WORKSHOP <b>/</b> Made for creators.</span><span>© 2026 Ditasha-Workshop</span></footer>
    </div>`;
  nav.after(home);
  const button = document.createElement('button');
  button.dataset.page = 'home';
  button.id = 'studioHomeNav';
  button.innerHTML = `${icon('layers')}<span class="nav-label">Home studio</span>`;
  nav.prepend(button);
  const $ = (id) => home.querySelector('#' + id);
  let filter = 'all',
    lastPage = 'editor';
  const render = () => {
    const query = $('studioToolSearch').value.trim().toLocaleLowerCase();
    let count = 0;
    home.querySelectorAll('[data-studio-index]').forEach((card) => {
      const item = workspaces[Number(card.dataset.studioIndex)];
      card.hidden =
        (filter !== 'all' && item.category !== filter) ||
        !`${item.name} ${item.description} ${item.formats}`.toLocaleLowerCase().includes(query);
      if (!card.hidden) count++;
    });
    $('studioResults').textContent = `${count} workspace`;
    $('studioNoResults').hidden = count !== 0;
  };
  $('studioToolSearch').addEventListener('input', render);
  home.querySelectorAll('[data-studio-filter]').forEach((filterButton) =>
    filterButton.addEventListener('click', () => {
      filter = filterButton.dataset.studioFilter;
      home.querySelectorAll('[data-studio-filter]').forEach((b) => {
        const active = b === filterButton;
        b.classList.toggle('active', active);
        b.setAttribute('aria-pressed', String(active));
      });
      render();
    }),
  );
  home.querySelectorAll('[data-studio-index]').forEach((card) =>
    card.addEventListener('click', () => {
      const item = workspaces[Number(card.dataset.studioIndex)];
      if (item.action) document.getElementById(item.action)?.click();
      else activate(item.page);
    }),
  );
  $('studioStart').addEventListener('click', () => {
    activate('editor');
    document.getElementById('fileInput').click();
  });
  $('studioContinue').addEventListener('click', () => activate(lastPage));
  document.addEventListener('ditasha:workspace', ({ detail }) => {
    if (detail.page !== 'home' && detail.page !== 'code') {
      lastPage = detail.page;
      const name = workspaces.find((item) => item.page === lastPage)?.name || 'editor';
      $('studioContinue').querySelector('span').textContent = 'Lanjut ke ' + name;
    }
  });
  const fileCount = document.getElementById('fileCount');
  const updateFiles = () => {
    $('studioFileCount').textContent = fileCount.textContent.toLowerCase();
  };
  new MutationObserver(updateFiles).observe(fileCount, {
    childList: true,
    characterData: true,
    subtree: true,
  });
  updateFiles();
  return { root: home };
}
