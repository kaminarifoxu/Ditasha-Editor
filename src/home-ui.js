import { craftWorkspaces } from './craft-ui.js';
import { ICON_CODES } from './ui-icons.js';

const icon = (name) =>
  `<i class="di-icon" aria-hidden="true" data-icon="${name}" data-glyph="${String.fromCodePoint(parseInt(ICON_CODES[name], 16))}"></i>`;
const workspaces = [
  ['moddrop', 'cube', 'ModDropV', 'Build DLC kendaraan, ped, prop dan pakaian.', 'DLC BUILDER'],
  [
    'weapons',
    'cube',
    'AddonWeaponsBuilder',
    'Analisis dan build senjata add-on.',
    'WEAPON BUILDER',
  ],
  [
    'photobooth',
    'camera',
    'Photo Booth',
    'Pasang ped, pakaian dan aksesori. Pilih pose lalu foto offline.',
    'POSE · EMOTE · PNG',
  ],
  [
    'fivemtools',
    'tshirt',
    'YMT & FiveM Tools',
    'Buat metadata clothing, hash dan manifest secara offline.',
    'YMT XML · LUA',
  ],
  [
    'compressor',
    'compress',
    'Asset Compressor',
    'Kompresi YTD batch, profil ukuran per aset, dan preview 3D.',
    '25 GB · MLO / VEHICLE / PED',
  ],
  [
    'files',
    'folder-open',
    'File Manager',
    'Cari, preview, dan sorting gambar, pakaian, rambut, serta kendaraan.',
    'FOLDER · ASSET SORTING',
  ],
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
  root.innerHTML = `<div class="home-inner"><div class="home-heading"><span class="home-kicker">DITASHA / CREATIVE SUITE</span><span class="home-version"></span></div><section class="home-hero"><div class="home-hero-copy"><p class="home-overline">YOUR IDEAS. YOUR WORKSPACE.</p><h1>Create beyond<br><em>the ordinary.</em></h1><p class="home-description">Build a livery. Shape a scene. Finish your next design.<br>Your creative tools, together in one studio.</p><div class="home-hero-actions"><button class="primary" data-home="import">${icon('plus')}<span>Open an asset</span></button><button data-home="resume">Texture & Model ${icon('arrow-right')}</button></div></div><div class="home-start-card"><div class="home-preview-head"><span><i></i> STUDIO / CANVAS</span><span>01 — DESIGN</span></div><div class="home-artboard" aria-hidden="true"><div class="home-art-grid"></div><span class="art-axis axis-one"></span><span class="art-axis axis-two"></span><svg class="studio-orbit" viewBox="0 0 300 220"><defs><linearGradient id="studioFace" x2="1" y2="1"><stop stop-color="#eabf75"/><stop offset="1" stop-color="#ae779d"/></linearGradient></defs><ellipse cx="150" cy="168" rx="90" ry="14" fill="#000" opacity=".2"/><g class="studio-shape"><path d="M150 25 238 76 238 146 150 196 62 146 62 76Z" fill="none" stroke="url(#studioFace)" stroke-width="1.5"/><path d="m150 25 0 102 88-51M150 127 62 76m88 51v69" fill="none" stroke="#eabf75" opacity=".6"/><path d="m150 55 60 35v44l-60 35-60-35V90Z" fill="url(#studioFace)"/><path d="m150 55 0 70 60-35M150 125l-60-35m60 35v44" fill="none" stroke="#fff" opacity=".4"/><circle cx="150" cy="25" r="4" fill="#eabf75"/><circle cx="62" cy="146" r="4" fill="#eabf75"/><circle cx="238" cy="146" r="4" fill="#eabf75"/></g></svg><span class="art-label">FORM / COLOUR / POSSIBILITY</span><span class="art-layer layer-one">${icon('layers')} Layers &amp; masks</span><span class="art-layer layer-two">${icon('cube')} 2D meets 3D</span></div><div class="home-preview-footer"><div><strong>A fresh perspective.</strong><p>Give your next idea a place to start.</p></div><button data-home="photo" aria-label="Open Photo Studio">${icon('arrow-right')}</button></div></div></section><div class="home-launch-strip"><span class="launch-intro">JUMP BACK IN ${icon('arrow-right')}</span><button data-quick-page="files">${icon('folder-open')} Browse files</button><button data-quick-page="vehicles">${icon('cube')} Vehicle workshop</button><button data-quick-page="code">${icon('document')} Code Studio</button></div><div class="home-section-heading"><div><span class="home-overline">CREATE SOMETHING NEW</span><h2>Your creative workspaces</h2></div><span>${String(craftWorkspaces.length).padStart(2, '0')} / STUDIOS</span></div><div class="home-studio-filters" role="group" aria-label="Filter creative workspaces"><button data-studio-filter="ALL" aria-pressed="true">All studios <span>${String(craftWorkspaces.length).padStart(2, '0')}</span></button><button data-studio-filter="DESIGN" aria-pressed="false">Design</button><button data-studio-filter="MOTION" aria-pressed="false">Video &amp; motion</button><button data-studio-filter="OFFICE" aria-pressed="false">Office</button></div><div class="home-suite-grid"></div><div class="home-section-heading"><div><span class="home-overline">BUILD & ORGANIZE</span><h2>Your asset workshop</h2></div><span>GTA V · CODE · FILES</span></div><div class="home-workspace-grid"></div><section class="home-session"><div class="home-section-heading"><div><span class="home-overline">THIS SESSION</span><h2>Pick up where you left off</h2></div><span data-home="session-count">0 FILE</span></div><div class="home-session-files"></div></section><footer class="home-footer"><span>DITASHA EDITOR · Creative Suite</span><span>GANOMABI / Ditasha-Workshop · 2026</span></footer></div>`;
  nav.after(root);
  for (const [page, symbol, title, description, format] of workspaces) {
    const card = document.createElement('button');
    card.className = 'home-workspace-card';
    card.dataset.homePage = page;
    card.innerHTML = `<span class="home-card-top"><span class="home-card-icon">${icon(symbol)}</span><span class="home-card-arrow">${icon('arrow-right')}</span></span><strong>${title}</strong><span class="home-card-description">${description}</span><span class="home-card-format">${format}</span>`;
    card.onclick = () => activate(page);
    root.querySelector('.home-workspace-grid').append(card);
  }
  root.querySelector('[data-home=photo]').onclick = () => activate('craft-photocraft');
  for (const [id, title, mark, description, group] of craftWorkspaces) {
    const card = document.createElement('button');
    card.className = 'home-suite-card';
    card.dataset.homePage = 'craft-' + id;
    card.dataset.studioGroup = group;
    card.innerHTML = `<span class="suite-mark">${mark}</span><div><strong>${title}</strong><span>${description}</span></div><small>${group}</small>${icon('arrow-right')}`;
    card.onclick = () => activate('craft-' + id);
    root.querySelector('.home-suite-grid').append(card);
  }
  root.querySelectorAll('[data-quick-page]').forEach((button) => {
    button.onclick = () => activate(button.dataset.quickPage);
  });
  root.querySelectorAll('[data-studio-filter]').forEach((button) => {
    button.onclick = () => {
      root
        .querySelectorAll('[data-studio-filter]')
        .forEach((item) => item.setAttribute('aria-pressed', String(item === button)));
      root.querySelectorAll('[data-studio-group]').forEach((card) => {
        card.hidden =
          button.dataset.studioFilter !== 'ALL' &&
          card.dataset.studioGroup !== button.dataset.studioFilter;
      });
    };
  });
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
