// Shared desktop UI. Retain original controls and listeners as the source of truth.
export function mountWorkspacePolish() {
  const $ = (id) => document.getElementById(id);
  const read = (key) => {
    try {
      return localStorage.getItem('ditasha.panel.' + key) === 'closed';
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
  document
    .querySelectorAll(
      '.tool-sidebar, .tool-details, .fm-sidebar, .fm-inspector, .pb-panel, .native-build-layout > aside, main > .files',
    )
    .forEach((panel, index) => {
      const label =
        panel.querySelector('h2,h3,.sectiontitle')?.textContent.trim() ||
        (panel.classList.contains('files') ? 'File & layer' : 'Pengaturan');
      const key = panel.id || panel.parentElement.id + ':' + panel.className + ':' + index;
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
      set(read(key));
      panels.push(() => set(false));
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
    document.querySelectorAll('.inspector > details').forEach((d) => {
      d.open = true;
    });
  };
  document.querySelector('.settings-section')?.append(reset);

  const labels = {
    snapshot: ['Foto preview', 'Simpan PNG dari sudut kamera preview saat ini'],
    photoshoot: ['Photoshoot', 'Buka pengaturan latar, logo dan foto model'],
    reset: ['Pas model', 'Pas seluruh model ke kamera preview'],
    replace: ['Ganti gambar', 'Ganti gambar pada layer terpilih'],
    addImage: ['Tambah layer', 'Tambahkan gambar sebagai layer baru'],
    undo: ['Undo 2D', 'Urungkan perubahan tekstur 2D'],
    redo: ['Redo 2D', 'Ulangi perubahan tekstur 2D'],
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
  ];
  document
    .querySelectorAll('.scene-studio select[id$="Space"], .scene-studio select[id$="Light"]')
    .forEach((s) => shortIDs.push(s.id));
  const choices = [];
  for (const id of shortIDs) {
    const select = $(id);
    if (!select || select.multiple) continue;
    const box = document.createElement('span');
    box.className = 'workspace-choice-grid';
    box.setAttribute('role', 'group');
    box.setAttribute(
      'aria-label',
      select.closest('label')?.firstChild?.textContent.trim() ||
        select.getAttribute('aria-label') ||
        id,
    );
    select.after(box);
    select.classList.add('workspace-choice-source');
    select.tabIndex = -1;
    select.setAttribute('aria-hidden', 'true');
    function sync() {
      const options = [...select.options];
      const signature = options.map((o) => [o.value, o.text, o.disabled].join('|')).join('\n');
      if (box.dataset.options !== signature) {
        box.dataset.options = signature;
        box.replaceChildren();
        for (const option of options) {
          const b = document.createElement('button');
          b.type = 'button';
          b.textContent = option.text;
          b.title = option.text;
          b.onclick = (e) => {
            e.preventDefault();
            if (select.disabled || option.disabled) return;
            select.value = option.value;
            select.dispatchEvent(new Event('input', { bubbles: true }));
            select.dispatchEvent(new Event('change', { bubbles: true }));
            sync();
          };
          box.append(b);
        }
      }
      box.hidden = select.hidden;
      [...box.children].forEach((b, i) => {
        b.disabled = select.disabled || options[i].disabled;
        b.setAttribute('aria-pressed', String(select.selectedIndex === i));
      });
    }
    select.addEventListener('change', sync);
    sync();
    choices.push(sync);
  }
  // Programmatic preset restores update the original selects without DOM events.
  setInterval(() => {
    if (!document.hidden) choices.forEach((sync) => sync());
  }, 300);
}
