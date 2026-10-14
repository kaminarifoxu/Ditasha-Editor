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
  nav.querySelectorAll('[data-page]').forEach((button) => {
    const label = button.getAttribute('aria-label') || button.textContent.trim();
    button.setAttribute('aria-label', label);
    button.title = label;
  });
  const navTitle = document.createElement('div');
  navTitle.className = 'nav-section-title';
  navTitle.textContent = 'WORKSPACE';
  nav.prepend(navTitle);
  const buildTitle = document.createElement('div');
  buildTitle.className = 'nav-section-title';
  buildTitle.textContent = 'STUDIO';
  nav.append(buildTitle);
  const rig = $('openNativeBuild');
  rig.innerHTML = glyph('tshirt') + '<span class="nav-label">Auto rig ped</span>';
  rig.classList.add('nav-action');
  nav.append(rig);
  const gpu = $('previewPerformance');
  gpu.classList.add('nav-action');
  nav.append(gpu);
  const bottom = document.createElement('div');
  bottom.className = 'nav-bottom';
  bottom.innerHTML = `<button id="openSettings" title="Pengaturan" aria-label="Pengaturan"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 3-1 3-3 1-2 3 2 2-1 3 3 2 1 3h4l1-3 3-1 2-3-2-2 1-3-3-2-1-3H9Z"/><circle cx="10" cy="11" r="3"/></svg><span class="nav-label">Pengaturan</span><span id="discordConnection" class="connection-dot" aria-label="Discord belum diatur"></span></button><small>© 2026 Ditasha-Workshop</small>`;
  nav.append(bottom);
  const dialog = document.createElement('dialog');
  dialog.id = 'settingsDialog';
  dialog.className = 'studio-dialog settings-dialog';
  dialog.innerHTML = `<div class="studio-dialog-head"><div><span class="eyebrow">DITASHA EDITOR</span><h2>Pengaturan</h2></div><button id="settingsClose" aria-label="Tutup">×</button></div><div class="settings-layout"><section class="settings-section"><h3>Tampilan</h3><p class="muted">Atur tampilan workspace sesuai cara kamu bekerja.</p><div class="settings-fields"><label>Tema<select id="appearanceTheme"><option value="midnight">Midnight</option><option value="light">Terang</option></select></label><label>Kepadatan<select id="appearanceDensity"><option value="comfortable">Nyaman</option><option value="compact">Ringkas</option></select></label></div><div class="settings-note">Navigasi ada di kiri. File dan layer mengikuti workspace aktif; kontrol detail berada di panel samping.</div></section><section class="settings-section"><div class="settings-heading"><div><h3>Discord Activity</h3><p class="muted">Tampilkan DITASHA Editor saat aplikasi terbuka.</p></div><label class="switch-label"><input id="discordEnabled" type="checkbox" checked>Aktif</label></div><label>Application ID<input id="discordAppId" inputmode="numeric" maxlength="20" placeholder="Salin Application ID dari Developer Portal" autocomplete="off"></label><label class="check"><input id="discordShareWorkspace" type="checkbox" checked>Tampilkan workspace yang sedang digunakan</label><div class="presence-card"><img src="assets/ditasha-emblem.webp" alt=""><div><span>PLAYING A GAME</span><strong>DITASHA Editor</strong><p id="discordActivityPreview">Texture & Model</p><small>Ditasha-Workshop · waktu berjalan</small></div></div><p class="muted presence-hint">Contoh tampilan. Nama dan ikon aplikasi mengikuti pengaturan aplikasi di Discord.</p><p id="discordSettingsStatus" role="status">Memuat pengaturan Discord…</p><div class="settings-actions"><button id="discordSave" class="primary">Simpan & hubungkan</button><button id="discordRefresh">Periksa koneksi</button></div><details class="setup-guide"><summary>Belum punya Application ID?</summary><ol><li>Buka Developer Portal, buat aplikasi bernama <strong>DITASHA Editor</strong>.</li><li>Salin <strong>Application ID</strong> dari General Information lalu tempel di atas. Ikon aplikasi dapat diunggah pada halaman aplikasi tersebut.</li><li>Buka Discord desktop dan aktifkan berbagi aktivitas pada <strong>Activity Privacy</strong>, lalu simpan pengaturan ini.</li></ol><button id="discordPortal">Buka Discord Developer Portal</button><p class="muted">Application ID adalah ID publik. Tidak perlu bot token, client secret, atau login Discord di editor. Nama file dan lokasi folder tidak dikirim melalui Activity.</p></details></section></div>`;
  document.body.append(dialog);
  $('appearanceTheme').value = document.body.dataset.theme;
  $('appearanceDensity').value = document.body.dataset.density;
  $('appearanceTheme').onchange = () => apply('theme', $('appearanceTheme').value);
  $('appearanceDensity').onchange = () => apply('density', $('appearanceDensity').value);
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
      initialized = true;
    }
    $('discordSettingsStatus').textContent = value.message || '';
    $('discordConnection').dataset.status = value.status || 'setup';
    $('discordConnection').setAttribute('aria-label', value.message || 'Discord');
    $('discordActivityPreview').textContent = $('discordShareWorkspace').checked
      ? $('workspaceLabel').textContent
      : 'Creating with DITASHA Editor';
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
    nav
      .querySelectorAll('[data-page]')
      .forEach((button) =>
        button.setAttribute('aria-current', button.classList.contains('active') ? 'page' : 'false'),
      );
    const page = nav.querySelector('[data-page].active')?.dataset.page || 'editor';
    if (page !== lastWorkspace) {
      lastWorkspace = page;
      api()
        ?.workspace(page)
        .catch(() => {});
    }
    $('discordActivityPreview').textContent = $('discordShareWorkspace').checked
      ? $('workspaceLabel').textContent
      : 'Creating with DITASHA Editor';
  }
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
