import { getProject } from './project-context.js';
import { ICON_CODES } from './ui-icons.js';
const glyph = (name) =>
  `<i class="di-icon" aria-hidden="true" data-icon="${name}" data-glyph="${String.fromCodePoint(parseInt(ICON_CODES[name], 16))}"></i>`;
export function mountWorkspaceShell({ toast }) {
  document.body.classList.add('workspace-shell');
  const $ = (id) => document.getElementById(id),
    nav = document.querySelector('.workspace-nav');
  const load = (key, fallback) => {
    try {
      return localStorage.getItem('ditasha.' + key) || fallback;
    } catch {
      return fallback;
    }
  };
  const store = (key, value) => {
    try {
      localStorage.setItem('ditasha.' + key, value);
    } catch {}
  };
  const apply = (key, value) => {
    document.body.dataset[key] = value;
    store(key, value);
  };
  apply('theme', load('theme', 'midnight'));
  apply('density', load('density', 'comfortable'));
  apply('motion', load('motion', 'system') === 'reduced' ? 'reduced' : 'system');
  nav.querySelectorAll('[data-page]').forEach((button) => {
    const label = button.getAttribute('aria-label') || button.textContent.trim();
    button.setAttribute('aria-label', label);
    button.title = label;
  });
  const navTitle = document.createElement('div');
  navTitle.className = 'nav-section-title';
  navTitle.textContent = 'WORKSPACE';
  const home = nav.querySelector('[data-page=home]');
  if (home) home.after(navTitle);
  else nav.prepend(navTitle);
  for (const page of ['files', 'editor', 'archives', 'vehicles', 'code']) {
    const item = nav.querySelector(`[data-page="${page}"]`);
    if (item) nav.append(item);
  }
  const utilities = document.createElement('details');
  utilities.className = 'nav-utilities';
  utilities.innerHTML =
    '<summary title="Alat lainnya" aria-label="Alat lainnya"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg><span class="nav-label">Alat lainnya</span></summary>';
  for (const page of ['modelviewer', 'converter', 'pack']) {
    const item = nav.querySelector(`[data-page="${page}"]`);
    if (item) utilities.append(item);
  }
  nav.append(utilities);
  const buildTitle = document.createElement('div');
  buildTitle.className = 'nav-section-title';
  buildTitle.textContent = 'STUDIO';
  nav.append(buildTitle);
  const rig = $('openNativeBuild');
  rig.innerHTML = glyph('tshirt') + '<span class="nav-label">Auto rig ped</span>';
  rig.classList.add('nav-action');
  nav.append(rig);
  const gpu = $('previewPerformance');
  const bottom = document.createElement('div');
  bottom.className = 'nav-bottom';
  bottom.innerHTML = `<button id="openSettings" title="Pengaturan" aria-label="Pengaturan"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 3-1 3-3 1-2 3 2 2-1 3 3 2 1 3h4l1-3 3-1 2-3-2-2 1-3-3-2-1-3H9Z"/><circle cx="10" cy="11" r="3"/></svg><span class="nav-label">Pengaturan</span><span id="discordConnection" class="connection-dot" aria-label="Discord belum diatur"></span></button><small>© 2026 Ditasha-Workshop</small>`;
  nav.append(bottom);
  // Group workspaces by task rather than showing a long flat list.
  navTitle.remove();
  buildTitle.remove();
  const groups = [
    ['DESIGN', 'Design', true],
    ['MOTION', 'Video & motion', false],
    ['OFFICE', 'Documents & office', false],
  ];
  const fileItem = nav.querySelector('[data-page=files]');
  if (fileItem) home.after(fileItem);
  const groupsHost = document.createElement('div');
  groupsHost.className = 'suite-nav-groups';
  nav.insertBefore(groupsHost, nav.querySelector('[data-page=editor]'));
  for (const [key, label, open] of groups) {
    const group = document.createElement('details');
    group.className = 'suite-nav-group';
    group.open = open;
    const summary = document.createElement('summary');
    summary.textContent = label;
    group.append(summary);
    nav.querySelectorAll(`[data-nav-group="${key}"]`).forEach((item) => group.append(item));
    groupsHost.append(group);
  }
  const workshop = document.createElement('details');
  workshop.className = 'suite-nav-group workshop-nav';
  workshop.open = true;
  workshop.innerHTML = '<summary>Asset workshop</summary>';
  for (const page of [
    'editor',
    'archives',
    'vehicles',
    'modelviewer',
    'pack',
    'compressor',
    'converter',
    'code',
  ]) {
    const item = nav.querySelector(`[data-page="${page}"]`);
    if (item) workshop.append(item);
  }
  workshop.append(rig);
  groupsHost.append(workshop);
  utilities.hidden = true;
  // Native editor actions remain accessible from the shared document bar.
  const advanced = document.createElement('button');
  advanced.id = 'openPhotoStudio';
  advanced.textContent = 'Photo Studio ↗';
  advanced.title =
    'Advanced image editing. Export PNG, edit in Photo Studio, then import the result.';
  advanced.onclick = () => nav.querySelector('[data-page=craft-photocraft]')?.click();
  document.querySelector('.texture-edit-modes').append(advanced);
  const dialog = document.createElement('dialog');
  dialog.id = 'settingsDialog';
  dialog.className = 'studio-dialog settings-dialog';
  dialog.innerHTML = `<div class="studio-dialog-head"><div><span class="eyebrow">DITASHA EDITOR</span><h2>Pengaturan</h2></div><button id="settingsClose" aria-label="Tutup">×</button></div><div class="settings-layout"><section class="settings-section"><h3>Tampilan</h3><p class="muted">Atur tampilan workspace sesuai cara kamu bekerja.</p><div class="settings-fields"><label>Tema<select id="appearanceTheme"><option value="midnight">Midnight</option><option value="light">Terang</option></select></label><label>Kepadatan<select id="appearanceDensity"><option value="comfortable">Nyaman</option><option value="compact">Ringkas</option></select></label></div><label>Animasi<select id="appearanceMotion"><option value="system">Aktif · ikuti pengaturan sistem</option><option value="reduced">Kurangi gerakan</option></select></label><div class="settings-note">Navigasi ada di kiri. File dan layer mengikuti workspace aktif; kontrol detail berada di panel samping.</div></section><section class="settings-section"><div class="settings-heading"><div><h3>Discord Activity</h3><p class="muted">Tampilkan DITASHA Editor saat aplikasi terbuka.</p></div><label class="switch-label"><input id="discordEnabled" type="checkbox" checked>Aktif</label></div><label>Application ID<input id="discordAppId" inputmode="numeric" maxlength="20" placeholder="Salin Application ID dari Developer Portal" autocomplete="off"></label><label class="check"><input id="discordShareWorkspace" type="checkbox" checked>Tampilkan workspace yang sedang digunakan</label><label class="check"><input id="discordShareProject" type="checkbox" checked>Tampilkan nama proyek di Activity</label><label>Nama proyek (kosong = nama aset aktif)<input id="discordProjectName" maxlength="100" placeholder="Otomatis dari aset / folder aktif"></label><div class="presence-card"><img src="assets/ditasha-emblem.webp" alt=""><div><span>PLAYING A GAME</span><strong>DITASHA Editor</strong><p id="discordActivityPreview">Texture & Model</p><small>Ditasha-Workshop · waktu berjalan</small></div></div><p class="muted presence-hint">Contoh tampilan. Nama dan ikon aplikasi mengikuti pengaturan aplikasi di Discord.</p><p id="discordSettingsStatus" role="status">Memuat pengaturan Discord…</p><div class="settings-actions"><button id="discordSave" class="primary">Simpan & hubungkan</button><button id="discordRefresh">Periksa koneksi</button></div><details class="setup-guide"><summary>Belum punya Application ID?</summary><ol><li>Buka Developer Portal, buat aplikasi bernama <strong>DITASHA Editor</strong>.</li><li>Salin <strong>Application ID</strong> dari General Information lalu tempel di atas. Ikon aplikasi dapat diunggah pada halaman aplikasi tersebut.</li><li>Buka Discord desktop dan aktifkan berbagi aktivitas pada <strong>Activity Privacy</strong>, lalu simpan pengaturan ini.</li></ol><button id="discordPortal">Buka Discord Developer Portal</button><p class="muted">Application ID adalah ID publik. Tidak perlu bot token, client secret, atau login Discord di editor. Hanya nama proyek/aset ditampilkan jika pilihan berbagi nama proyek aktif. Lokasi folder lengkap tidak dikirim.</p></details></section></div>`;
  document.body.append(dialog);
  dialog.querySelector('.settings-section').append(gpu);
  const brand = document.querySelector('header .brand');
  brand.setAttribute('aria-label', 'DITASHA — Home');
  brand.onclick = (event) => {
    event.preventDefault();
    home?.click();
  };
  const search = document.createElement('button');
  search.id = 'openWorkspaceSearch';
  search.className = 'workspace-search';
  search.setAttribute('aria-label', 'Cari alat (Ctrl K)');
  search.innerHTML =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg><span>Cari alat…</span><kbd>Ctrl K</kbd>';
  document.querySelector('header .local').before(search);
  const command = document.createElement('dialog');
  command.id = 'workspaceCommand';
  command.className = 'workspace-command';
  command.setAttribute('aria-label', 'Cari workspace dan alat');
  command.innerHTML =
    '<input type="search" aria-label="Cari alat" placeholder="Ketik nama workspace atau alat…"><div class="workspace-command-results"></div><p class="muted" hidden>Tidak ada alat yang cocok.</p><footer><span>Enter untuk membuka · Esc untuk menutup</span><button>Tutup</button></footer>';
  document.body.append(command);
  const commands = [...nav.querySelectorAll('[data-page]'), rig, $('openSettings')];
  const results = command.querySelector('.workspace-command-results');
  const commandRows = commands.map((source) => {
    const button = document.createElement('button');
    button.textContent = source.getAttribute('aria-label') || source.textContent.trim();
    const symbol = source.querySelector('svg, .di-icon');
    if (symbol) button.prepend(symbol.cloneNode(true));
    button.onclick = () => {
      command.close();
      if (source.closest('.nav-utilities')) utilities.open = true;
      source.click();
    };
    results.append(button);
    return button;
  });
  command.querySelector('input').oninput = (event) => {
    const query = event.target.value.trim().toLocaleLowerCase();
    commandRows.forEach((row) => {
      row.hidden = !row.textContent.toLocaleLowerCase().includes(query);
    });
    command.querySelector('p').hidden = commandRows.some((row) => !row.hidden);
  };
  command.querySelector('input').onkeydown = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      commandRows.find((row) => !row.hidden)?.click();
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      commandRows.find((row) => !row.hidden)?.focus();
    }
  };
  command.querySelector('footer button').onclick = () => command.close();
  search.onclick = () => {
    command.querySelector('input').value = '';
    commandRows.forEach((row) => {
      row.hidden = false;
    });
    command.querySelector('p').hidden = true;
    if (!command.open) command.showModal();
    command.querySelector('input').focus();
  };
  document.addEventListener('keydown', (event) => {
    if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'k') return;
    if (document.querySelector('dialog[open]') && !command.open) return;
    event.preventDefault();
    search.click();
  });
  $('appearanceTheme').value = document.body.dataset.theme;
  $('appearanceDensity').value = document.body.dataset.density;
  $('appearanceTheme').onchange = () => apply('theme', $('appearanceTheme').value);
  $('appearanceDensity').onchange = () => apply('density', $('appearanceDensity').value);
  $('appearanceMotion').value = document.body.dataset.motion;
  $('appearanceMotion').onchange = () => apply('motion', $('appearanceMotion').value);
  const api = () => window.ditashaDiscord;
  let initialized = false,
    busy = false,
    lastWorkspace = '',
    timer;
  function draw(value, fill = false) {
    if (fill) {
      $('discordAppId').value = value.applicationId || '';
      $('discordEnabled').checked = value.enabled !== false;
      $('discordShareWorkspace').checked = value.shareWorkspace !== false;
      $('discordShareProject').checked = value.shareProject !== false;
      initialized = true;
    }
    $('discordSettingsStatus').textContent = value.message || '';
    $('discordConnection').dataset.status = value.status || 'setup';
    $('discordConnection').setAttribute('aria-label', value.message || 'Discord');
    workspace();
  }
  async function refresh(fill = false) {
    try {
      if (api()) draw(await api().state(), fill);
      else
        draw(
          { status: 'setup', message: 'Discord Activity tersedia pada aplikasi desktop Windows.' },
          fill,
        );
    } catch (e) {
      $('discordSettingsStatus').textContent = e.message;
    }
  }
  $('openSettings').onclick = () => {
    if (!dialog.open) dialog.showModal();
    refresh(!initialized);
  };
  $('settingsClose').onclick = () => dialog.close();
  $('discordRefresh').onclick = () => refresh();
  $('discordSave').onclick = async () => {
    if (busy) return;
    if (!api()) return toast('Discord Activity tersedia pada aplikasi desktop.');
    busy = true;
    $('discordSave').disabled = true;
    try {
      draw(
        await api().configure({
          applicationId: $('discordAppId').value.trim(),
          enabled: $('discordEnabled').checked,
          shareWorkspace: $('discordShareWorkspace').checked,
          shareProject: $('discordShareProject').checked,
        }),
      );
      initialized = true;
    } catch (e) {
      $('discordSettingsStatus').textContent = e.message;
    } finally {
      busy = false;
      $('discordSave').disabled = false;
    }
  };
  $('discordShareWorkspace').onchange = () => {
    $('discordActivityPreview').textContent = $('discordShareWorkspace').checked
      ? $('workspaceLabel').textContent
      : 'Creating with DITASHA Editor';
  };
  $('discordPortal').onclick = () =>
    api()
      ?.docs()
      .catch((e) => toast(e.message));
  function workspace() {
    utilities.classList.toggle('has-active', !!utilities.querySelector('[data-page].active'));
    nav
      .querySelectorAll('[data-page]')
      .forEach((button) =>
        button.setAttribute('aria-current', button.classList.contains('active') ? 'page' : 'false'),
      );
    const activeGroup = nav.querySelector('[data-page].active')?.closest('.suite-nav-group');
    if (activeGroup) activeGroup.open = true;
    const page = document.body.dataset.workspace || 'editor';
    if (rig.classList.contains('active') !== (page === 'rig'))
      rig.classList.toggle('active', page === 'rig');
    if (page !== lastWorkspace) {
      lastWorkspace = page;
      api()
        ?.workspace(page)
        .catch(() => {});
    }
    const project = $('discordProjectName').value.trim() || getProject(page);
    api()
      ?.project?.(project)
      .catch(() => {});
    $('discordActivityPreview').textContent =
      ($('discordShareWorkspace').checked
        ? $('workspaceLabel').textContent
        : 'Creating with DITASHA Editor') +
      ($('discordShareProject').checked && project ? ' · ' + project : '');
  }
  $('discordProjectName').value = load('projectName', '');
  $('discordProjectName').onchange = () => {
    store('projectName', $('discordProjectName').value);
    workspace();
  };
  $('discordShareProject').onchange = workspace;
  window.addEventListener('ditasha:project', workspace);
  new MutationObserver(workspace).observe(nav, {
    attributes: true,
    subtree: true,
    attributeFilter: ['class'],
  });
  workspace();
  refresh(true);
  const poll = async () => {
    await refresh();
    timer = setTimeout(poll, dialog.open ? 2000 : 15000);
  };
  timer = setTimeout(poll, 15000);
  window.addEventListener('beforeunload', () => clearTimeout(timer));
  // Long explanations stay available without displacing the workspace controls.
  document
    .querySelectorAll('.native-build-layout > aside:first-child > p.muted:not([id])')
    .forEach((p) => {
      const details = document.createElement('details');
      details.className = 'setup-guide';
      const summary = document.createElement('summary');
      summary.textContent = 'Persiapan engine';
      p.before(details);
      details.append(summary, p);
    });
  const vehicleHint = document.querySelector('#vehicleWorkshop > p:not([id])');
  if (vehicleHint) {
    const hint = document.createElement('details');
    hint.className = 'hint-details';
    const summary = document.createElement('summary');
    summary.textContent = 'Petunjuk kendaraan';
    vehicleHint.before(hint);
    hint.append(summary, vehicleHint);
  }
  const credits = document.querySelector('.sidebarbottom [data-icon-credits]');
  if (credits) dialog.querySelector('.settings-section').append(credits);
  return { dialog };
}
