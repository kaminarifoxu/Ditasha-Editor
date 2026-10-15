import { mountNativePreview } from './native-preview.js';
export function mountNativeBuild({ toast }) {
  const trigger = document.createElement('button');
  trigger.id = 'openNativeBuild';
  trigger.textContent = 'Rig ped';
  trigger.title = 'Auto rig ped dengan Blender offline';
  document.querySelector('header').insertBefore(trigger, document.getElementById('openUpdates'));
  const dialog = document.createElement('dialog');
  dialog.className = 'studio-dialog native-build-dialog';
  dialog.id = 'nativeBuildDialog';
  dialog.innerHTML = `<div class="studio-dialog-head"><div><span class="eyebrow">OFFLINE · BLENDER ENGINE</span><h2>Game asset build</h2></div><button id="nbClose" aria-label="Tutup">×</button></div><div class="native-build-layout"><aside><h3>1 · Persiapan engine</h3><button id="nbSetup" class="primary">Download & set up</button><p class="muted">Pasang Blender 5.2.2, Sollumz dan Muto otomatis. Download awal sekitar 410 MB + dependency; siapkan ruang kosong 3 GB. Setelah terpasang, rigging berjalan offline.</p><progress id="nbSetupProgress" hidden max="100" value="0" aria-label="Download engine"></progress><button data-pick="engine">Pilih blender.exe</button><p id="nbEngine" class="muted">Belum dipilih</p><button id="nbProbe">Periksa engine & add-on</button><p class="muted">Blender 5.2 direkomendasikan untuk ped; kendaraan 4.2+. Sollumz 2.9 dan dependency native szio/PyMateria. Rigging memerlukan Muto Ped Rig aktif. Instal add-on di Blender sekali; build berikutnya berjalan offline.</p><div class="native-links"><button data-doc="blender">Blender</button><button data-doc="sollumz">Sollumz</button><button data-doc="muto">Muto Ped Rig</button></div><label>Operasi<select id="nbMode"><option value="ped">Auto rig humanoid → ped FiveM</option><option value="debadge">Debadge native · seluruh LOD</option><option value="strobo">Transfer strobo donor → YFT</option></select></label><button data-pick="output">Folder hasil</button><p id="nbOutput" class="muted">Hasil ditulis ke subfolder baru; input asli tidak ditimpa.</p></aside><section><div id="nbPed"><h3>2 · Pilih model humanoid</h3><ol class="muted"><li>Klik Download & set up sekali dan tunggu selesai.</li><li>Pilih model GLB / FBX / OBJ dalam A/T-pose. Untuk OBJ, letakkan MTL dan tekstur di folder yang sama.</li><li>Isi nama ped, lalu pilih Folder hasil di sebelah kiri.</li><li>Klik Build native. Hasil resource dan file .blend tersimpan di subfolder baru.</li><li>Buka folder hasil, pasang resource ke server uji FiveM, lalu tes animasi dan gerak ped.</li></ol><button data-pick="ped">Pilih GLB / FBX / OBJ humanoid</button><p data-file="ped" class="muted">Belum dipilih</p><label>Nama ped<input id="nbPedName" maxlength="32" value="ditasha_ped"></label><p class="muted">Model humanoid berdiri dalam A/T-pose. Engine membuat marker, skeleton, weights, pose GTA dan resource addon. Prop, model non-humanoid dan anatomi yang sulit dapat memerlukan koreksi di .blend. Ini rigging lokal, bukan generator AI dari foto.</p></div><div id="nbVehicle" hidden><button data-pick="vehicle">Pilih YFT dasar kendaraan</button><p data-file="vehicle" class="muted">Taruh _hi.YFT dan YTD pasangannya di folder yang sama.</p></div><div id="nbDebadge" hidden><h3>Debadge native</h3><p class="muted">Analisis nama mesh/material/shader badge dan emblem pada semua LOD. Pilih kandidat yang benar sebelum build; engine menghapus face badge tanpa memotong mesh lain yang memakai material berbeda.</p><button id="nbAnalyze">Analisis badge</button><div id="nbCandidates"></div></div><div id="nbStrobo" hidden><h3>Strobo dari donor</h3><p class="muted">Pilih kendaraan donor dengan mesh rigid terikat ke siren1–20 dan tekstur lampu embedded. Target harus belum memakai bone siren yang sama. Housing, donor skinned dan lampu bertekstur eksternal tidak dipindahkan otomatis.</p><button data-pick="donor">YFT donor</button><p data-file="donor" class="muted">Belum dipilih</p><button data-pick="carcols">carcols.meta donor</button><p data-file="carcols" class="muted">Belum dipilih</p><button data-pick="variations">carvariations.meta target</button><p data-file="variations" class="muted">Belum dipilih</p><button data-pick="vehicles">vehicles.meta target</button><p data-file="vehicles" class="muted">Belum dipilih</p><div class="studio-fields"><label>ID siren baru<input id="nbSirenId" type="number" min="1" max="254" value="100"></label><label>ID donor · 0=auto<input id="nbDonorId" type="number" min="0" max="65534" value="0"></label><label>Offset X · kanan<input id="nbX" type="number" step=".01" value="0"></label><label>Offset Y · depan<input id="nbY" type="number" step=".01" value="0"></label><label>Offset Z · atas<input id="nbZ" type="number" step=".01" value="0"></label><label>Scale<input id="nbScale" type="number" min=".1" max="5" step=".1" value="1"></label></div><p class="muted">Offset memakai sumbu GTA/Blender dalam meter, bukan sumbu preview Three.js. Hasil berupa patch resource; resource kendaraan asli tetap dimuat dahulu. Gunakan ID siren yang tidak berbenturan di server.</p></div><div class="native-actions"><button id="nbRun" class="primary">Build native</button><button id="nbCancel" disabled>Batalkan build</button><button id="nbReveal" disabled>Buka folder hasil</button></div></section><aside><h3>Status build</h3><p id="nbStatus" role="status">Periksa engine sebelum build.</p><div id="nbReport"></div><details><summary>Log engine</summary><pre id="nbLog"></pre></details><p class="muted">File hasil dan report diperiksa sebelum status sukses. Rigging, ekspor native dan kompatibilitas game tetap bergantung pada model dan engine yang terpasang. Tes spawn/animasi/siren pada server uji sebelum digunakan.</p></aside></div>`;
  document.body.append(dialog);
  const $ = (id) => dialog.querySelector('#' + id),
    inputs = {};
  let state = { running: false },
    timer = null,
    requesting = false,
    candidateKey = '',
    loadedPreviewId = null;
  const previewRoot = document.createElement('section');
  previewRoot.className = 'native-preview';
  previewRoot.hidden = true;
  $('nbVehicle').after(previewRoot);
  const selectedNames = () =>
    [...$('nbCandidates').querySelectorAll('input:checked')].map((e) => e.value);
  const preview = mountNativePreview({
    container: previewRoot,
    toast,
    onPick: (name) => {
      const check = [...$('nbCandidates').querySelectorAll('input')].find((e) => e.value === name);
      if (!check || state.running || requesting) return;
      check.checked = !check.checked;
      preview.updateSelection(selectedNames());
    },
    onTransform: (offset) => ['nbX', 'nbY', 'nbZ'].forEach((id, i) => ($(id).value = offset[i])),
  });
  const syncTransform = () =>
    preview.setTransform(
      ['nbX', 'nbY', 'nbZ'].map((id) => Number($(id).value)),
      Number($('nbScale').value),
    );
  for (const id of ['nbX', 'nbY', 'nbZ', 'nbScale']) $(id).addEventListener('input', syncTransform);
  $('nbCandidates').addEventListener('change', () => preview.updateSelection(selectedNames()));
  preview.loadButton.onclick = () =>
    start($('nbMode').value === 'strobo' ? 'strobo_preview' : 'debadge_analyze');
  const api = () => window.ditashaNative;
  function mode() {
    const value = $('nbMode').value;
    $('nbPed').hidden = value !== 'ped';
    $('nbVehicle').hidden = value === 'ped';
    $('nbDebadge').hidden = value !== 'debadge';
    $('nbStrobo').hidden = value !== 'strobo';
    previewRoot.hidden = value === 'ped' || !dialog.open;
    preview.setMode(value);
    syncTransform();
  }
  function draw() {
    $('nbStatus').textContent = state.message || 'Siap.';
    $('nbLog').textContent = state.log || '';
    $('nbSetupProgress').hidden = !state.progress;
    if (state.progress)
      $('nbSetupProgress').value = Math.floor((state.progress.done / state.progress.total) * 100);
    $('nbCancel').textContent = state.status === 'installing' ? 'Batalkan setup' : 'Batalkan build';
    $('nbEngine').textContent = state.engine || $('nbEngine').textContent;
    dialog
      .querySelectorAll('[data-pick],#nbMode,#nbRun,#nbAnalyze,#nbProbe,#nbPreviewLoad,#nbSetup')
      .forEach((e) => (e.disabled = state.running || requesting));
    $('nbCancel').disabled = !state.running;
    $('nbReveal').disabled = !state.output;
    $('nbReport').replaceChildren();
    const report = state.report;
    if (!report) return;
    if (report.engine) {
      const p = document.createElement('p');
      p.className = 'muted';
      p.textContent = `Blender ${report.engine.blender} · Sollumz ${report.engine.sollumz ? 'aktif' : 'belum aktif'} · native ${report.engine.native ? 'tersedia' : 'belum tersedia'} · Muto ${report.engine.muto ? 'aktif' : 'belum aktif'}`;
      $('nbReport').append(p);
    }
    if (state.status === 'error' && report.error) {
      const p = document.createElement('p');
      p.textContent = report.error;
      $('nbReport').append(p);
    }
    for (const warning of report.warnings || []) {
      const p = document.createElement('p');
      p.className = 'muted';
      p.textContent = warning;
      $('nbReport').append(p);
    }
    const nextCandidateKey = JSON.stringify([inputs.vehicle, report.candidates]);
    if (
      ['debadge_analyze', 'strobo_preview'].includes(report.mode) &&
      report.ok &&
      candidateKey !== nextCandidateKey
    ) {
      candidateKey = nextCandidateKey;
      $('nbCandidates').replaceChildren();
      for (const candidate of report.candidates || []) {
        const label = document.createElement('label');
        label.className = 'check';
        const check = document.createElement('input');
        check.type = 'checkbox';
        check.value = candidate.name;
        label.append(
          check,
          document.createTextNode(candidate.name + ' · ' + candidate.faces + ' faces'),
        );
        $('nbCandidates').append(label);
      }
      if (!report.candidates?.length)
        $('nbCandidates').textContent =
          'Tidak ada badge terdeteksi dari nama. Pilih mesh manual di Vehicle workshop jika diperlukan.';
    }
    if (state.previewId && state.previewId !== loadedPreviewId && report.ok && !state.running) {
      const id = state.previewId;
      loadedPreviewId = id;
      api()
        ?.preview(id)
        .then((data) => {
          if (id !== loadedPreviewId) return;
          return preview.load(data).then(() => {
            syncTransform();
            preview.updateSelection(selectedNames());
          });
        })
        .catch((e) => {
          preview.clear();
          toast('Preview: ' + e.message);
        });
    }
  }
  async function refresh() {
    clearTimeout(timer);
    if (!api()) return;
    try {
      state = await api().state();
      draw();
    } catch (e) {
      toast(e.message);
    }
    if (state.running) timer = setTimeout(refresh, 700);
  }
  async function start(task) {
    if (!api()) return toast('Game build tersedia pada aplikasi desktop Windows.');
    if (requesting || state.running) return;
    const selected = [...$('nbCandidates').querySelectorAll('input:checked')].map((e) => e.value);
    requesting = true;
    draw();
    try {
      state = await api().start({
        mode: task,
        name: $('nbPedName').value,
        inputs: { ...inputs },
        selected,
        offset: ['nbX', 'nbY', 'nbZ'].map((id) => Number($(id).value)),
        scale: Number($('nbScale').value),
        sirenId: Number($('nbSirenId').value),
        donorSirenId: Number($('nbDonorId').value),
      });
      clearTimeout(timer);
      await refresh();
    } catch (e) {
      toast(e.message);
      state.message = e.message;
      $('nbStatus').textContent = e.message;
    } finally {
      requesting = false;
      draw();
    }
  }
  dialog.querySelectorAll('[data-pick]').forEach(
    (b) =>
      (b.onclick = async () => {
        if (!api()) return toast('Pemilihan file native tersedia pada aplikasi desktop.');
        try {
          const value = await api().pick(b.dataset.pick);
          if (!value) return;
          if (b.dataset.pick === 'engine') $('nbEngine').textContent = value.name;
          else {
            inputs[b.dataset.pick] = value.id;
            if (b.dataset.pick === 'output') $('nbOutput').textContent = value.name;
            else
              dialog.querySelector('[data-file="' + b.dataset.pick + '"]').textContent = value.name;
          }
          if (['vehicle', 'donor'].includes(b.dataset.pick)) {
            $('nbCandidates').replaceChildren();
            candidateKey = '';
            loadedPreviewId = state.previewId || null;
            preview.clear();
          }
        } catch (e) {
          toast(e.message);
        }
      }),
  );
  dialog.querySelectorAll('[data-doc]').forEach(
    (b) =>
      (b.onclick = () =>
        api()
          ?.docs(b.dataset.doc)
          .catch((e) => toast(e.message))),
  );
  $('nbSetup').onclick = async () => {
    if (!api()?.setup) return toast('Setup otomatis tersedia pada DITASHA desktop terbaru.');
    if (requesting || state.running) return;
    requesting = true;
    draw();
    try {
      state = await api().setup();
      await refresh();
    } catch (error) {
      toast(error.message);
    } finally {
      requesting = false;
      draw();
    }
  };
  $('nbMode').onchange = mode;
  $('nbProbe').onclick = () => start('probe');
  $('nbAnalyze').onclick = () => start('debadge_analyze');
  $('nbRun').onclick = () => start($('nbMode').value);
  $('nbCancel').onclick = async () => {
    await api()?.cancel();
    await refresh();
  };
  $('nbReveal').onclick = () => api()?.reveal();
  $('nbClose').onclick = () => dialog.close();
  dialog.addEventListener('close', () => {
    if (!dialog.open) previewRoot.hidden = true;
  });
  function open(value = 'ped') {
    if (!state.running && !requesting) $('nbMode').value = value;
    if (!dialog.open) dialog.showModal();
    mode();
    refresh();
  }
  trigger.onclick = () => open('ped');
  mode();
  return {
    open,
    unsavedItems: () =>
      state.running
        ? [{ name: 'Native build masih berjalan; menutup aplikasi membatalkan proses.' }]
        : [],
  };
}
