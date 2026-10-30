import { mountChoiceSelect } from './workspace-choices.js';
// Shared desktop UI. Retain original controls and listeners as the source of truth.
export function mountWorkspacePolish() {
  const $ = (id) => document.getElementById(id);
  const read = (key, fallback) => {
    try {
      return (
        (localStorage.getItem('ditasha.panel.' + key) ??
          (fallback ? localStorage.getItem('ditasha.panel.' + fallback) : null)) === 'closed'
      );
    } catch {
      return false;
    }
  };
  const save = (key, closed) => {
    try {
      localStorage.setItem('ditasha.panel.' + key, closed ? 'closed' : 'open');
    } catch {}
  };
  const panels = [];
  const panelRecords = [];
  document
    .querySelectorAll(
      '.lp-settings, .lp-export, .tool-sidebar, .tool-details, .fm-sidebar, .fm-inspector, .pb-panel, .native-build-layout > aside, main > .files, .ac-files, .ac-settings, .debadge-sidebar, .debadge-inspector, .ft-grid > aside, .gt-layout > .gt-panel',
    )
    .forEach((panel, index) => {
      const label = panel.classList.contains('ac-files')
        ? 'File sumber'
        : panel.classList.contains('ac-settings')
          ? 'Optimasi tekstur'
          : panel.closest('.archive-selection-details')
            ? 'Detail file'
            : panel.classList.contains('files')
              ? 'File & layer'
              : panel.querySelector('h2,h3,.sectiontitle')?.textContent.trim() || 'Pengaturan';
      const legacyKey = panel.id || panel.parentElement.id + ':' + panel.className + ':' + index;
      const anchor = panel.querySelector('button[id],input[id],select[id],[role=status][id]')?.id;
      const key = panel.id || 'panel:' + (anchor || legacyKey);
      if (panel.matches('.archive-selection-details .tool-details, .gt-panel'))
        panel.classList.add('workspace-panel-inline');
      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'workspace-panel-toggle';
      const title = document.createElement('span');
      title.textContent = label;
      const icon = document.createElement('span');
      icon.setAttribute('aria-hidden', 'true');
      toggle.append(title, icon);
      panel.prepend(toggle);
      function set(closed) {
        panel.classList.toggle('workspace-panel-collapsed', closed);
        toggle.setAttribute('aria-expanded', String(!closed));
        toggle.title = (closed ? 'Buka ' : 'Minimalkan ') + label;
        toggle.setAttribute('aria-label', toggle.title);
        icon.textContent = closed ? '+' : '−';
        save(key, closed);
        window.dispatchEvent(new Event('resize'));
      }
      toggle.onclick = () => set(!panel.classList.contains('workspace-panel-collapsed'));
      set(read(key, legacyKey));
      panels.push(() => set(false));
      panelRecords.push({
        panel,
        label,
        toggle,
        set: (closed) => {
          set(closed);
          if (
            !closed &&
            panel.classList.contains('fm-inspector') &&
            !panel.closest('[hidden]') &&
            getComputedStyle(panel).display === 'none'
          )
            $('fmToggleDetails')?.click();
        },
      });
    });
  // Keep the long Photo Booth inspector navigable without replacing any control nodes.
  document.querySelectorAll('.pb-settings > h2').forEach((heading, index) => {
    const section = document.createElement('details');
    section.className = 'workspace-settings-section';
    const summary = document.createElement('summary');
    summary.textContent = heading.textContent;
    section.append(summary);
    const key = 'booth-section:' + index;
    section.open = !read(key);
    heading.before(section);
    let node = heading.nextSibling;
    while (node && !(node.nodeType === 1 && node.tagName === 'H2')) {
      const next = node.nextSibling;
      section.append(node);
      node = next;
    }
    heading.remove();
    section.addEventListener('toggle', () => save(key, !section.open));
    panels.push(() => {
      section.open = true;
      save(key, false);
    });
  });
  // Inspector groups can collapse independently without hiding the 3D viewport.
  document
    .querySelectorAll('.workshop-control-group, .canvas-studio, .layerinspector')
    .forEach((panel, i) => {
      const heading = panel.querySelector(':scope > h3, :scope > .sectiontitle');
      if (!heading) return;
      const label = heading.textContent.trim(),
        key = 'group:' + label + ':' + i;
      const button = document.createElement('button');
      button.className = 'workspace-group-toggle';
      button.type = 'button';
      button.textContent = label;
      heading.replaceChildren(button);
      const set = (closed) => {
        panel.classList.toggle('workspace-group-collapsed', closed);
        button.setAttribute('aria-expanded', String(!closed));
        save(key, closed);
        window.dispatchEvent(new Event('resize'));
      };
      button.onclick = () => set(!panel.classList.contains('workspace-group-collapsed'));
      set(read(key));
      panels.push(() => set(false));
    });
  const reset = document.createElement('button');
  reset.id = 'restoreWorkspacePanels';
  reset.textContent = 'Pulihkan panel';
  reset.title = 'Buka kembali semua panel workspace';
  reset.onclick = () => {
    panels.forEach((open) => open());
    panelRecords.forEach((record) => record.set(false));
    document.querySelectorAll('.inspector > details').forEach((d) => {
      d.open = true;
    });
  };
  document.querySelector('.settings-section')?.append(reset);
  mountPanelMenu(panelRecords, () => reset.click());

  const labels = {
    snapshot: ['Foto preview', 'Simpan PNG dari sudut kamera preview saat ini'],
    photoshoot: ['Photoshoot', 'Buka pengaturan latar, logo dan foto model'],
    reset: ['Pas model', 'Pas seluruh model ke kamera preview'],
    replace: ['Ganti gambar', 'Ganti gambar pada layer terpilih'],
    addImage: ['Tambah layer', 'Tambahkan gambar sebagai layer baru'],
    undo: ['Undo 2D', 'Urungkan perubahan tekstur 2D'],
    redo: ['Redo 2D', 'Ulangi perubahan tekstur 2D'],
    mvSnapshot: ['Foto model', 'Simpan PNG dari kamera Model viewer'],
    mvPhotoshoot: ['Photoshoot model', 'Buka pengaturan foto model dengan latar dan logo'],
    pbFit: ['Pas seluruh scene', 'Pas kamera ke semua ped, kendaraan dan prop'],
    pbStageCapture: ['Ekspor foto PNG', 'Pilih orientasi dan resolusi foto Photo Booth'],
    pbMovieToggle: ['Video & keyframe', 'Atur durasi, kamera dan ekspor video WebM'],
    vehicleDebadge: ['Hapus badge', 'Pilih dan hapus geometri badge kendaraan pada salinan YFT'],
    vehicleStrobo: ['Strobo dari donor', 'Preview dan transfer lampu siren dari kendaraan donor'],
    vehicleParts: ['Part dari donor', 'Pilih part rigid kendaraan donor untuk dipindahkan'],
  };
  for (const [id, [label, title]] of Object.entries(labels)) {
    const b = $(id);
    if (!b) continue;
    b.title = title;
    b.setAttribute('aria-label', label + ' · ' + title);
    const text = b.querySelector('.control-label');
    if (text) text.textContent = label;
    b.dataset.autoLabel = 'false';
    b.classList.add('workspace-explicit-action');
    b.dataset.actionLabel = label;
  }
  // Short, stable choices become visible buttons. Large/dynamic asset lists stay native.
  const shortIDs = [
    'packMode',
    'packMaxSize',
    'stampType',
    'stickerProjection',
    'stickerScope',
    'stickerResolution',
    'appearanceTheme',
    'appearanceDensity',
    'appearanceMotion',
    'pbMovieBlend',
    'pbMovieFps',
    'pbMovieSize',
    'pbTransformMode',
    'pbRigSource',
    'pbExportOrientation',
    'mvMaterialUv',
    'mvMaterialAlpha',
    'ymtGender',
    'nbReference',
    'acImportKind',
  ];
  document
    .querySelectorAll('.scene-studio select[id$="Space"], .scene-studio select[id$="Light"]')
    .forEach((s) => shortIDs.push(s.id));
  const selects = shortIDs.map($).filter(Boolean);
  document
    .querySelectorAll(
      '.gta-tools-workspace select[id$="-gtEdition"], #pbMoviePanel select[data-movie="shadowSize"], #pbMoviePanel select[data-movie="shadowMode"]',
    )
    .forEach((s) => selects.push(s));
  const choices = [...new Set(selects)].map(mountChoiceSelect).filter(Boolean);
  // Preset restores may update values without DOM events; do not replace a focused button.
  setInterval(() => {
    if (!document.hidden) choices.forEach((sync) => sync());
  }, 300);
}

function mountPanelMenu(records, restore) {
  const dialog = document.createElement('dialog');
  dialog.id = 'workspacePanelsDialog';
  dialog.className = 'workspace-panels-dialog';
  dialog.setAttribute('aria-labelledby', 'workspacePanelsTitle');
  dialog.innerHTML =
    '<div class="workspace-panel-menu-head"><h2 id="workspacePanelsTitle">Panel workspace</h2><button type="button" aria-label="Tutup panel workspace">Tutup</button></div><p>Pilih panel yang ingin ditampilkan pada workspace ini.</p><div class="workspace-panel-menu-list"></div><button type="button" class="workspace-panels-restore">Pulihkan semua panel</button>';
  document.body.append(dialog);
  dialog.querySelector('.workspace-panel-menu-head button').onclick = () => dialog.close();
  dialog.querySelector('.workspace-panels-restore').onclick = () => {
    restore();
    render();
  };
  function render() {
    const list = dialog.querySelector('.workspace-panel-menu-list');
    list.replaceChildren();
    for (const record of records.filter(
      (r) =>
        !r.panel.closest('[hidden]') &&
        (getComputedStyle(r.panel).display !== 'none' ||
          r.panel.classList.contains('fm-inspector')),
    )) {
      const label = document.createElement('label');
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.checked =
        !record.panel.classList.contains('workspace-panel-collapsed') &&
        getComputedStyle(record.panel).display !== 'none';
      input.onchange = () => record.set(!input.checked);
      label.append(input, document.createTextNode(record.label));
      list.append(label);
    }
    if (!list.children.length) list.textContent = 'Workspace ini tidak memiliki panel samping.';
  }
  const button = document.createElement('button');
  button.id = 'openWorkspacePanels';
  button.type = 'button';
  button.textContent = 'Panel';
  button.title = 'Tampilkan, minimalkan atau pulihkan panel workspace';
  button.setAttribute('aria-haspopup', 'dialog');
  button.onclick = () => {
    render();
    dialog.showModal();
  };
  document.querySelector('body > header .workspace-search')?.after(button);
}
