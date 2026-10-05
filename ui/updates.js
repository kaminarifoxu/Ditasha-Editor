(() => {
  const api = window.ganoUpdates;
  if (!api) return;
  const $ = (id) => document.getElementById(id),
    dialog = $('updateDialog');
  let state,
    installing = false,
    installError;
  function render(s) {
    const previous = state?.status;
    state = s;
    installError = s.installError || installError;
    $('updateInstallError').hidden = !installError;
    $('updateInstallError').textContent = installError
      ? 'Pemasangan sebelumnya gagal: ' + installError
      : '';
    $('appVersion').textContent = 'v' + s.version;
    $('updateVersion').textContent = s.availableVersion
      ? `v${s.version} → v${s.availableVersion}`
      : `Versi aplikasi ${s.version}`;
    $('updateStatus').textContent = s.message;
    $('updateAuto').checked = s.autoDownload;
    $('updateAuto').disabled = installing;
    const transfer = ['downloading', 'verifying', 'ready'].includes(s.status),
      busy = installing || ['checking', 'downloading', 'verifying'].includes(s.status);
    $('updateProgress').hidden = !transfer;
    $('updateProgress').value = s.progress;
    $('updateTransfer').textContent = s.totalBytes
      ? `${((s.downloadedBytes || 0) / 1048576).toFixed(1)} / ${(s.totalBytes / 1048576).toFixed(1)} MB · ${s.progress}%`
      : '';
    for (const [id, active] of [
      ['stepDownload', transfer],
      ['stepVerify', ['verifying', 'ready'].includes(s.status)],
      ['stepInstall', installing && s.status === 'ready'],
    ])
      $(id).classList.toggle('active', active);
    $('updateCheck').disabled = busy;
    $('closeUpdates').disabled = installing;
    $('updateDownload').hidden = true;
    $('updateInstall').hidden =
      !s.availableVersion ||
      !['available', 'ready', 'error', 'downloading', 'verifying'].includes(s.status);
    $('updateInstall').disabled = busy;
    $('updateInstall').textContent = installing ? 'Memperbarui…' : 'Update sekarang';
    $('updateBadge').hidden = !s.availableVersion;
    $('updateBadge').textContent =
      s.status === 'ready'
        ? 'Update siap'
        : s.status === 'downloading'
          ? `Unduh ${s.progress}%`
          : 'Update tersedia';
    $('updateNotes').replaceChildren();
    for (const line of String(s.notes || '')
      .split('\n')
      .map((n) => n.replace(/^\s*[-*#]+\s*/, '').trim())
      .filter(Boolean)
      .slice(0, 4)) {
      const li = document.createElement('li');
      li.textContent = line;
      $('updateNotes').append(li);
    }
    if (
      ['available', 'ready'].includes(s.status) &&
      previous !== s.status &&
      !dialog.open &&
      !installing
    )
      dialog.showModal();
  }
  const run = async (task) => {
    try {
      render(await task());
    } catch (e) {
      $('updateStatus').textContent = e.message || 'Update gagal. Coba lagi.';
    }
  };
  $('openUpdates').onclick = () => {
    if (!dialog.open) dialog.showModal();
    run(() => api.getState());
  };
  $('closeUpdates').onclick = () => {
    if (!installing) dialog.close();
  };
  dialog.oncancel = (e) => {
    if (installing) e.preventDefault();
  };
  $('updateCheck').onclick = () => run(() => api.check());
  $('updateInstall').onclick = async () => {
    if (installing) return;
    installing = true;
    render(state);
    try {
      if (await api.updateNow()) {
        $('updateStatus').textContent = 'Helper siap. Menutup editor dan memasang update…';
        return;
      }
    } catch (e) {
      $('updateStatus').textContent = e.message;
    } finally {
      installing = false;
      const message = $('updateStatus').textContent;
      render(state);
      $('updateStatus').textContent = message;
    }
  };
  $('updateAuto').onchange = () => run(() => api.setAutoDownload($('updateAuto').checked));
  api.subscribe(render);
  run(() => api.getState());
})();
