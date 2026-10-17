import { mountDebadge } from './debadge-ui.js';
import { setProject } from './project-context.js';
import { mountNativePreview } from './native-preview.js';
export function mountNativeBuild({
  toast,
  activate,
  attach,
  confirmDiscard,
  download,
  getVehicleSource,
}) {
  const trigger = document.createElement('button');
  trigger.id = 'openNativeBuild';
  trigger.textContent = 'Rig ped';
  trigger.title = 'Auto rig ped dengan Blender offline';
  document.querySelector('header').insertBefore(trigger, document.getElementById('openUpdates'));
  const dialog = document.createElement('section');
  dialog.className = 'native-build-workspace';
  dialog.hidden = true;
  dialog.id = 'nativeBuildDialog';
  dialog.innerHTML = `<div class="studio-dialog-head"><div><span class="eyebrow">OFFLINE · BLENDER ENGINE</span><h2 id="nbTitle">Auto rig ped</h2></div><button id="nbClose" aria-label="Kembali ke workspace">Kembali</button></div><div class="native-build-layout"><aside><h3>1 · Persiapan engine</h3><button id="nbSetup" class="primary">Download & set up</button><p class="muted">Pasang Blender 5.2.2, Sollumz dan Muto otomatis. Download awal sekitar 410 MB + dependency; siapkan ruang kosong 3 GB. Setelah terpasang, rigging berjalan offline.</p><progress id="nbSetupProgress" hidden max="100" value="0" aria-label="Download engine"></progress><button data-pick="engine">Pilih blender.exe</button><p id="nbEngine" class="muted">Belum dipilih</p><button id="nbProbe">Periksa engine & add-on</button><p class="muted">Blender 5.2 direkomendasikan untuk ped; kendaraan 4.2+. Sollumz 2.9 dan dependency native szio/PyMateria. Rigging memerlukan Muto Ped Rig aktif. Instal add-on di Blender sekali; build berikutnya berjalan offline.</p><div class="native-links"><button data-doc="blender">Blender</button><button data-doc="sollumz">Sollumz</button><button data-doc="muto">Muto Ped Rig</button></div><label hidden>Operasi<select id="nbMode"><option value="ped">Auto rig humanoid → ped FiveM</option><option value="debadge">Debadge native · seluruh LOD</option><option value="strobo">Transfer strobo donor → YFT</option></select></label><button data-pick="output">Folder hasil</button><p id="nbOutput" class="muted">Hasil ditulis ke subfolder baru; input asli tidak ditimpa.</p></aside><section><div id="nbPed"><h3>2 · Pilih model humanoid</h3><details class="rig-guide"><summary>Cara pakai Auto Rig</summary><ol class="muted"><li>Klik Download & set up sekali dan tunggu selesai.</li><li>Pilih model GLB / FBX / OBJ dalam A/T-pose. Untuk OBJ, letakkan MTL dan tekstur di folder yang sama.</li><li>Isi nama ped dan klik Buat preview rig.</li><li>Periksa hasil rig di preview 3D. Model belum disimpan ke folder tujuan.</li><li>Klik Simpan hasil ped untuk memilih folder tujuan. Tes animasi ped pada server FiveM uji.</li></ol></details><button data-pick="ped">Pilih GLB / FBX / OBJ humanoid</button><p data-file="ped" class="muted">Belum dipilih</p><label>Nama ped<input id="nbPedName" maxlength="32" value="ditasha_ped"></label><p class="muted">Gunakan humanoid dalam A/T-pose. Preview hasil rig sebelum disimpan; koreksi lanjutan tersedia di file .blend.</p></div><div id="nbVehicle" hidden><button data-pick="vehicle">Pilih YFT dasar kendaraan</button><p data-file="vehicle" class="muted">Taruh _hi.YFT dan YTD pasangannya di folder yang sama.</p></div><div id="nbDebadge" hidden><h3>Debadge native</h3><p class="muted">Analisis nama mesh/material/shader badge dan emblem pada semua LOD. Pilih kandidat yang benar sebelum build; engine menghapus face badge tanpa memotong mesh lain yang memakai material berbeda.</p><button id="nbAnalyze">Analisis badge</button><div id="nbCandidates"></div></div><div id="nbStrobo" hidden><h3>Strobo dari donor</h3><p class="muted">Pilih kendaraan donor dengan mesh rigid terikat ke siren1–20 dan tekstur lampu embedded. Target harus belum memakai bone siren yang sama. Housing, donor skinned dan lampu bertekstur eksternal tidak dipindahkan otomatis.</p><button data-pick="donor">YFT donor</button><p data-file="donor" class="muted">Belum dipilih</p><button data-pick="carcols">carcols.meta donor</button><p data-file="carcols" class="muted">Belum dipilih</p><button data-pick="variations">carvariations.meta target</button><p data-file="variations" class="muted">Belum dipilih</p><button data-pick="vehicles">vehicles.meta target</button><p data-file="vehicles" class="muted">Belum dipilih</p><div class="studio-fields"><label>ID siren baru<input id="nbSirenId" type="number" min="1" max="254" value="100"></label><label>ID donor · 0=auto<input id="nbDonorId" type="number" min="0" max="65534" value="0"></label><label>Offset X · kanan<input id="nbX" type="number" step=".01" value="0"></label><label>Offset Y · depan<input id="nbY" type="number" step=".01" value="0"></label><label>Offset Z · atas<input id="nbZ" type="number" step=".01" value="0"></label><label>Scale<input id="nbScale" type="number" min=".1" max="5" step=".1" value="1"></label></div><p class="muted">Offset memakai sumbu GTA/Blender dalam meter, bukan sumbu preview Three.js. Hasil berupa patch resource; resource kendaraan asli tetap dimuat dahulu. Gunakan ID siren yang tidak berbenturan di server.</p></div><div class="native-actions"><button id="nbRun" class="primary">Build native</button><button id="nbCancel" disabled>Batalkan build</button><button id="nbSave" class="primary" disabled>Simpan hasil ped</button><button id="nbDiscard" disabled>Buang hasil sementara</button><button id="nbReveal" disabled>Buka folder hasil</button></div></section><aside><h3>Status build</h3><p id="nbStatus" role="status">Periksa engine sebelum build.</p><div id="nbReport"></div><details><summary>Log engine</summary><pre id="nbLog"></pre></details><p class="muted">File hasil dan report diperiksa sebelum status sukses. Rigging, ekspor native dan kompatibilitas game tetap bergantung pada model dan engine yang terpasang. Tes spawn/animasi/siren pada server uji sebelum digunakan.</p></aside></div>`;
  document.body.append(dialog);
  const rigSettings = document.createElement('details');
  rigSettings.className = 'rig-settings';
  rigSettings.open = true;
  rigSettings.innerHTML = `<summary>Referensi tubuh & kualitas rig</summary><div class="studio-fields"><label>Referensi weights<select id="nbReference"><option value="auto">Auto · paling sesuai</option><option value="mp_m">Laki-laki · freemode</option><option value="mp_f">Perempuan · freemode</option></select></label><label>Tinggi target · meter<input id="nbHeight" type="number" min="0" max="3" step="0.01" value="0"></label></div><p class="muted">0 = ikuti ukuran model setelah koreksi unit engine. Tinggi khusus: 0,5–3 m. Semua pilihan memakai skeleton humanoid GTA; referensi mengatur sumber transfer weights.</p><div class="rig-option-grid"><label class="check"><input id="nbFingers" type="checkbox" checked>Rig jari</label><label class="check"><input id="nbFace" type="checkbox" checked>Rig wajah</label><label class="check"><input id="nbHandTemplate" type="checkbox" checked>Template tangan</label><label class="check"><input id="nbFaceTemplate" type="checkbox" checked>Template wajah</label><label class="check"><input id="nbHeadParts" type="checkbox" checked>Rambut/topi ikut kepala</label></div><p class="muted">Template tangan mengikuti opsi jari; template wajah mengikuti opsi wajah. LOD dibuat otomatis. Model anak atau proporsi ekstrem tetap perlu pemeriksaan marker dan weights.</p>`;
  dialog.querySelector('#nbPed').append(rigSettings);
  const debadge = mountDebadge({
    download,
    toast,
    confirmDiscard,
    back: () => {
      attach(debadge.root, '');
      activate('vehicles');
    },
  });
  document.body.append(debadge.root);
  const $ = (id) => dialog.querySelector('#' + id),
    inputs = {};
  let state = { running: false },
    timer = null,
    requesting = false,
    candidateKey = '',
    loadedPreviewId = null,
    poseSerial = 0,
    previewReady = false,
    displayedMode = 'ped';
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
  const poseControls = document.createElement('div');
  poseControls.className = 'rig-pose-controls';
  poseControls.hidden = true;
  poseControls.innerHTML =
    '<label>Pose uji<select id="nbPedPose"><option value="rest">Pose awal</option></select></label><span class="muted">Pose statis untuk memeriksa deformasi weights. Periksa juga gerakan di FiveM.</span>';
  previewRoot.prepend(poseControls);
  const poseSelect = $('nbPedPose');
  async function loadPreview(id, pose = 'rest', preserveCamera = false) {
    const serial = ++poseSerial;
    previewReady = false;
    $('nbSave').disabled = true;
    try {
      const data = await api().preview(id, pose);
      if (serial !== poseSerial || id !== loadedPreviewId || id !== state.previewId) return;
      await preview.load(data, { preserveCamera });
      if (serial !== poseSerial || id !== loadedPreviewId) return;
      syncTransform();
      preview.updateSelection(selectedNames());
      previewReady = true;
      draw();
    } catch (e) {
      if (serial !== poseSerial) return;
      preview.clear();
      previewReady = false;
      toast('Preview: ' + e.message);
    }
  }
  poseSelect.onchange = () =>
    loadedPreviewId && loadPreview(loadedPreviewId, poseSelect.value, true);
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
  const matchesPreview = () => {
    const value = $('nbMode').value;
    return (
      state.report?.mode ===
      (value === 'ped' ? 'ped' : value === 'strobo' ? 'strobo_preview' : 'debadge_analyze')
    );
  };
  function mode() {
    const value = $('nbMode').value;
    if (value !== displayedMode) {
      preview.clear();
      loadedPreviewId = null;
      ++poseSerial;
      previewReady = false;
      displayedMode = value;
    }
    $('nbPed').hidden = value !== 'ped';
    $('nbVehicle').hidden = value === 'ped';
    $('nbDebadge').hidden = value !== 'debadge';
    $('nbStrobo').hidden = value !== 'strobo';
    previewRoot.hidden =
      dialog.hidden || (value === 'ped' && (!state.previewId || !matchesPreview()));
    $('nbTitle').textContent =
      value === 'ped'
        ? 'Auto rig ped'
        : value === 'debadge'
          ? 'Debadge kendaraan'
          : 'Strobo dari donor';
    $('nbRun').textContent = value === 'ped' ? 'Buat preview rig' : 'Build native';
    $('nbSave').hidden = $('nbDiscard').hidden = value !== 'ped';
    dialog.querySelector('[data-pick=output]').hidden = value === 'ped';
    $('nbOutput').hidden = value === 'ped';
    preview.loadButton.hidden = value === 'ped';
    preview.setMode(value);
    if (value === 'ped' && state.previewId && matchesPreview()) $('nbPed').before(previewRoot);
    else $('nbVehicle').after(previewRoot);
    syncTransform();
  }
  function draw() {
    $('nbStatus').textContent = (state.message || 'Siap.').split(/Traceback|\r?\n/)[0];
    $('nbLog').textContent = state.log || '';
    $('nbSetupProgress').hidden = !state.progress;
    if (state.progress)
      $('nbSetupProgress').value = Math.floor((state.progress.done / state.progress.total) * 100);
    $('nbCancel').textContent = state.status === 'installing' ? 'Batalkan setup' : 'Batalkan build';
    $('nbEngine').textContent = state.engine || $('nbEngine').textContent;
    dialog
      .querySelectorAll('[data-pick],#nbMode,#nbRun,#nbAnalyze,#nbProbe,#nbPreviewLoad,#nbSetup')
      .forEach((e) => (e.disabled = state.running || requesting));
    rigSettings
      .querySelectorAll('input,select')
      .forEach((e) => (e.disabled = state.running || requesting || !!state.stagedId));
    $('nbHandTemplate').disabled ||= !$('nbFingers').checked;
    $('nbFaceTemplate').disabled ||= !$('nbFace').checked;
    poseSelect.disabled = state.running;
    $('nbCancel').disabled = !state.running;
    $('nbReveal').disabled = !state.output;
    $('nbSave').disabled =
      state.running || requesting || !state.stagedId || !state.previewId || !previewReady;
    $('nbDiscard').disabled = state.running || requesting || !state.stagedId;
    if ($('nbMode').value === 'ped')
      previewRoot.hidden = !state.previewId || !matchesPreview() || dialog.hidden;
    $('nbReport').replaceChildren();
    const report = state.report;
    poseControls.hidden = $('nbMode').value !== 'ped' || !report?.preview?.poses?.length;
    if (!report) return;
    if (report.engine) {
      const p = document.createElement('p');
      p.className = 'muted';
      p.textContent = `Blender ${report.engine.blender} · Sollumz ${report.engine.sollumz ? 'aktif' : 'belum aktif'} · native ${report.engine.native ? 'tersedia' : 'belum tersedia'} · Muto ${report.engine.muto ? 'aktif' : 'belum aktif'}`;
      $('nbReport').append(p);
    }
    if (report.pedOptions) {
      const p = document.createElement('p');
      p.textContent =
        'Referensi: ' +
        ({ auto: 'Auto', mp_m: 'Laki-laki', mp_f: 'Perempuan' }[report.pedOptions.reference] ||
          'Auto') +
        ' · Tinggi: ' +
        (report.pedOptions.height ? report.pedOptions.height + ' m' : 'ukuran model');
      $('nbReport').append(p);
    }
    if (report.rigging?.steps) {
      const details = document.createElement('details'),
        summary = document.createElement('summary'),
        list = document.createElement('ul');
      summary.textContent = 'Tahap rig dari engine';
      const labels = {
        strip: 'Siapkan model',
        orient: 'Orientasi dan skala',
        markers: 'Marker anatomi',
        fit: 'Fit skeleton',
        weights: 'Transfer weights',
        gta_rest: 'Pose dasar GTA',
        validate: 'Validasi',
        export: 'Ekspor native',
      };
      for (const [key, value] of Object.entries(report.rigging.steps)) {
        const item = document.createElement('li');
        item.textContent =
          (labels[key] || key) +
          ' · ' +
          (value === 'FINISHED' ? 'Selesai' : value === 'SKIPPED' ? 'Dilewati' : 'Perlu diperiksa');
        list.append(item);
      }
      details.append(summary, list);
      $('nbReport').append(details);
    }
    if (report.quality) {
      const q = report.quality,
        list = document.createElement('dl');
      list.className = 'rig-quality';
      for (const [label, value] of [
        ['Vertex diperiksa', q.vertices],
        ['Tulang', q.bones],
        ['Tanpa weights', q.unweighted],
        ['Lebih dari 4 pengaruh', q.overFour],
        ['Total weights bermasalah', q.unnormalized],
        ['Weights tidak valid', q.invalidWeights],
      ]) {
        const term = document.createElement('dt'),
          description = document.createElement('dd');
        term.textContent = label;
        description.textContent = Number(value || 0).toLocaleString('id-ID');
        list.append(term, description);
      }
      const guide = document.createElement('p');
      guide.className = 'muted';
      guide.textContent =
        'Setelah disimpan, .blend hasil tersedia untuk koreksi marker, weight painting, material dan LOD di Blender. Perubahan .blend perlu diekspor ulang untuk memperbarui file game.';
      $('nbReport').append(list, guide);
    }
    if (state.reviewId && api()?.saveReview) {
      const copy = document.createElement('button');
      copy.textContent = 'Salin .blend untuk koreksi';
      copy.disabled = state.running || requesting;
      copy.onclick = async () => {
        if (requesting || state.running) return;
        const id = state.reviewId;
        requesting = true;
        draw();
        try {
          if (await api().saveReview(id))
            toast(
              'Proyek Blender disalin. Koreksi weights/material, lalu ekspor ulang dari Blender.',
            );
        } catch (e) {
          toast(e.message);
        } finally {
          requesting = false;
          draw();
        }
      };
      $('nbReport').append(copy);
    }
    if (state.status === 'error' && report.error) {
      const p = document.createElement('p');
      p.textContent = report.error.split(/Traceback|\r?\n/)[0];
      const details = document.createElement('details'),
        summary = document.createElement('summary'),
        pre = document.createElement('pre'),
        save = document.createElement('button');
      summary.textContent = 'Full error details';
      pre.className = 'native-error-details';
      pre.textContent = report.error + '\n' + (report.traceback || '') + '\n' + (state.log || '');
      save.textContent = 'Save error report';
      save.onclick = () =>
        download?.(
          new TextEncoder().encode(JSON.stringify({ report, log: state.log }, null, 2)),
          'ditasha-native-error.json',
          'application/json',
        );
      details.append(summary, pre, save);
      $('nbReport').append(p, details);
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
    if (
      state.previewId &&
      state.previewId !== loadedPreviewId &&
      report.ok &&
      !state.running &&
      matchesPreview()
    ) {
      const id = state.previewId;
      loadedPreviewId = id;
      if ($('nbMode').value === 'ped') {
        rigSettings.open = false;
        $('nbPed').before(previewRoot);
      }
      const poses = (report.preview?.poses || [{ id: 'rest', label: 'Pose awal' }]).filter((p) =>
        ['rest', 'arms', 'legs'].includes(p.id),
      );
      poseSelect.replaceChildren(
        ...poses.map((p) => {
          const option = document.createElement('option');
          option.value = p.id;
          option.textContent = p.label;
          return option;
        }),
      );
      poseSelect.value = 'rest';
      loadPreview(id);
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
    if (state.stagedId) {
      toast('Simpan atau buang hasil preview sebelumnya sebelum memulai proses baru.');
      return;
    }
    const selected = [...$('nbCandidates').querySelectorAll('input:checked')].map((e) => e.value);
    requesting = true;
    draw();
    try {
      state = await api().start({
        mode: task,
        name: $('nbPedName').value,
        pedOptions: {
          reference: $('nbReference').value,
          height: Number($('nbHeight').value),
          fingers: $('nbFingers').checked,
          face: $('nbFace').checked,
          handTemplate: $('nbHandTemplate').checked,
          faceTemplate: $('nbFaceTemplate').checked,
          headParts: $('nbHeadParts').checked,
        },
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
          if (['ped', 'vehicle'].includes(b.dataset.pick))
            setProject(b.dataset.pick === 'ped' ? 'rig' : 'vehicles', value.name);
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
  $('nbClose').onclick = () => {
    const ped = $('nbMode').value === 'ped';
    attach(dialog, '');
    activate(ped ? 'home' : 'vehicles');
  };
  $('nbSave').onclick = async () => {
    if (!state.stagedId || requesting || !previewReady) return;
    requesting = true;
    draw();
    try {
      await api().save(state.stagedId);
      await refresh();
    } catch (error) {
      toast(error.message);
    } finally {
      requesting = false;
      draw();
    }
  };
  $('nbDiscard').onclick = async () => {
    if (!state.stagedId || requesting) return;
    if (
      confirmDiscard &&
      (await confirmDiscard('file', [{ name: 'Hasil rig belum disimpan' }])) !== 'discard'
    )
      return;
    try {
      await api().discard(state.stagedId);
      loadedPreviewId = null;
      ++poseSerial;
      previewReady = false;
      preview.clear();
      await refresh();
    } catch (error) {
      toast(error.message);
    }
  };
  function open(value = 'ped') {
    if (value === 'debadge') {
      if (state.running || state.stagedId) return toast('Finish or save the native build first.');
      attach(debadge.root, 'debadge');
      activate('vehicles');
      debadge.show(getVehicleSource?.());
      return;
    }
    if ((state.running || state.stagedId) && value !== $('nbMode').value)
      return toast('Selesaikan proses atau simpan hasil preview sebelum mengganti operasi.');
    if (!state.running && !requesting) $('nbMode').value = value;
    attach(dialog, value);
    activate(value === 'ped' ? 'rig' : 'vehicles');
    mode();
    refresh();
  }
  $('nbPedName').oninput = () => setProject('rig', $('nbPedName').value);
  $('nbFingers').onchange = $('nbFace').onchange = () => draw();
  trigger.onclick = () => open('ped');
  mode();
  return {
    open,
    root: dialog,
    unsavedItems: () => [
      ...debadge.unsavedItems(),
      ...(state.running
        ? [{ name: 'Native build masih berjalan; menutup aplikasi membatalkan proses.' }]
        : state.stagedId
          ? [{ name: 'Hasil rig belum disimpan' }]
          : []),
    ],
  };
}
