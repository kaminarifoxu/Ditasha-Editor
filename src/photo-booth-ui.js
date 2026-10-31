import { applyMorphPack } from './freemode-morph-pack.js';
import { resolveCharacterBodyEntries } from './freemode-character-source.js';
import { transferSkinWeights } from './booth-weight-transfer.js';
import { resolveOutfitEntries, freemodeImportName } from './clothing-outfit-files.js';
import { mountFreemodeCharacter } from './freemode-character.js';
import { outfitLayerWarnings } from './booth-clipping-check.js';
import { createEmoteVault } from './emote-vault.js';
import { expandEmoteFiles } from './emote-import.js';
import { createEmoteCatalog } from './emote-catalog.js';
import { parseTextureParents, isTextureParentFile } from './texture-parents.js';
import { setVehicleLivery, liveryReference } from './vehicle-livery.js';
import { mountBoothMovie } from './booth-movie-ui.js';
import { MOVIE_DEFAULTS } from './booth-movie.js';
import { createBoothFisheye } from './booth-fisheye.js';
import { recordBoothVideo } from './booth-video.js';
import { mountEmotePicker } from './booth-emote-picker.js';
import { createBoothViewCulling } from './booth-view-culling.js';
import { installedStudioFiles } from './gta-install-ui.js';
import { expandStudioFiles, prepareStudioPack, buildMapStudio } from './booth-map-studio.js';
import {
  resolveBoothTexture,
  replaceBoothTextureScope,
  vehicleTextureTarget,
} from './booth-textures.js';
import { vehicleModManifest, groupBoothVehicles, vehiclePreviewIndices } from './booth-vehicles.js';
import {
  isRigidBoothProp,
  findBoothAttachmentBone,
  createBoothGrip,
  updateBoothGrip,
} from './booth-attachments.js';
import { GTA_HAND_PROPS } from './booth-props.js';
import { applyBoothMatte } from './booth-look.js';
import { BOOTH_STUDIOS, createBoothStudio, disposeBoothStudio } from './booth-studio.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { readYcd, ycdAnimationClip } from './ycd.js';
import { freemodeFamily, selectBoothRig } from './booth-rig.js';
import { boothHeight, setBoothHeight, setBoothElevation } from './booth-transform.js';
import {
  MAX_BOOTH_MODELS,
  MAX_BOOTH_VERTICES,
  MAX_BOOTH_MODEL_BYTES,
  OUTFIT_CATEGORIES,
  outfitCategory,
  outfitTextureTarget,
  outfitLabel,
  boothVertexCount,
} from './booth-outfits.js';
import { MAX_DECODED_TEXTURE_BYTES } from './texture-memory.js';
import { createBoothLibrary, validateBoothScene } from './booth-library.js';
import { createActorMotion, actorForAsset, advanceActorMotion } from './booth-actors.js';
import * as THREE from 'three';
import { photoshootPoints, fitPhotoshoot } from './photoshoot-framing.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { decodeResource } from './resource-client.js';
import { defaultDrawableSelection } from './drawable-selection.js';
import { createModelMaterial, surfaceReferences, setSurfaceMaps } from './vehicle-surface.js';
import { modelPreviewAlpha, modelAlphaMode } from './model-material.js';
import {
  loadVehicleTextures,
  modelTextureReferences,
  mergeVehicleTextures,
} from './vehicle-textures.js';
import { imageData } from './converter.js';
import {
  BOOTH_POSES,
  boothBoneRole,
  captureBoothRest,
  applyBoothPose,
} from './photo-booth-pose.js';
import { ICON_CODES } from './ui-icons.js';

export function mountPhotoBooth({ nav, activate, download, toast }) {
  const button = document.createElement('button');
  button.dataset.page = 'photobooth';
  button.innerHTML = `<i class="di-icon" aria-hidden="true" data-icon="camera" data-glyph="${String.fromCodePoint(parseInt(ICON_CODES.camera, 16))}"></i><span>Photo Booth</span>`;
  button.onclick = () => activate('photobooth');
  nav.append(button);
  const root = document.createElement('section');
  root.className = 'photo-booth-workspace';
  root.hidden = true;
  root.innerHTML = `<div class="pb-heading"><div><span class="eyebrow">DITASHA / OFFLINE PHOTO BOOTH</span><h1>Photo Booth</h1><p class="muted">Ped, outfit dan aksesori · pose, atur kamera, ambil foto.</p></div><button id="pbCapture" class="primary" disabled>▣ Simpan PNG</button></div>
  <div class="pb-layout"><aside class="pb-panel pb-assets"><h2>Model & outfit</h2><div class="pb-buttons"><button id="pbPed">+ Ped / tubuh</button><button id="pbClothes">+ Outfit / batch</button><button id="pbSavedOutfits">+ Outfit tersimpan</button><button id="pbSavedCharacters">+ Karakter tersimpan</button><button id="pbVehicle">+ Kendaraan</button><button id="pbVehicleFolder">+ Folder kendaraan</button><button id="pbVehiclePart">+ Part kendaraan</button><input id="pbVehicleFolderInput" type="file" webkitdirectory multiple hidden><button id="pbAccessory">+ Aksesori</button><button id="pbProp">+ Prop tangan</button><button id="pbTextures">+ Tekstur</button></div><details><summary>Referensi prop GTA V</summary><input id="pbPropSearch" placeholder="Cari nama prop…"><select id="pbPropCatalog" size="6"></select><p class="muted">Daftar nama, bukan model bawaan. Ekspor YDR + YTD dari GTA V milikmu, lalu + Prop tangan. Pilih tangan pada kartu file.</p><a href="https://github.com/haarperr/Full-GTA-V-Props-List" target="_blank" rel="noreferrer">Sumber daftar prop</a></details><input id="pbInput" type="file" accept=".ydd,.ydr,.yft,.ytd,.glb,.meta" multiple hidden><input id="pbReplaceYtdInput" type="file" accept=".ytd" hidden><input id="pbTextureInput" type="file" accept=".ytd,.dds,.png,.jpg,.jpeg,.webp" multiple hidden><p class="muted">Masukkan YDD + YTD. YFT skeleton pendamping dapat ditambahkan. GLB rigged juga didukung.</p><details class="pb-outfit-import" open><summary>Kategori outfit & impor folder</summary><div id="pbOutfitButtons" class="pb-outfit-grid"></div><label>Kategori folder / drag & drop<select id="pbImportCategory"><option value="auto">Otomatis dari nama GTA</option>${OUTFIT_CATEGORIES.map(([id, label]) => `<option value="${id}">${label}</option>`).join('')}</select></label><button id="pbFolder">+ Folder outfit</button><input id="pbFolderInput" type="file" webkitdirectory multiple hidden></details><p id="pbModelCount" class="muted" role="status">0 / ${MAX_BOOTH_MODELS} model</p><p class="muted">100 model · 64 MB per model · 1 GB file model per scene. Batas tekstur decoded 1 GB.</p><label>Filter bagian<select id="pbCategoryFilter"><option value="all">Semua bagian</option><option value="ped">Ped / tubuh</option><option value="vehicle">Kendaraan</option>${OUTFIT_CATEGORIES.map(([id, label]) => `<option value="${id}">${label}</option>`).join('')}</select></label><input id="pbAssetSearch" placeholder="Cari model / outfit…" aria-label="Cari model Photo Booth"><div class="pb-buttons pb-group-actions"><button id="pbCollapseGroups">Ciutkan semua</button><button id="pbExpandGroups">Buka semua</button></div><div id="pbAssets"></div><p id="pbEmpty">Belum ada model. Mulai dari ped / tubuh milikmu.</p><button id="pbClear">Kosongkan booth</button><h2 class="pb-library-heading">Library lokal</h2><p class="muted">Preset maksimal 512 MB, termasuk file sumber dan tekstur.</p><label>Nama preset<input id="pbLibraryName" maxlength="80" placeholder="Foto grup / outfit favorit"></label><button id="pbLibrarySave">Simpan scene & outfit</button><button id="pbLibraryRefresh">Muat daftar library</button><input id="pbLibrarySearch" placeholder="Cari preset ped / outfit…" aria-label="Cari library"><div id="pbLibraryList"></div></aside>
  <section class="pb-stage"><div class="pb-stage-toolbar"><button id="pbFit">Lihat semua ped</button><button id="pbMove" aria-pressed="false">Atur posisi</button><label class="pb-stage-picker">Alat<select id="pbTransformMode" aria-label="Mode transform"><option value="translate">Geser</option><option value="rotate">Putar</option></select></label><label class="pb-stage-picker">Objek<select id="pbStageActor" aria-label="Objek di viewport, dikelompokkan menurut jenis"></select></label><label class="check"><input id="pbSnap" type="checkbox">Snap 10 cm</label><button id="pbFullscreen" aria-pressed="false">Layar penuh</button><button id="pbStageCapture">Simpan PNG</button><button id="pbMovieToggle">Video & keyframe</button><button id="pbPedToggle" hidden aria-controls="pbPedBody" aria-expanded="true">Ped & outfit</button><button id="pbEmoteToggle" hidden aria-controls="pbEmotePlayer" aria-expanded="true">Emote player</button><label class="pb-stage-picker">Set<select id="pbStageStudio" aria-label="Set studio di viewport">${BOOTH_STUDIOS.map(([id, label]) => `<option value="${id}">${label}</option>`).join('')}</select></label><button id="pbFront">Depan</button><button id="pbBack">Belakang</button><label class="check"><input id="pbFloor" type="checkbox" checked>Grid (polos)</label><span>Orbit: drag · pindah: panah X/Y/Z · scroll: zoom</span></div><div id="pbViewport"></div><section id="pbPedPanel" class="pb-emote-player pb-ped-panel" role="region" aria-label="Ped dan outfit fullscreen" hidden><div class="pb-emote-header"><div><strong>Ped & outfit</strong></div><button id="pbPedMinimize" aria-controls="pbPedBody" aria-expanded="true">Minimalkan</button></div><div id="pbPedBody" class="pb-ped-body"></div></section><section id="pbEmotePlayer" class="pb-emote-player" role="region" aria-label="Emote player fullscreen" hidden><div class="pb-emote-header"><div><strong>Emote player</strong><span id="pbEmoteSummary"></span></div><button id="pbEmotePlay" aria-label="Putar emote ped terpilih">▶</button><button id="pbEmoteMinimize" aria-controls="pbEmoteBody" aria-expanded="true" title="Minimalkan emote player">Minimalkan</button></div><div id="pbEmoteBody" class="pb-panel pb-emote-body"></div></section><p id="pbStatus" role="status">Siap untuk sesi foto offline.</p><button id="pbShowIssues" hidden>Lihat masalah</button></section>
  <aside class="pb-panel pb-settings"><h2>Pose & emote per ped</h2><label>Ped / kendaraan yang diatur<select id="pbActor"></select></label><p class="muted">Pose, tinggi dan outfit mengikuti ped yang dipilih.</p><fieldset class="pb-ped-sizing"><legend>Posisi & ukuran objek terpilih</legend><label>Rotasi Y · derajat<input id="pbYaw" type="number" min="-360" max="360" step="5"></label><label class="check"><input id="pbMatte" type="checkbox">Matte tubuh / wajah</label><label>Kiri / kanan · cm<input id="pbPositionX" type="number" min="-10000" max="10000" step="1"></label><label>Depan / belakang · cm<input id="pbPositionZ" type="number" min="-10000" max="10000" step="1"></label><label>Tinggi grup ped · cm<input id="pbHeightCm" type="number" min="1" max="1000" step="1"></label><label>Naik / turun · cm<input id="pbElevationCm" type="number" min="-10000" max="10000" step="1" value="0"></label><p class="muted">Seluruh outfit ikut berubah. Kamera tetap; gunakan Fit tubuh bila perlu.</p></fieldset><details class="pb-rig-settings"><summary>Skeleton / acuan (opsional)</summary><label>Skeleton acuan<select id="pbRigSource"><option value="auto">Otomatis · model / freemode</option><option value="freemode-male">Freemode laki-laki</option><option value="freemode-female">Freemode perempuan</option><option value="reference">Dari file skeleton acuan</option></select></label><button id="pbReference">+ Skeleton YFT / YDD</button><input id="pbReferenceInput" type="file" accept=".yft,.ydd,.ydr" multiple hidden></details><label>Pose<select id="pbPose">${BOOTH_POSES.map(([id, label]) => `<option value="${id}">${label}</option>`).join('')}<option value="clip">Custom emote · YCD / GLB</option></select></label><div id="pbQuickPose" class="pb-buttons pb-quick-pose"><button data-quick-pose="walk">Berjalan</button><button data-quick-pose="dance">Dance</button><button data-quick-pose="wave">Lambaikan</button></div><div class="pb-buttons"><button id="pbPlay" disabled>▶ Putar</button><button id="pbResetPose">Reset pose</button><button id="pbPlayAll">Putar semua</button><button id="pbPauseAll">Jeda semua</button></div><label>Kecepatan<input id="pbSpeed" type="number" min="0.1" max="3" step="0.1" value="1"></label><label>Frame / waktu <output id="pbTimeLabel">0.00 s</output><input id="pbTime" type="range" min="0" max="4" step="0.01" value="0"></label><button id="pbImportClip">+ Emote YCD / GLB / ZIP</button><input id="pbClipInput" type="file" accept=".ycd,.glb,.zip" multiple hidden><div id="pbClipField" hidden><label>Cari emote<input id="pbClipSearch" type="search" placeholder="Nama file / emote…"></label><span>Clip</span><select id="pbClip" aria-label="Clip emote"></select></div><p id="pbRigStatus" class="muted" role="status">Pose memerlukan skeleton dan skin weights yang cocok.</p><details id="pbIssues" hidden><summary id="pbIssueSummary">Periksa masalah</summary><p class="muted">Skeleton: pilih acuan atau impor YFT/YDD yang cocok. Tekstur: tambahkan YTD atau pilih penggantian preview di kartu model.</p><ul id="pbIssueList"></ul></details><h2>Studio</h2><label class="check"><input id="pbViewCulling" type="checkbox" checked>Lewati objek studio di luar kamera</label><small id="pbCullStats" class="muted"></small><div class="pb-buttons"><button id="pbImportStudio">+ ZIP studio / MLO</button><button id="pbStudioFolder">+ Folder studio</button><button id="pbGtaStudio">Dari instalasi GTA V</button></div><input id="pbStudioZipInput" type="file" accept=".zip" multiple hidden><input id="pbStudioFolderInput" type="file" webkitdirectory multiple hidden><p id="pbStudioPackStatus" class="muted">Impor resource YMAP + YTYP + YDR/YDD + YTD. Set tetap diam saat ped dipindahkan.</p><details id="pbCustomStudioSettings" hidden><summary>Pengaturan studio impor</summary><label class="check"><input id="pbStudioCutaway" type="checkbox" checked>Buka sisi kamera</label><label>Naik / turun lantai · meter<input id="pbStudioY" type="number" min="-50" max="50" step="0.01" value="0"></label><label>Putar studio · derajat<input id="pbStudioYaw" type="number" min="-360" max="360" step="5" value="0"></label></details><label>Set photo studio<select id="pbStudio">${BOOTH_STUDIOS.map(([id, label]) => `<option value="${id}">${label}</option>`).join('')}</select></label><p class="muted">Studio 3D offline. PNG transparan menyembunyikan set dan lantai.</p><label>Background · mode polos<input id="pbBackground" type="color" value="#242938"></label><label class="check"><input id="pbTransparent" type="checkbox">PNG transparan</label><details class="pb-rig-settings" open><summary>Bayangan</summary><label class="check"><input id="pbShadows" type="checkbox" checked>Aktifkan bayangan</label><label>Kekuatan bayangan<input id="pbShadowStrength" type="range" min="0" max="1" step="0.05" value="1"></label><label>Arah cahaya / bayangan · derajat<input id="pbShadowAngle" type="range" min="0" max="360" step="1" value="37"></label></details><label>Cahaya<input id="pbLight" type="range" min="0.3" max="3" value="1" step="0.05"></label><label>Resolusi foto<select id="pbSize"><option value="1080x1350">1080 × 1350 · katalog</option><option value="1920x1080" selected>1920 × 1080 · landscape</option><option value="2048x2048">2048 × 2048 · square</option><option value="3000x4000">3000 × 4000 · portrait</option><option value="4000x3000">4000 × 3000 · landscape</option><option value="3000x3000">3000 × 3000 · square</option></select></label><p class="muted">Pose/emote bawaan dibuat untuk preview. YCD Legacy: clip skeletal dan animation-list satu sumber, dipetakan melalui bone tag GTA. GLB memakai nama bone yang cocok. Blend dan efek game belum didukung. Prop rigid dapat diikat ke bone tangan.</p></aside></div>`;
  const exportDialog = document.createElement('dialog');
  exportDialog.id = 'pbExportDialog';
  exportDialog.className = 'pb-export-dialog';
  exportDialog.innerHTML =
    '<h2>Simpan foto PNG</h2><label>Orientasi<select id="pbExportOrientation"><option value="portrait">Portrait</option><option value="landscape">Landscape</option><option value="square">Square</option></select></label><label>Resolusi<select id="pbExportSize"></select></label><p class="muted">Kamera menyesuaikan semua objek saat orientasi berubah. Panel dan panah tidak masuk foto.</p><div class="pb-buttons"><button id="pbExportCancel">Batal</button><button id="pbExportConfirm" class="primary">Simpan PNG</button></div>';
  root.append(exportDialog);
  nav.after(root);
  const $ = (id) => root.querySelector('#' + id);
  let emoteMinimized = false,
    pedMinimized = false,
    pedWasCollapsed = false;
  const pedPanel = root.querySelector('.pb-assets');
  const pedHome = document.createComment('fullscreen-ped-home');
  pedPanel.before(pedHome);
  function minimizePeds(value) {
    pedMinimized = value;
    $('pbPedBody').hidden = value;
    $('pbPedPanel').classList.toggle('pb-emote-minimized', value);
    $('pbPedMinimize').textContent = value ? 'Buka' : 'Minimalkan';
    $('pbPedMinimize').setAttribute('aria-expanded', String(!value));
    $('pbPedToggle').setAttribute('aria-expanded', String(!value));
    if (!value && innerWidth < 760) minimizeEmote(true);
  }
  $('pbPedMinimize').onclick = () => minimizePeds(!pedMinimized);
  $('pbPedToggle').onclick = () => minimizePeds(!pedMinimized);
  // Reuse the live controls: callbacks, clip selection and actor clocks stay shared.
  const clipPicker = mountEmotePicker($('pbClip'));
  const viewCulling = createBoothViewCulling();
  $('pbViewCulling').onchange = () => render();
  const emoteControlIds = [
    'pbActor',
    'pbPose',
    'pbQuickPose',
    'pbPlay',
    'pbSpeed',
    'pbTime',
    'pbImportClip',
    'pbClipInput',
    'pbClipField',
    'pbRigStatus',
  ];
  const emoteNodes = emoteControlIds.map((id) => {
    const control = $(id),
      node =
        id === 'pbPlay'
          ? control.parentElement
          : ['pbActor', 'pbPose', 'pbSpeed', 'pbTime'].includes(id)
            ? control.closest('label')
            : control;
    const marker = document.createComment('emote-home:' + id);
    node.before(marker);
    return { node, marker };
  });
  function minimizeEmote(value) {
    emoteMinimized = value;
    if (!value && innerWidth < 760) minimizePeds(true);
    $('pbEmoteBody').hidden = value;
    $('pbEmotePlayer').classList.toggle('pb-emote-minimized', value);
    $('pbEmoteMinimize').textContent = value ? 'Buka' : 'Minimalkan';
    $('pbEmoteMinimize').title = value ? 'Buka emote player' : 'Minimalkan emote player';
    $('pbEmoteMinimize').setAttribute('aria-expanded', String(!value));
    $('pbEmoteToggle').setAttribute('aria-expanded', String(!value));
  }
  function showFullscreenEmotes(value) {
    if (value && !$('pbPedBody').contains(pedPanel)) {
      pedWasCollapsed = pedPanel.classList.contains('workspace-panel-collapsed');
      pedPanel.classList.remove('workspace-panel-collapsed');
      $('pbPedBody').append(pedPanel);
    } else if (!value && $('pbPedBody').contains(pedPanel)) {
      pedHome.after(pedPanel);
      pedPanel.classList.toggle('workspace-panel-collapsed', pedWasCollapsed);
    }
    $('pbPedPanel').hidden = !value;
    $('pbPedToggle').hidden = !value;
    minimizePeds(pedMinimized);
    for (const { node, marker } of emoteNodes) {
      if (value) $('pbEmoteBody').append(node);
      else marker.after(node);
    }
    $('pbEmotePlayer').hidden = !value;
    $('pbEmoteToggle').hidden = !value;
    minimizeEmote(emoteMinimized);
  }
  $('pbEmoteMinimize').onclick = () => minimizeEmote(!emoteMinimized);
  $('pbEmoteToggle').onclick = () => minimizeEmote(!emoteMinimized);
  $('pbEmotePlay').onclick = () => {
    if (!$('pbPlay').disabled) $('pbPlay').click();
  };
  let renderer,
    scene,
    camera,
    controls,
    stage,
    floor,
    studio,
    transform,
    gizmo,
    moving = false,
    expanded = false,
    capturing = false,
    key,
    fill,
    ambientLight,
    active = false,
    playing = false,
    busy = false,
    kind = 'ped',
    importCategory = 'auto',
    last = 0,
    raf = 0,
    assets = [],
    textures = [],
    maps = [],
    rest = [],
    mixers = [],
    externalClips = [],
    emoteIssues = [],
    animatedMeshes = 0,
    time = 0,
    token = 0,
    selectedActor = null,
    actorFrames = new Map(),
    textureFiles = [],
    textureOwners = [],
    replaceYtdTarget = null,
    clipFiles = [],
    clipSerial = 0,
    emoteCatalog = createEmoteCatalog({ decode: decodeEmote }),
    emoteBinding = Promise.resolve(),
    emoteGeneration = 0,
    emoteBindingError = null,
    studioPacks = [],
    currentStudioId = 'catalogue';
  const studioClipPlane = new THREE.Plane();
  const library = createBoothLibrary();
  const emoteVault = createEmoteVault();
  let vaultStarted = false,
    vaultRestoring = null,
    initialImportQueue = Promise.resolve();
  const vaultControls = document.createElement('details');
  vaultControls.className = 'pb-emote-vault';
  vaultControls.innerHTML = `<summary>Emote tersimpan · antar sesi</summary><label class="check"><input id="pbEmoteAutoSave" type="checkbox" checked>Simpan otomatis saat impor</label><p id="pbEmoteVaultStatus" class="muted" role="status">YCD/GLB disimpan di komputer ini dan dimuat saat Photo Booth dibuka kembali.</p><div class="pb-buttons"><button id="pbEmoteSaveAll">Simpan semua emote aktif</button><button id="pbEmoteLoadSaved">Muat emote tersimpan</button><button id="pbEmoteFolder">+ Folder emote</button><button id="pbEmoteClearSaved">Hapus library emote tersimpan</button></div><input id="pbEmoteFolderInput" type="file" webkitdirectory multiple hidden><p class="muted">Impor YCD, GLB, ZIP RPEmotes atau folder. Lua hanya daftar nama, tidak dijalankan. Maksimal 2000 file / 512 MB sumber; Kosongkan booth tidak menghapus library ini.</p>`;
  $('pbImportClip').after(vaultControls);
  try {
    $('pbEmoteAutoSave').checked = localStorage.getItem('ditasha.emote.autoSave') !== 'false';
  } catch {}
  $('pbEmoteAutoSave').onchange = () => {
    try {
      localStorage.setItem('ditasha.emote.autoSave', String($('pbEmoteAutoSave').checked));
    } catch {}
  };
  async function vaultStatus() {
    const records = await emoteVault.list();
    $('pbEmoteVaultStatus').textContent =
      `${records.length} file emote tersimpan · ${(records.reduce((n, r) => n + r.size, 0) / 1024 ** 2).toFixed(1)} MB. Dimuat otomatis pada sesi berikutnya.`;
  }
  async function loadSavedEmotes() {
    const records = await emoteVault.list();
    if (records.length > 2000 || records.reduce((n, r) => n + r.size, 0) > 512 * 1024 ** 2)
      throw Error('Library emote tersimpan melebihi batas.');
    const errors = [];
    for (const [index, record] of records.entries()) {
      setStatus(`Memuat emote tersimpan ${index + 1}/${records.length} · ${record.name}`);
      try {
        const file = await emoteVault.load(record),
          decoded = await emoteCatalog.add(file, 'external:' + ++clipSerial);
        if (!decoded.duplicate) externalClips.push(...decoded.entries);
        errors.push(...decoded.warnings.map((w) => file.name + ': ' + w));
      } catch (error) {
        errors.push(record.name + ': ' + error.message);
      }
    }
    clipFiles = [...emoteCatalog.sources];
    await updateClips();
    await vaultStatus();
    if (errors.length) {
      emoteIssues = [...new Set([...emoteIssues, ...errors])].slice(0, 200);
      updateIssues([]);
      $('pbEmoteVaultStatus').textContent +=
        ` ${errors.length} peringatan; sumber tetap tersimpan.`;
    }
    setStatus(
      `${clipFiles.length} file emote · ${externalClips.length} clip siap. ${errors.length ? 'Periksa peringatan emote.' : 'Library lokal dimuat.'}`,
    );
  }
  $('pbEmoteLoadSaved').onclick = () => guard(loadSavedEmotes);
  $('pbEmoteSaveAll').onclick = () =>
    guard(async () => {
      for (const source of emoteCatalog.sources) await emoteVault.save(source.file, source.key);
      await vaultStatus();
      setStatus('Semua sumber emote aktif sudah tersimpan untuk sesi berikutnya.');
    });
  $('pbEmoteClearSaved').onclick = () => {
    if (
      !busy &&
      window.confirm(
        'Hapus seluruh emote tersimpan di komputer ini? Emote yang sedang aktif dan file asli di luar aplikasi tetap ada.',
      )
    )
      guard(async () => {
        await emoteVault.clear();
        await vaultStatus();
        setStatus('Library emote tersimpan dihapus.');
      });
  };
  $('pbEmoteFolder').onclick = () => $('pbEmoteFolderInput').click();
  $('pbEmoteFolderInput').onchange = (e) => {
    const files = [...e.target.files];
    e.target.value = '';
    if (files.length) guard(() => importEmoteFiles(files));
  };

  let movieApplying = false,
    recordingVideo = false,
    movieBase = null;
  const fisheyeRenderer = createBoothFisheye();
  const movie = mountBoothMovie({
    root,
    getFrame: getMovieFrame,
    applyFrame: applyMovieFrame,
    sample: sampleMovieActors,
    layout: resize,
    notify: (message) => {
      setStatus(message);
      toast(message);
    },
    exportVideo: exportMovie,
  });
  for (const id of ['pbLight', 'pbShadowAngle', 'pbShadowStrength']) $(id).step = '.001';
  $('pbMovieToggle').onclick = () => {
    ensure();
    movie.toggle();
  };
  function getMovieFrame(defaults = false) {
    ensure();
    return {
      ...(defaults ? MOVIE_DEFAULTS : movie.view),
      position: camera.position.toArray(),
      target: controls.target.toArray(),
      power: Number($('pbLight').value),
      shadowAngle: Number($('pbShadowAngle').value),
      shadowStrength: Number($('pbShadowStrength').value),
      shadows: $('pbShadows').checked,
    };
  }
  function applyMovieFrame(frame, draw = true) {
    ensure();
    movieApplying = true;
    try {
      camera.position.fromArray(frame.position);
      controls.target.fromArray(frame.target);
      if (camera.position.distanceToSquared(controls.target) < 1e-6) controls.target.z -= 0.001;
      $('pbLight').value = frame.power;
      $('pbShadowAngle').value = frame.shadowAngle;
      $('pbShadowStrength').value = frame.shadowStrength;
      $('pbShadows').checked = frame.shadows;
      camera.fov = frame.fov;
      camera.updateProjectionMatrix();
      controls.update();
    } finally {
      movieApplying = false;
    }
    if (draw) render();
  }
  function sampleMovieActors(at, previous, animate) {
    ensure();
    if (!movieBase)
      movieBase = new Map(actors().map((a) => [a.id, a.motion.time - previous * a.motion.speed]));
    if (animate)
      for (const a of actors()) {
        const clip = clipsFor(a).find((c) => c.id === a.motion.clip),
          duration = a.motion.pose === 'clip' && clip ? Math.max(0.01, clip.clip.duration) : 4;
        const phase = (movieBase.get(a.id) ?? 0) + at * a.motion.speed;
        a.motion.time = ((phase % duration) + duration) % duration;
        a.motion.playing = false;
      }
    playing = false;
    applyPose();
  }
  async function exportMovie({ settings, animate, signal, progress, seek }) {
    if (busy) throw Error('Tunggu proses aktif selesai sebelum ekspor video.');
    await settleEmotes();
    if (!assets.length) throw Error('Masukkan ped atau kendaraan sebelum merekam.');
    ensure();
    busy = true;
    setControls();
    const oldFrame = getMovieFrame(),
      oldTime = movie.time,
      oldAspect = camera.aspect,
      enabled = controls.enabled;
    const motions = actors().map((a) => ({ a, motion: { ...a.motion } }));
    let restored = false;
    const restore = () => {
      if (restored) return;
      restored = true;
      recordingVideo = false;
      capturing = false;
      for (const { a, motion } of motions) Object.assign(a.motion, motion);
      movie.setTime(oldTime);
      movie.restore({ ...settings, time: oldTime, view: oldFrame });
      camera.aspect = oldAspect;
      controls.enabled = enabled;
      movieBase = null;
      applyPose();
      resize();
      last = 0;
    };
    try {
      recordingVideo = true;
      capturing = true;
      controls.enabled = false;
      const [w, h] = settings.size.split('x').map(Number);
      renderer.setPixelRatio(1);
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      const blob = await recordBoothVideo({
        canvas: renderer.domElement,
        duration: settings.duration,
        fps: settings.fps,
        signal,
        progress,
        frame: async (t) => {
          seek(t);
        },
      });
      restore();
      const saved = await download(blob, 'ditasha-photo-booth-video.webm', 'video/webm');
      const text = saved ? 'Video WebM tersimpan.' : 'Simpan video dibatalkan.';
      setStatus(text);
      movie.status(text);
    } finally {
      restore();
      busy = false;
      setControls();
    }
  }
  const groupOpen = new Map(),
    partOpen = new Map();
  const actors = () => assets.filter((a) => actorForAsset(assets, a) === a);
  const currentActor = () => actors().find((a) => a.id === selectedActor) || actors()[0];
  function saveMotion() {
    movieBase = null;
    const a = currentActor();
    if (a)
      Object.assign(a.motion, {
        pose: $('pbPose').value,
        clip: $('pbClip').value,
        time,
        playing,
        speed: Number($('pbSpeed').value) || 1,
      });
  }
  function loadMotion({ controls: syncControls = true } = {}) {
    const a = currentActor();
    if (!a) {
      time = 0;
      playing = false;
      return;
    }
    selectedActor = a.id;
    const m = a.motion;
    if (syncControls) {
      $('pbPose').value = m.pose;
      $('pbSpeed').value = m.speed;
      syncPedFields();
    }
    time = m.time;
    playing = m.playing;
  }
  function syncEmoteHeader() {
    const actorIndex = actors().indexOf(currentActor());
    $('pbEmoteSummary').textContent =
      actorIndex < 0
        ? 'Belum ada ped'
        : `Ped ${actorIndex + 1} · ${$('pbPose').selectedOptions[0]?.textContent || ''}`;
  }
  function actorPicker() {
    const a = currentActor();
    selectedActor = a?.id ?? null;
    const groups = new Map([
      ['ped', ['Ped / tubuh', []]],
      ['vehicle', ['Kendaraan', []]],
      ['clothing', ['Outfit mandiri', []]],
      ['other', ['Prop / bagian mandiri', []]],
    ]);
    for (const actor of actors()) {
      const key = groups.has(actor.kind) ? actor.kind : 'other';
      groups.get(key)[1].push(actor);
    }
    $('pbActor').replaceChildren(
      ...[...groups.values()]
        .filter(([, members]) => members.length)
        .map(([label, members]) => {
          const group = document.createElement('optgroup');
          group.label = `${label} (${members.length})`;
          for (const a of members) {
            const o = document.createElement('option');
            o.value = a.id;
            o.textContent = a.label || a.name.replace(/\.(?:ydd|yft|ydr|glb)$/i, '');
            o.title = a.name;
            group.append(o);
          }
          return group;
        }),
    );
    $('pbActor').value = String(selectedActor);
    syncStageActor();
    loadMotion();
    syncEmoteHeader();
    attachTransform();
  }
  function syncPedFields() {
    const a = currentActor();
    $('pbHeightCm').value = a?.baseHeight ? Number((a.baseHeight * a.scale * 100).toFixed(1)) : '';
    $('pbElevationCm').value = a ? Number((a.offset[1] * 100).toFixed(1)) : 0;
    $('pbRigSource').value = a?.rigChoice || 'auto';
    $('pbYaw').value = a?.yaw || 0;
    $('pbMatte').checked = !!a?.matte;
    $('pbPositionX').value = a ? Number((a.offset[0] * 100).toFixed(1)) : 0;
    $('pbPositionZ').value = a ? Number((a.offset[2] * 100).toFixed(1)) : 0;
  }
  function applyPreviewLooks() {
    for (const a of assets)
      if (a.root && !a.referenceOnly) {
        const owner = actorForAsset(assets, a);
        applyBoothMatte(a.root, owner.kind !== 'vehicle' && !!owner.matte);
      }
  }
  $('pbMatte').onchange = () => {
    const a = currentActor();
    if (a && a.kind !== 'vehicle') {
      a.matte = $('pbMatte').checked;
      applyPreviewLooks();
      render();
    }
  };
  $('pbYaw').onchange = () => {
    const a = currentActor(),
      value = Number($('pbYaw').value);
    if (!a) return;
    if (!Number.isFinite(value) || Math.abs(value) > 360) {
      syncPedFields();
      return;
    }
    a.yaw = value;
    updateTransform(a);
    assetList();
  };
  $('pbTransformMode').onchange = () => {
    if (!transform) return;
    const rotate = $('pbTransformMode').value === 'rotate';
    transform.setMode(rotate ? 'rotate' : 'translate');
    transform.showX = transform.showZ = !rotate;
    transform.showY = true;
    moving = true;
    $('pbMove').setAttribute('aria-pressed', 'true');
    attachTransform();
    setControls();
  };
  function syncGrips() {
    for (const a of assets) if (a.liveGrip) updateBoothGrip(a.liveGrip);
  }
  function updateTransform(a) {
    const owner = actorForAsset(assets, a),
      frame = actorFrames.get(owner.id);
    if (a === owner && frame) {
      frame.position.set(...a.offset);
      frame.rotation.set(0, ((a.yaw || 0) * Math.PI) / 180, 0);
      frame.scale.setScalar(a.scale);
    } else if (a.previewBase) {
      a.root.position.copy(a.previewBase.position).add(new THREE.Vector3(...a.offset));
      a.root.quaternion.copy(a.previewBase.quaternion);
      a.root.rotateY(((a.yaw || 0) * Math.PI) / 180);
      a.root.rotateX(THREE.MathUtils.degToRad(a.pitch || 0));
      a.root.rotateZ(THREE.MathUtils.degToRad(a.roll || 0));
      a.root.scale.copy(a.previewBase.scale).multiplyScalar(a.scale);
    }
    stage?.updateMatrixWorld(true);
    syncGrips();
    syncPedFields();
    render();
  }
  function updateIssues(messages) {
    messages = [...new Set([...messages, ...emoteIssues])];
    $('pbIssueList').replaceChildren(
      ...messages.map((message) => {
        const li = document.createElement('li');
        li.textContent = message;
        return li;
      }),
    );
    $('pbIssueSummary').textContent = 'Periksa masalah (' + messages.length + ')';
    $('pbIssues').hidden = !messages.length;
    $('pbShowIssues').hidden = !messages.length;
  }
  $('pbShowIssues').onclick = () => {
    $('pbIssues').open = true;
    $('pbIssues').scrollIntoView({ block: 'center', behavior: 'smooth' });
  };
  $('pbHeightCm').onchange = () => {
    const a = currentActor();
    if (!a) return;
    try {
      setBoothHeight(a, Number($('pbHeightCm').value));
      updateTransform(a);
      setStatus('Tinggi ped dan outfit diperbarui.');
    } catch (e) {
      setStatus(e.message);
      syncPedFields();
    }
  };
  $('pbElevationCm').onchange = () => {
    const a = currentActor();
    if (!a) return;
    try {
      setBoothElevation(a, Number($('pbElevationCm').value));
      updateTransform(a);
    } catch (e) {
      setStatus(e.message);
      syncPedFields();
    }
  };
  $('pbRigSource').onchange = () => {
    const a = currentActor();
    if (a) {
      a.rigChoice = $('pbRigSource').value;
      rebuild({ fitCamera: false });
    }
  };
  $('pbReference').onclick = () => $('pbReferenceInput').click();
  $('pbReferenceInput').onchange = (e) => {
    const files = [...e.target.files];
    e.target.value = '';
    guard(() => importFiles(files, 'accessory', 'other', { referenceOnly: true }));
  };
  const setStatus = (s) => {
    $('pbStatus').textContent = s;
  };
  const guard = async (fn) => {
    if (busy && vaultRestoring) {
      const restore = vaultRestoring;
      return (initialImportQueue = initialImportQueue
        .catch(() => {})
        .then(async () => {
          await restore;
          return guard(fn);
        }));
    }
    if (busy) return;
    busy = true;
    setControls();
    try {
      await fn();
    } catch (e) {
      setStatus(e.message);
      toast('Photo Booth: ' + e.message);
    } finally {
      busy = false;
      setControls();
    }
  };
  function setControls() {
    for (const id of [
      'pbPed',
      'pbVehicle',
      'pbImportStudio',
      'pbMovieToggle',
      'pbGtaStudio',
      'pbStudioFolder',
      'pbStudio',
      'pbStageStudio',
      'pbVehicleFolder',
      'pbVehicleTextureFolder',
      'pbVehiclePart',
      'pbYaw',
      'pbTransformMode',
      'pbClothes',
      'pbAccessory',
      'pbProp',
      'pbFolder',
      'pbImportCategory',
      'pbTextures',
      'pbClear',
      'pbImportClip',
      'pbEmoteSaveAll',
      'pbEmoteLoadSaved',
      'pbEmoteFolder',
      'pbEmoteClearSaved',
      'pbEmoteAutoSave',
      'pbActor',
      'pbPlayAll',
      'pbPauseAll',
      'pbHeightCm',
      'pbElevationCm',
      'pbRigSource',
      'pbReference',
      'pbLibrarySave',
      'pbLibraryRefresh',
    ])
      $(id).disabled = busy;
    const freemode = root.querySelector('.pb-freemode-character');
    if (freemode)
      freemode.querySelectorAll('button,input,select').forEach((control) => {
        control.disabled =
          busy ||
          (control.matches('[data-add]') &&
            !freemode.querySelector('[data-freemode-part=head]').value);
      });
    if ($('pbFreemode')) $('pbFreemode').disabled = busy;
    $('pbOutfitButtons')
      .querySelectorAll('button')
      .forEach((b) => (b.disabled = busy));
    $('pbAssets')
      .querySelectorAll('button,input,select')
      .forEach((e) => (e.disabled = busy || e.dataset.referenceCheckbox === 'true'));
    $('pbLibrarySave').disabled = busy || !assets.length;
    $('pbVehiclePart').disabled = busy || currentActor()?.kind !== 'vehicle';
    $('pbReference').disabled = busy || !currentActor() || currentActor().kind === 'vehicle';
    $('pbMatte').disabled = busy || !currentActor() || currentActor().kind === 'vehicle';
    $('pbRigSource').disabled = busy || !currentActor();
    $('pbHeightCm').disabled = busy || !currentActor()?.baseHeight;
    $('pbElevationCm').disabled = busy || !currentActor();
    for (const id of ['pbPositionX', 'pbPositionZ', 'pbMove', 'pbStageActor'])
      $(id).disabled = busy || !currentActor();
    if (transform) transform.enabled = moving && !busy && !!currentActor();
    const owner = currentActor(),
      frame = owner && actorFrames.get(owner.id);
    let ownAnimated = false;
    frame?.traverse((o) => {
      if (o.isSkinnedMesh) ownAnimated = true;
    });
    const movable =
      $('pbPose').value === 'clip'
        ? mixers.some((m) => m.userData.actor === owner?.id)
        : ownAnimated && rest.some((r) => r.role && frame?.getObjectById(r.bone.id));
    $('pbQuickPose')
      .querySelectorAll('button')
      .forEach((b) => (b.disabled = busy || !movable));
    $('pbCapture').disabled = busy || !assets.length;
    $('pbStageCapture').disabled = busy || !assets.length;
    $('pbPlay').disabled = busy || !movable;
    $('pbEmotePlay').disabled = $('pbPlay').disabled;
    $('pbTime').disabled = busy || !movable;
  }
  function syncStageActor() {
    $('pbStageActor').replaceChildren(...[...$('pbActor').children].map((o) => o.cloneNode(true)));
    $('pbStageActor').value = String(selectedActor);
  }
  function attachTransform() {
    if (!transform) return;
    const frame = actorFrames.get(currentActor()?.id);
    if (moving && frame) transform.attach(frame);
    else transform.detach();
    render();
  }
  function selectPed(id) {
    if (busy || !actors().some((a) => a.id === id)) return;
    saveMotion();
    selectedActor = id;
    $('pbActor').value = String(id);
    syncStageActor();
    loadMotion();
    updateClips();
    applyPose();
    attachTransform();
    groupOpen.set(id, true);
    assetList();
    setControls();
  }
  function updateStudioOptions() {
    const previous = $('pbStudio').value;
    for (const id of ['pbStudio', 'pbStageStudio']) {
      $(id).replaceChildren(
        ...BOOTH_STUDIOS.map(([value, label]) => new Option(label, value)),
        ...studioPacks.flatMap((pack) =>
          pack.maps.map(
            (map, i) =>
              new Option(
                pack.label +
                  ' / ' +
                  map.name.replace(/_sweet(maps|mods)$/i, '').replaceAll('_', ' '),
                'custom:' + pack.id + ':' + i,
              ),
          ),
        ),
      );
      $(id).value = previous;
    }
    $('pbStudioPackStatus').textContent = studioPacks.length
      ? studioPacks.reduce((n, p) => n + p.maps.length, 0) +
        ' studio impor · ' +
        studioPacks.map((p) => p.label).join(', ')
      : 'Impor ZIP atau folder resource studio.';
  }
  async function changeStudio(preparedStudio = null) {
    if (!scene) return;
    const value = $('pbStudio').value;
    let next;
    try {
      if (value.startsWith('custom:')) {
        const [, id, index] = value.split(':'),
          pack = studioPacks.find((p) => p.id === id);
        if (!pack)
          throw Error(
            'Paket studio belum tersedia. Impor resource atau buka preset yang menyertakannya.',
          );
        setStatus('Membuka studio ' + pack.label + '…');
        next =
          preparedStudio ||
          (await buildMapStudio(pack, Number(index), decodeResource, {
            cutawayPlane: studioClipPlane,
          }));
      } else next = createBoothStudio(value);
    } catch (e) {
      $('pbStudio').value = currentStudioId;
      $('pbStageStudio').value = currentStudioId;
      throw e;
    }
    disposeBoothStudio(studio);
    studio = next;
    currentStudioId = value;
    scene.add(studio);
    $('pbStageStudio').value = value;
    $('pbCustomStudioSettings').hidden = !studio.userData.studioMap;
    applyStudioSettings();
    render();
    if (studio.userData.studioMap) {
      const warnings = studio.userData.warnings;
      setStatus(
        studio.name +
          ' · ' +
          studio.userData.vertices.toLocaleString() +
          ' vertex' +
          (warnings.length
            ? ' · ' + warnings.length + ' dependensi perlu diperiksa.'
            : ' · siap foto.'),
      );
      if (warnings.length)
        updateIssues([
          ...new Set([...$('pbIssueList').children].map((n) => n.textContent).concat(warnings)),
        ]);
    }
  }
  function applyStudioSettings() {
    if (!studio?.userData.studioMap) return;
    studio.position.y = Number($('pbStudioY').value) || 0;
    studio.rotation.y = THREE.MathUtils.degToRad(Number($('pbStudioYaw').value) || 0);
    studio.traverse((o) => {
      if (o.isMesh)
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
          const enabled = $('pbStudioCutaway').checked;
          if (!!m.clippingPlanes?.length !== enabled) {
            m.clippingPlanes = enabled ? [studioClipPlane] : [];
            m.needsUpdate = true;
          }
        }
    });
  }
  async function importStudio(inputs) {
    ensure();
    if (studioPacks.length >= 16) throw Error('Maksimal 16 paket studio.');
    const files = await expandStudioFiles(inputs);
    if (studioPacks.reduce((n, p) => n + p.files.length, 0) + files.length > 2000)
      throw Error('Total studio maksimal 2000 file.');
    if (
      studioPacks.reduce((n, p) => n + p.files.reduce((n, f) => n + f.size, 0), 0) +
        files.reduce((n, f) => n + f.size, 0) >
      512 * 1024 ** 2
    )
      throw Error('Total sumber studio maksimal 512 MB.');
    const label =
      inputs[0]?.webkitRelativePath?.split('/')[0] ||
      inputs[0]?.name.replace(/\.zip$/i, '') ||
      'Studio';
    const pack = await prepareStudioPack(
      { id: crypto.randomUUID(), label: label.slice(0, 80), files },
      decodeResource,
    );
    studioPacks.push(pack);
    updateStudioOptions();
    $('pbStudio').value = 'custom:' + pack.id + ':0';
    await changeStudio();
  }
  $('pbGtaStudio').onclick = () =>
    guard(async () => {
      setStatus('Memindai instalasi GTA V…');
      const files = await installedStudioFiles();
      if (files) await importStudio(files);
      else setStatus('Pemilihan studio dibatalkan.');
    });
  $('pbImportStudio').onclick = () => $('pbStudioZipInput').click();
  $('pbStudioFolder').onclick = () => $('pbStudioFolderInput').click();
  for (const id of ['pbStudioZipInput', 'pbStudioFolderInput'])
    $(id).onchange = (e) => {
      const files = [...e.target.files];
      e.target.value = '';
      if (files.length) guard(() => importStudio(files));
    };
  for (const id of ['pbStudioCutaway', 'pbStudioY', 'pbStudioYaw'])
    $(id).oninput = () => {
      applyStudioSettings();
      render();
    };
  function setExpanded(value) {
    expanded = value;
    root.querySelector('.pb-stage').classList.toggle('pb-expanded', value);
    showFullscreenEmotes(value);
    $('pbFullscreen').textContent = value ? 'Keluar layar penuh · Esc' : 'Layar penuh';
    $('pbFullscreen').setAttribute('aria-pressed', String(value));
    requestAnimationFrame(() => {
      resize();
      fit();
      $('pbFullscreen').focus();
    });
  }
  $('pbFullscreen').onclick = () => setExpanded(!expanded);
  document.addEventListener('keydown', (e) => {
    if (active && expanded && !exportDialog.open && e.key === 'Escape') {
      e.preventDefault();
      setExpanded(false);
    }
  });
  $('pbMove').onclick = () => {
    moving = !moving;
    $('pbMove').setAttribute('aria-pressed', String(moving));
    $('pbMove').textContent = moving ? 'Atur objek · aktif' : 'Atur posisi';
    attachTransform();
    setControls();
    setStatus(
      moving
        ? 'Pilih ped, lalu tarik panah X/Y/Z. Outfit mengikuti ped. Klik area kosong untuk orbit kamera.'
        : 'Mode orbit kamera. Drag untuk memutar, scroll untuk zoom.',
    );
  };
  $('pbSnap').onchange = () => transform?.setTranslationSnap($('pbSnap').checked ? 0.1 : null);
  for (const [id, index] of [
    ['pbPositionX', 0],
    ['pbPositionZ', 2],
  ])
    $(id).onchange = () => {
      const a = currentActor(),
        cm = Number($(id).value);
      if (!a) return;
      if (!Number.isFinite(cm) || Math.abs(cm) > 10000) {
        syncPedFields();
        return;
      }
      a.offset[index] = cm / 100;
      updateTransform(a);
      assetList();
    };
  function chooseStudio() {
    if ($('pbStudio').value.startsWith('custom:')) guard(() => changeStudio());
    else changeStudio().catch((e) => setStatus(e.message));
  }
  $('pbStudio').onchange = chooseStudio;
  $('pbStageStudio').onchange = () => {
    $('pbStudio').value = $('pbStageStudio').value;
    chooseStudio();
  };

  function ensure() {
    if (renderer) return;
    renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
    });
    renderer.localClippingEnabled = true;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    $('pbViewport').append(renderer.domElement);
    scene = new THREE.Scene();
    stage = new THREE.Group();
    scene.add(stage);
    ambientLight = new THREE.HemisphereLight(0xffffff, 0x777987, 2);
    scene.add(ambientLight);
    key = new THREE.DirectionalLight(0xfff1df, 3);
    key.position.set(3, 5, -4);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.bias = -0.0005;
    key.shadow.normalBias = 0.02;
    key.shadow.camera.left = key.shadow.camera.bottom = -8;
    key.shadow.camera.right = key.shadow.camera.top = 8;
    scene.add(key);
    fill = new THREE.DirectionalLight(0xcbdcff, 1.5);
    fill.position.set(-4, 2, -3);
    scene.add(fill);
    floor = new THREE.GridHelper(10, 40, 0x717785, 0x414858);
    scene.add(floor);
    changeStudio();
    camera = new THREE.PerspectiveCamera(35, 1, 0.001, 1000);
    camera.position.set(0, 1.3, -4);
    controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 1, 0);
    controls.addEventListener('change', render);
    transform = new TransformControls(camera, renderer.domElement);
    transform.setMode('translate');
    transform.setSpace('world');
    transform.setSize(0.85);
    gizmo = transform.getHelper();
    scene.add(gizmo);
    transform.addEventListener('dragging-changed', (e) => {
      controls.enabled = !e.value;
      if (!e.value) assetList();
    });
    transform.addEventListener('objectChange', () => {
      const a = currentActor();
      if (!a || !transform.object) return;
      if (transform.mode === 'rotate') {
        const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(transform.object.quaternion);
        a.yaw = THREE.MathUtils.radToDeg(Math.atan2(forward.x, forward.z));
        transform.object.rotation.set(0, THREE.MathUtils.degToRad(a.yaw), 0);
      }
      a.offset = transform.object.position.toArray().map((v) => Math.max(-100, Math.min(100, v)));
      transform.object.position.fromArray(a.offset);
      syncPedFields();
      render();
    });
    transform.addEventListener('change', render);
    renderer.domElement.addEventListener('pointerdown', (e) => {
      if (!moving || busy || e.button !== 0 || transform.axis) return;
      const rect = renderer.domElement.getBoundingClientRect(),
        ray = new THREE.Raycaster();
      ray.setFromCamera(
        new THREE.Vector2(
          ((e.clientX - rect.left) / rect.width) * 2 - 1,
          1 - ((e.clientY - rect.top) / rect.height) * 2,
        ),
        camera,
      );
      const hit = ray.intersectObject(stage, true).find((hit) => {
        for (let o = hit.object; o && o !== stage; o = o.parent) if (!o.visible) return false;
        return hit.object.isMesh;
      });
      if (hit)
        for (const [id, frame] of actorFrames) {
          for (let o = hit.object; o && o !== stage; o = o.parent)
            if (o === frame) {
              selectPed(id);
              return;
            }
        }
    });
    new ResizeObserver(resize).observe($('pbViewport'));
    renderer.domElement.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      playing = false;
      setStatus('Konteks 3D terputus. Buka ulang aplikasi untuk memulihkan booth.');
    });
    resize();
  }
  function resize() {
    const stageElement = root.querySelector('.pb-stage');
    stageElement.style.setProperty(
      '--pb-overlay-top',
      `${stageElement.querySelector('.pb-stage-toolbar').getBoundingClientRect().height + 8}px`,
    );
    if (!renderer || !active || recordingVideo) return;
    const w = $('pbViewport').clientWidth,
      h = $('pbViewport').clientHeight;
    if (!w || !h) return;
    const [sw, sh] = (movie.visible ? movie.size : $('pbSize').value).split('x').map(Number),
      ratio = sw / sh;
    const rw = Math.min(w, h * ratio),
      rh = rw / ratio;
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    renderer.setSize(rw, rh);
    camera.aspect = ratio;
    camera.updateProjectionMatrix();
    render();
  }
  function render() {
    if (movieApplying || !renderer || !camera || !active) return;
    renderer.setClearColor($('pbBackground').value, $('pbTransparent').checked ? 0 : 1);
    floor.visible =
      $('pbFloor').checked && !$('pbTransparent').checked && $('pbStudio').value === 'plain';
    if (studio) studio.visible = !$('pbTransparent').checked;
    if (studio?.userData.studioMap && controls) {
      const direction = controls.target.clone().sub(camera.position).normalize(),
        point = controls.target.clone().addScaledVector(direction, -1.5);
      studioClipPlane.setFromNormalAndCoplanarPoint(direction, point);
    }
    if (gizmo) gizmo.visible = moving && !!transform.object && !capturing;
    const angle = THREE.MathUtils.degToRad(Number($('pbShadowAngle').value));
    const look = movie.view;
    camera.fov = look.fov;
    camera.updateProjectionMatrix();
    if (look.roll) {
      camera.lookAt(controls.target);
      camera.rotateZ(THREE.MathUtils.degToRad(look.roll));
    }
    key.position.set(
      Math.sin(angle) * look.distance,
      look.height,
      -Math.cos(angle) * look.distance,
    );
    key.castShadow = $('pbShadows').checked;
    key.shadow.intensity = Number($('pbShadowStrength').value);
    key.intensity = 3 * Number($('pbLight').value);
    fill.intensity = 1.5 * Number($('pbLight').value) * look.fill;
    ambientLight.intensity = 2 * look.ambient;
    key.color.set(look.keyColor);
    fill.color.set(look.fillColor);
    key.shadow.bias = look.shadowBias;
    key.shadow.normalBias = look.normalBias;
    key.shadow.radius = look.shadowRadius;
    const shadowType =
      look.shadowMode === 'hard'
        ? THREE.BasicShadowMap
        : look.shadowMode === 'pcf'
          ? THREE.PCFShadowMap
          : THREE.PCFSoftShadowMap;
    if (renderer.shadowMap.type !== shadowType) {
      renderer.shadowMap.type = shadowType;
      renderer.shadowMap.needsUpdate = true;
      scene.traverse((o) => {
        if (o.material)
          for (const m of Array.isArray(o.material) ? o.material : [o.material])
            m.needsUpdate = true;
      });
    }
    if (key.shadow.mapSize.x !== look.shadowSize) {
      key.shadow.map?.dispose();
      key.shadow.map = null;
      key.shadow.mapSize.set(look.shadowSize, look.shadowSize);
      key.shadow.needsUpdate = true;
    }
    const culled = viewCulling(studio, camera, $('pbViewCulling').checked);
    $('pbCullStats').textContent =
      culled.visible + ' / ' + culled.total + ' mesh studio dalam bingkai kamera';
    if (look.fisheye)
      fisheyeRenderer.render(renderer, scene, camera, look.fov, $('pbTransparent').checked ? 0 : 1);
    else renderer.render(scene, camera);
  }
  function fit(direction) {
    if (!stage?.children.length) return;
    stage.updateMatrixWorld(true);
    const box = new THREE.Box3();
    stage.traverseVisible((o) => {
      if (!o.isMesh) return;
      if (o.isSkinnedMesh) o.computeBoundingBox();
      else if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      const local = o.isSkinnedMesh ? o.boundingBox : o.geometry.boundingBox;
      if (local) box.union(local.clone().applyMatrix4(o.matrixWorld));
    });
    if (box.isEmpty()) return;
    const dir = direction || camera.position.clone().sub(controls.target).normalize();
    const corners = [];
    for (const x of [box.min.x, box.max.x])
      for (const y of [box.min.y, box.max.y])
        for (const z of [box.min.z, box.max.z]) corners.push(x, y, z);
    const { center, distance, depth } = fitPhotoshoot(
      corners,
      dir,
      camera.up,
      camera.aspect,
      camera.fov,
      0.98,
    );
    camera.position.copy(center).addScaledVector(dir, distance);
    camera.near = Math.max(0.0001, distance / 10000);
    camera.far = Math.max(100, distance + depth * 2 + 1);
    camera.updateProjectionMatrix();
    controls.target.copy(center);
    controls.update();
    render();
  }
  function textureMap(t, role = 'color') {
    if (!t) return null;
    let found = maps.find((m) => m.source === t && m.role === role);
    if (found) return found.map;
    const map = new THREE.DataTexture(new Uint8Array(t.out), t.w, t.h, THREE.RGBAFormat);
    map.colorSpace = role === 'color' ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    map.flipY = false;
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.needsUpdate = true;
    maps.push({ source: t, role, map });
    return map;
  }
  function nativeRig(data) {
    const holder = new THREE.Group();
    holder.userData.boothRig = true;
    const bones = data.map((b) => {
      const bone = new THREE.Bone();
      bone.name = b.name;
      bone.userData.tag = b.tag;
      new THREE.Matrix4().fromArray(b.matrix).decompose(bone.position, bone.quaternion, bone.scale);
      return bone;
    });
    bones.forEach((bone, i) => (data[i].parent < 0 ? holder : bones[data[i].parent]).add(bone));
    holder.updateMatrixWorld(true);
    return { holder, bones, skeleton: new THREE.Skeleton(bones) };
  }
  function clearStage() {
    transform?.detach();
    applyBoothPose(rest, 'rest', 0);
    mixers.forEach((m) => {
      m.stopAllAction();
      m.uncacheRoot(m.getRoot());
    });
    mixers = [];
    rest = [];
    stage.traverse((o) => {
      if (o.isMesh && o.userData.boothNative) {
        o.geometry.dispose();
        o.material.dispose();
      }
      if (o.isSkinnedMesh && o.userData.boothNative) o.skeleton.dispose();
    });
    stage.clear();
    maps.forEach((m) => m.map.dispose());
    maps = [];
  }
  function rebuild({ fitCamera = true } = {}) {
    ensure();
    clearStage();
    actorFrames = new Map();
    for (const a of actors()) {
      const frame = new THREE.Group();
      actorFrames.set(a.id, frame);
      stage.add(frame);
    }
    const warnings = [];
    for (const a of actors()) a.rigReport = { skinned: 0, static: 0, transfers: 0, sources: new Set() };
    let skinned = 0,
      staticMeshes = 0;
    for (const a of assets) {
      a.textureReport = [];
      a.liveGrip = null;
      a.attachmentStatus = '';
      a.root = new THREE.Group();
      a.root.name = a.name;
      a.root.visible = a.visible;
      const owner = actorForAsset(assets, a);
      actorFrames.get(owner.id).add(a.root);
      const vehicleHidden = new Set(
        assets
          .filter(
            (b) => b.kind === 'vehicle-part' && b.owner === owner.id && b.visible && !b.vehicleAlt,
          )
          .flatMap((b) => b.vehicleOffBones || []),
      );
      const family = freemodeFamily(owner.name) || freemodeFamily(a.name);
      const candidates = assets
        .filter((b) => actorForAsset(assets, b) === owner && !isRigidBoothProp(b))
        .flatMap((b) =>
          (b.drawables || [])
            .filter((d) => d.rig?.length)
            .map((d) => ({ rig: d.rig, label: b.name, referenceOnly: b.referenceOnly })),
        )
        .sort(
          (a, b) =>
            Number(!!b.referenceOnly) - Number(!!a.referenceOnly) || b.rig.length - a.rig.length,
        );
      // Only the selected ped's own weighted body/reference mesh may donate bone weights.
      // Both meshes must share GTA model coordinates; out-of-range vertices remain static.
      const weightSources = assets
        .filter(b => b !== a && actorForAsset(assets, b) === owner &&
          (b.kind === 'ped' || b.referenceOnly) &&
          (!freemodeFamily(b.name) || !family || freemodeFamily(b.name) === family))
        .flatMap(b => (b.drawables || []).flatMap(d =>
          (d.lods.find(l => l.name === 'High') || d.lods[0])?.geometries
            ?.filter(g => g.skin && d.rig?.length)
            .map(g => ({ positions:g.positions, skin:g.skin, rig:d.rig, label:b.name })) || []));
      if (a.referenceOnly) continue;
      if (a.gltf) {
        a.root.add(a.gltf.scene);
        continue;
      }
      const selected =
        a.drawable === -1 ? a.drawables : a.drawables.filter((_, i) => i === a.drawable);
      for (const d of selected) {
        const part = new THREE.Group();
        part.name = d.name;
        part.visible = !a.hiddenSlots.has(d.componentSlot);
        a.root.add(part);
        const rigCache = new Map();
        for (const g of (d.lods.find((l) => l.name === 'High') || d.lods[0]).geometries) {
          let transfer = null;
          if (!g.skin && a.kind === 'clothing' && owner.kind === 'ped') {
            for (const source of weightSources) {
              transfer = transferSkinWeights(g.positions, source);
              if (transfer) break;
            }
          }
          const effectiveSkin = transfer ? { indices:transfer.indices, weights:transfer.weights } : g.skin;
          const selection = transfer
            ? selectBoothRig(transfer.rig, effectiveSkin, [], { family, choice:'auto' })
            : isRigidBoothProp(a)
              ? { rig: [], indices: null }
              : selectBoothRig(d.rig, g.skin, candidates, {
                  family,
                  choice: owner.rigChoice || 'auto',
                });
          let rig = selection.rig.length ? rigCache.get(selection.rig) : null;
          if (!rig && selection.rig.length) {
            rig = nativeRig(selection.rig);
            rigCache.set(selection.rig, rig);
            part.add(rig.holder);
          }
          if (selection.warning) warnings.push(a.name + ': ' + selection.warning);
          if (selection.source && rig) owner.rigReport.sources.add(selection.source);
          const previewIndices =
            a.kind === 'vehicle' || a.vehicleAlt
              ? vehiclePreviewIndices(g, d.rig || [], vehicleHidden)
              : g.indices;
          if (!previewIndices.length) continue;
          const geom = new THREE.BufferGeometry();
          // Morph target applies to the matching actor head, never to clothing/body meshes.
          let headPositions=g.positions;
          if(owner.kind==='ped' && owner.characterMorphPack &&
            /head|face/i.test(a.name+' '+(g.name||'')+' '+(g.diffuseTexture||''))){
            try {headPositions=applyMorphPack(g.positions,owner.characterMorphPack,owner.characterAppearance);}
            catch(error){warnings.push('Morph wajah '+a.name+': '+error.message);}
          }
          geom.setAttribute('position', new THREE.BufferAttribute(headPositions, 3));
          if (g.uvs) geom.setAttribute('uv', new THREE.BufferAttribute(g.uvs, 2));
          if (g.uvs2) geom.setAttribute('uv1', new THREE.BufferAttribute(g.uvs2, 2));
          geom.setIndex(new THREE.BufferAttribute(previewIndices, 1));
          if (g.normals) geom.setAttribute('normal', new THREE.BufferAttribute(g.normals, 3));
          else geom.computeVertexNormals();
          const ownTextures = textures.filter(
            (t) => t.boothOwner == null || t.boothOwner === a.id || t.boothOwner === owner.id,
          );
          const embedded = d.embeddedTextures || [];
          const override =
            a.textureOverride &&
            [...ownTextures.filter((t) => t.boothOwner === a.id), ...ownTextures, ...embedded].find(
              (t) => JSON.stringify([t.dictionary || '', t.name]) === a.textureOverride,
            );
          const t =
            override ||
            resolveBoothTexture(
              g.diffuseTexture,
              textures,
              embedded,
              a.id,
              owner.id,
              a.name,
              owner.textureParents || [],
            );
          if (g.diffuseTexture)
            a.textureReport.push({
              name: g.diffuseTexture,
              dictionary: t?.dictionary || (t ? 'embedded' : null),
            });
          if (g.diffuseTexture && !t)
            warnings.push(a.name + ': tekstur ' + g.diffuseTexture + ' belum ditemukan');
          const alpha = modelPreviewAlpha(g) || {
            mode: /^(sbase|head_diff|uppr_diff|lowr_diff|body_diff)/i.test(g.diffuseTexture || '')
              ? 'opaque'
              : modelAlphaMode(g),
            cutoff: 0.02,
          };
          const material = createModelMaterial(g, {
            color: t ? 0xffffff : 0xa7b1c0,
            map: textureMap(t),
            side: THREE.DoubleSide,
            roughness: 0.75,
            transparent: alpha.mode === 'blend',
            alphaTest: alpha.mode === 'opaque' ? 0 : alpha.cutoff,
          });
          setSurfaceMaps(
            material,
            Object.fromEntries(
              Object.entries(surfaceReferences(g)).map(([role, name]) => [
                role,
                resolveBoothTexture(
                  name,
                  textures,
                  embedded,
                  a.id,
                  owner.id,
                  a.name,
                  owner.textureParents || [],
                ),
              ]),
            ),
            textureMap,
          );
          if (owner.kind === 'vehicle') {
            const livery = resolveBoothTexture(
              liveryReference(g),
              textures,
              embedded,
              a.id,
              owner.id,
              a.name,
              owner.textureParents || [],
            );
            if (livery && g.uvs2) {
              geom.setAttribute('ditashaLiveryUv', new THREE.BufferAttribute(g.uvs2, 2));
              setVehicleLivery(material, textureMap(livery));
            } else if (liveryReference(g) && !livery)
              warnings.push(a.name + ': livery ' + liveryReference(g) + ' belum ditemukan');
          }
          let mesh;
          const valid = effectiveSkin && rig && selection.indices;
          if (valid) {
            geom.setAttribute('skinIndex', new THREE.BufferAttribute(selection.indices, 4));
            geom.setAttribute('skinWeight', new THREE.BufferAttribute(effectiveSkin.weights, 4));
            mesh = new THREE.SkinnedMesh(geom, material);
            part.add(mesh);
            part.updateMatrixWorld(true);
            mesh.bind(rig.skeleton, new THREE.Matrix4());
            mesh.frustumCulled = false;
            skinned++;
            owner.rigReport.skinned++;
            if (transfer) {
              owner.rigReport.transfers++;
              owner.rigReport.sources.add('Auto weight transfer (referensi ped)');
            }
          } else {
            mesh = new THREE.Mesh(geom, material);
            part.add(mesh);
            staticMeshes++;
            owner.rigReport.static++;
          }
          mesh.name = g.name;
          mesh.userData.boothNative = true;
          if (!g.skin && rig && rig.bones[g.boneIndex]) {
            part.updateMatrixWorld(true);
            rig.bones[g.boneIndex].attach(mesh);
          }
          if (g.skinWarning) warnings.push(g.skinWarning);
        }
      }
    }
    stage.updateMatrixWorld(true);
    // Resolve against ped/outfit skeletons, never the prop's own skeleton.
    for (const a of assets)
      if (!['ped', 'vehicle', 'vehicle-part'].includes(a.kind) && a.attach !== 'auto') {
        const owner = actorForAsset(assets, a);
        const roots = assets
          .filter(
            (b) =>
              actorForAsset(assets, b) === owner && !isRigidBoothProp(b) && b !== a && b.visible,
          )
          .map((b) => b.root);
        const bone = findBoothAttachmentBone(roots, a.attach);
        if (bone && owner.kind === 'ped') {
          if (a.grip) a.liveGrip = createBoothGrip(a.root, bone, actorFrames.get(owner.id));
          else bone.attach(a.root);
          a.attachmentStatus = 'Terikat · ' + bone.name;
        } else {
          a.attachmentStatus = 'Belum terikat: pilih pemilik ped / skeleton tangan yang cocok';
          if (isRigidBoothProp(a)) a.root.visible = false;
          warnings.push(a.name + ': ' + a.attachmentStatus);
        }
      }
    for (const a of assets) {
      a.previewBase = {
        position: a.root.position.clone(),
        quaternion: a.root.quaternion.clone(),
        scale: a.root.scale.clone(),
      };
      const owner = actorForAsset(assets, a);
      if (a !== owner) {
        a.root.position.add(new THREE.Vector3(...a.offset));
        a.root.scale.multiplyScalar(a.scale);
        a.root.rotateY(((a.yaw || 0) * Math.PI) / 180);
        a.root.rotateX(THREE.MathUtils.degToRad(a.pitch || 0));
        a.root.rotateZ(THREE.MathUtils.degToRad(a.roll || 0));
      }
    }
    for (const a of actors()) {
      const frame = actorFrames.get(a.id);
      a.baseHeight = boothHeight(photoshootPoints([frame]));
      if (a.targetHeightCm && a.baseHeight > 0)
        a.scale = Math.max(0.01, Math.min(100, a.targetHeightCm / (a.baseHeight * 100)));
      frame.position.set(...a.offset);
      frame.rotation.set(0, ((a.yaw || 0) * Math.PI) / 180, 0);
      frame.scale.setScalar(a.scale);
    }
    syncGrips();
    animatedMeshes = 0;
    stage.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = o.receiveShadow = true;
      let bound = o.isSkinnedMesh;
      for (let p = o.parent; p && p !== stage; p = p.parent)
        if (p.isBone && boothBoneRole(p.name)) bound = true;
      if (bound) animatedMeshes++;
    });
    applyPreviewLooks();
    rest = captureBoothRest(stage).filter(({ bone }) => {
      for (let o = bone; o; o = o.parent)
        if (assets.some((a) => isRigidBoothProp(a) && a.root === o)) return false;
      return true;
    });
    const roles = new Set(rest.map((b) => b.role).filter(Boolean));
    actorPicker();
    updateClips();
    applyPose();
    assetList();
    setControls();
    updateIssues([...new Set(warnings)]);
    setStatus(
      warnings.length
        ? `${assets.length} aset · ${new Set(warnings).size} hal perlu diperiksa. Klik Lihat masalah.`
        : `${assets.length} aset · siap foto. File sumber tetap utuh.`,
    );
    if (fitCamera) fit();
  }
  function clipsFor(actor) {
    return [
      ...assets
        .filter((a) => actorForAsset(assets, a) === actor && !isRigidBoothProp(a))
        .flatMap((a) =>
          (a.gltf?.animations || []).map((clip, i) => ({
            clip,
            id: a.id + ':' + i,
            label: a.name + ' / ' + clip.name,
          })),
        ),
      ...externalClips,
    ];
  }
  function updateClips() {
    const actor = currentActor(),
      clips = actor ? clipsFor(actor) : [],
      query = $('pbClipSearch').value.trim().toLowerCase();
    $('pbClip').replaceChildren(
      ...clips
        .filter(
          (c) => !query || c.label.toLowerCase().includes(query) || c.id === actor?.motion.clip,
        )
        .map((c) => {
          const o = document.createElement('option');
          o.value = c.id;
          o.textContent = c.label;
          return o;
        }),
    );
    if (actor && clips.some((c) => c.id === actor.motion.clip))
      $('pbClip').value = actor.motion.clip;
    if (actor) actor.motion.clip = $('pbClip').value;
    clipPicker.sync();
    $('pbClipField').hidden = !clips.length;
    const generation = ++emoteGeneration;
    emoteBindingError = null;
    const reportError = (error) => {
      if (generation !== emoteGeneration) return;
      emoteBindingError = error;
      emoteIssues = [...new Set([...emoteIssues, error.message])].slice(0, 200);
      updateIssues([]);
      setStatus(error.message);
    };
    try {
      emoteBinding = Promise.resolve(bindClips(clips, actor, generation)).catch(reportError);
    } catch (error) {
      reportError(error);
      emoteBinding = Promise.resolve();
    }
    return emoteBinding;
  }
  function bindClips(clips, actor, generation, hydrated, refresh = false) {
    const selected = actors()
      .filter((a) => a.motion.pose === 'clip')
      .map((a) => clipsFor(a).find((c) => c.id === a.motion.clip))
      .filter(Boolean);
    hydrated ||= emoteCatalog.peek(selected);
    if (!hydrated)
      return emoteCatalog
        .load(selected)
        .then((loaded) => bindClips(clips, actor, generation, loaded, true));
    if (generation !== emoteGeneration) return;
    mixers.forEach((m) => {
      m.stopAllAction();
      m.uncacheRoot(m.getRoot());
    });
    mixers = [];
    // Reset once before binding. Resetting every frame bypasses Three's cached
    // property mixer and erases constant YCD translations / paused rotations.
    applyBoothPose(rest, 'rest', 0);
    for (const owner of actors()) {
      if (owner.motion.pose !== 'clip') continue;
      const descriptor = clipsFor(owner).find((c) => c.id === owner.motion.clip);
      const selected = hydrated.get(descriptor?.id) || descriptor;
      if (!selected) continue;
      const roots = new Set();
      for (const a of assets.filter(
        (a) => actorForAsset(assets, a) === owner && !isRigidBoothProp(a),
      )) {
        if (a.gltf) roots.add(a.gltf.scene);
        else
          a.root.traverse((o) => {
            if (o.userData.boothRig) roots.add(o);
          });
      }
      for (const root of roots) {
        const names = new Set();
        root.traverse((o) => names.add(o.name));
        const boundClip = selected.ycd ? ycdAnimationClip(selected.ycd, root) : selected.clip;
        const tracks = boundClip.tracks.filter((t) => {
          try {
            const node = THREE.PropertyBinding.parseTrackName(t.name).nodeName;
            return names.has(node) || !!root.getObjectByProperty('uuid', node);
          } catch {
            return false;
          }
        });
        if (tracks.length) {
          const mixer = new THREE.AnimationMixer(root);
          mixer.userData = { actor: owner.id };
          mixer
            .clipAction(new THREE.AnimationClip(boundClip.name, boundClip.duration, tracks))
            .play();
          mixers.push(mixer);
        }
      }
    }
    const current = actor && clips.find((c) => c.id === actor.motion.clip);
    $('pbTime').max = String(
      actor?.motion.pose === 'clip' && current ? Math.max(0.01, current.clip.duration) : 4,
    );
    if (refresh) {
      applyPose();
      setControls();
    }
  }
  async function settleEmotes() {
    let current;
    do {
      current = emoteBinding;
      await current;
    } while (current !== emoteBinding);
    if (emoteBindingError) throw emoteBindingError;
  }
  function applyPose() {
    if (!stage) return;
    for (const actor of actors()) {
      const m = actor.motion;
      const bones = rest.filter((r) => {
        let o = r.bone;
        while (o && o !== actorFrames.get(actor.id)) o = o.parent;
        return !!o;
      });
      const ownMixers = mixers.filter((m) => m.userData.actor === actor.id);
      if (m.pose === 'clip') {
        if (!ownMixers.length) applyBoothPose(bones, 'rest', 0);
        ownMixers.forEach((mixer) => mixer.setTime(m.time));
      } else {
        ownMixers.forEach((mixer) => mixer.stopAllAction());
        applyBoothPose(
          bones,
          m.pose,
          m.time,
          actorFrames.get(actor.id).getWorldQuaternion(new THREE.Quaternion()),
        );
      }
    }
    stage.updateMatrixWorld(true);
    syncGrips();
    loadMotion({ controls: false });
    const selected = currentActor(),
      report = selected?.rigReport;
    $('pbRigStatus').textContent = report
      ? `${report.skinned} mesh GTA skinned · ${report.static} mesh statis/rigid · ${report.transfers || 0} transfer otomatis. ${[...report.sources].slice(0, 2).join(' · ')} (Periksa animasi dan clipping secara visual.)`
      : 'Pilih ped untuk mengatur emote.';
    const selectedEmote = selected && clipsFor(selected).find((c) => c.id === selected.motion.clip);
    if (selected?.motion.pose === 'clip' && (selectedEmote?.ycd || selectedEmote?.nativeYcd)) {
      const bound = mixers.filter((m) => m.userData.actor === selected.id).length;
      $('pbRigStatus').textContent += bound
        ? ` YCD: ${bound} skeleton terikat ke bone tag GTA.`
        : ' YCD tidak cocok: tidak ditemukan bone tag GTA pada skeleton ped ini. Gunakan skeleton GTA yang sesuai; GLB arbitrer belum diretarget otomatis.';
    }
    if (['relaxed', 'catalog', 'rest'].includes(selected?.motion.pose))
      $('pbRigStatus').textContent +=
        ' Pose ini statis. Pilih Berjalan, Dance atau Lambaikan untuk gerakan.';
    $('pbTime').value = String(time);
    $('pbTimeLabel').textContent = time.toFixed(2) + ' s';
    $('pbPlay').textContent = playing ? 'Ⅱ Jeda' : '▶ Putar';
    $('pbEmotePlay').textContent = playing ? 'Ⅱ' : '▶';
    $('pbEmotePlay').setAttribute(
      'aria-label',
      playing ? 'Jeda emote ped terpilih' : 'Putar emote ped terpilih',
    );
    syncEmoteHeader();
    render();
  }
  function assetList(revealMatches = false) {
    $('pbAssets').replaceChildren();
    $('pbEmpty').hidden = !!assets.length;
    $('pbModelCount').textContent = assets.length + ' / ' + MAX_BOOTH_MODELS + ' model';
    const query = $('pbAssetSearch').value.trim().toLowerCase(),
      filter = $('pbCategoryFilter').value;
    const containers = new Map(),
      owners = actors();
    const liveOwners = new Set(owners.map((a) => a.id));
    for (const id of groupOpen.keys()) if (!liveOwners.has(id)) groupOpen.delete(id);
    for (const id of partOpen.keys()) if (!assets.some((a) => a.id === id)) partOpen.delete(id);
    function groupFor(owner) {
      if (containers.has(owner.id)) return containers.get(owner.id);
      const members = assets.filter((a) => actorForAsset(assets, a) === owner),
        group = document.createElement('details');
      group.className = 'pb-actor-group';
      group.dataset.actorGroup = owner.id;
      if (!groupOpen.has(owner.id))
        groupOpen.set(
          owner.id,
          owner.groupCollapsed === undefined ? owner.id === selectedActor : !owner.groupCollapsed,
        );
      if (revealMatches) groupOpen.set(owner.id, true);
      group.open = groupOpen.get(owner.id);
      group.classList.toggle('pb-group-selected', owner.id === selectedActor);
      group.ontoggle = () => {
        if (group.isConnected) groupOpen.set(owner.id, group.open);
      };
      const summary = document.createElement('summary'),
        text = document.createElement('span'),
        title = document.createElement('strong'),
        detail = document.createElement('small');
      title.textContent =
        owner.label ||
        (owner.kind === 'vehicle'
          ? 'Kendaraan '
          : owner.kind === 'ped'
            ? 'Ped '
            : 'Part mandiri ') +
          (owners.indexOf(owner) + 1);
      detail.textContent = members.length + ' file · ' + owner.name;
      detail.title = owner.name;
      text.append(title, detail);
      const choose = document.createElement('button');
      choose.textContent = owner.id === selectedActor ? 'Dipilih' : 'Pilih';
      choose.dataset.selectActor = owner.id;
      choose.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        selectPed(owner.id);
      };
      summary.append(text, choose);
      group.append(summary);
      const body = document.createElement('div');
      body.className = 'pb-group-body';
      const label = document.createElement('label');
      label.textContent = 'Nama grup';
      const nickname = document.createElement('input');
      nickname.type = 'text';
      nickname.maxLength = 60;
      nickname.placeholder = title.textContent;
      nickname.value = owner.label || '';
      nickname.dataset.actorLabel = owner.id;
      nickname.onchange = () => {
        owner.label = nickname.value.trim().slice(0, 60);
        actorPicker();
        assetList();
        setControls();
      };
      label.append(nickname);
      body.append(label);
      if (owner.kind === 'ped') {
        const candidates = members.filter((a) => a.drawables && !a.referenceOnly);
        if (candidates.length) {
          const label = document.createElement('label');
          label.textContent = 'Bagian untuk ganti YTD';
          const select = document.createElement('select');
          select.dataset.pedYtdTarget = owner.id;
          for (const a of candidates) {
            const o = document.createElement('option');
            o.value = a.id;
            o.textContent = a.name;
            select.append(o);
          }
          label.append(select);
          body.append(label);
          const button = document.createElement('button');
          button.textContent = 'Ganti YTD';
          button.dataset.replacePedYtd = owner.id;
          button.disabled = busy;
          button.onclick = () => chooseReplacementYtd(Number(select.value));
          body.append(button);
        }
      }
      group.append(body);
      $('pbAssets').append(group);
      containers.set(owner.id, body);
      return body;
    }
    for (const a of assets) {
      const category = a.category || outfitCategory(a.name, 'auto', a.kind),
        owner = actorForAsset(assets, a);
      if (
        filter !== 'all' &&
        filter !== category &&
        !(filter === 'vehicle' && category === 'vehicle-part')
      )
        continue;
      if (
        query &&
        ![a.name, owner.label || '', owner.name].some((n) => n.toLowerCase().includes(query))
      )
        continue;
      const parent = groupFor(owner),
        card = document.createElement('details');
      card.dataset.category = category;
      card.dataset.assetCard = a.id;
      card.className = 'pb-asset pb-part-card';
      card.open = partOpen.get(a.id) || false;
      card.ontoggle = () => {
        if (card.isConnected) partOpen.set(a.id, card.open);
      };
      const summary = document.createElement('summary'),
        name = document.createElement('strong'),
        type = document.createElement('small');
      name.textContent = a.name;
      type.textContent = a.referenceOnly
        ? 'Skeleton acuan'
        : a.vehicleAlt
          ? 'LOD _hi alternatif'
          : outfitLabel(category);
      summary.append(name, type);
      card.append(summary);
      const label = document.createElement('label');
      label.className = 'check';
      const visible = document.createElement('input');
      visible.type = 'checkbox';
      visible.checked = a.visible;
      visible.onchange = () => {
        a.visible = visible.checked;
        if (a.visible && a.kind === 'vehicle-part') {
          for (const b of assets.filter(
            (b) =>
              b.kind === 'vehicle-part' &&
              b.owner === a.owner &&
              b !== a &&
              a.vehicleSlot &&
              b.vehicleSlot === a.vehicleSlot,
          ))
            b.visible = false;
          if (a.vehicleAlt) owner.visible = false;
        }
        if (a.visible && a.kind === 'vehicle')
          for (const b of assets.filter((b) => b.owner === a.id && b.vehicleAlt)) b.visible = false;
        rebuild({ fitCamera: false });
      };
      label.append(
        visible,
        document.createTextNode(
          a.referenceOnly
            ? 'Skeleton acuan · tidak ikut difoto'
            : 'Tampilkan · ' + outfitLabel(category),
        ),
      );
      if (a.referenceOnly) {
        visible.disabled = true;
        visible.dataset.referenceCheckbox = 'true';
      }
      card.append(label);
      if (a.kind === 'vehicle-part') {
        const info = document.createElement('p');
        info.className = 'muted';
        info.textContent = a.vehicleAlt
          ? 'LOD _hi alternatif · aktifkan untuk mengganti model dasar'
          : 'Part kendaraan · ' +
            (a.vehicleSlot || 'manual') +
            ' · ' +
            (a.vehicleBone || 'chassis');
        card.append(info);
      }
      if (!['ped', 'vehicle', 'vehicle-part'].includes(a.kind)) {
        const label = document.createElement('label');
        label.textContent = 'Jenis outfit';
        const select = document.createElement('select');
        select.dataset.outfitCategory = a.id;
        for (const [id, title] of OUTFIT_CATEGORIES) {
          const o = document.createElement('option');
          o.value = id;
          o.textContent = title;
          select.append(o);
        }
        select.value = category;
        select.onchange = () => {
          a.category = select.value;
          assetList();
        };
        label.append(select);
        card.append(label);
      }
      if (!a.referenceOnly && a.drawables && owner.kind === 'ped') {
        const replace = document.createElement('button');
        replace.textContent = 'Ganti YTD bagian ini';
        replace.dataset.replaceYtd = a.id;
        replace.onclick = () => chooseReplacementYtd(a.id);
        card.append(replace);
        const current = textureFiles.filter((f, i) => textureOwners[i] === a.id).map((f) => f.name);
        if (current.length) {
          const info = document.createElement('p');
          info.className = 'muted';
          info.dataset.ytdSource = a.id;
          info.textContent = 'Tekstur: ' + current.join(', ');
          card.append(info);
        }
      }
      if (!a.referenceOnly) {
        const owner = actorForAsset(assets, a),
          available = [
            ...textures.filter((t) => t.boothOwner === a.id),
            ...textures.filter((t) => t.boothOwner === owner.id),
            ...(a.drawables || []).flatMap((d) => d.embeddedTextures || []),
          ];
        if (available.length) {
          const label = document.createElement('label');
          label.textContent = 'Tekstur diffuse semua mesh · preview';
          const select = document.createElement('select');
          select.dataset.previewTexture = a.id;
          const auto = document.createElement('option');
          auto.value = '';
          auto.textContent = 'Otomatis sesuai material';
          select.append(auto);
          const keys = new Set();
          for (const t of available) {
            if (/normal|spec|bump|_(?:n|s)$/i.test(t.name)) continue;
            const key = JSON.stringify([t.dictionary || '', t.name]);
            if (keys.has(key)) continue;
            keys.add(key);
            const o = document.createElement('option');
            o.value = key;
            o.textContent = t.name + ' · ' + (t.dictionary || 'embedded');
            select.append(o);
          }
          select.value = a.textureOverride || '';
          select.onchange = () => {
            a.textureOverride = select.value;
            rebuild({ fitCamera: false });
          };
          label.append(select);
          card.append(label);
        }
      }
      if (owner.kind === 'vehicle' && a.drawables) {
        const automatic = document.createElement('button');
        automatic.textContent = 'Otomatiskan semua material';
        automatic.dataset.autoVehicleTextures = a.id;
        automatic.onclick = () => {
          for (const part of assets.filter((b) => actorForAsset(assets, b) === owner))
            part.textureOverride = '';
          rebuild({ fitCamera: false });
        };
        const report = document.createElement('details'),
          title = document.createElement('summary');
        const rows = [
          ...new Map((a.textureReport || []).map((row) => [JSON.stringify(row), row])).values(),
        ];
        title.textContent = `Diffuse otomatis: ${rows.filter((r) => r.dictionary).length}/${rows.length} map`;
        report.append(title);
        for (const row of rows.slice(0, 200)) {
          const line = document.createElement('p');
          line.textContent =
            row.name + ' → ' + (row.dictionary || 'belum ditemukan; tambahkan YTD sumber');
          report.append(line);
        }
        card.append(automatic, report);
      }
      if (a.drawables?.length > 1) {
        const select = document.createElement('select');
        select.setAttribute('aria-label', 'Drawable ' + a.name);
        for (const [i, title] of [
          [-1, 'Semua drawable'],
          ...a.drawables.map((d, i) => [i, d.name]),
        ]) {
          const o = document.createElement('option');
          o.value = String(i);
          o.textContent = title;
          select.append(o);
        }
        select.value = String(a.drawable);
        select.onchange = () => {
          a.drawable = Number(select.value);
          rebuild();
        };
        card.append(select);
      }
      for (const slot of new Set((a.drawables || []).map((d) => d.componentSlot).filter(Boolean))) {
        const l = document.createElement('label');
        l.className = 'check';
        const c = document.createElement('input');
        c.type = 'checkbox';
        c.checked = !a.hiddenSlots.has(slot);
        c.onchange = () => {
          if (c.checked) a.hiddenSlots.delete(slot);
          else a.hiddenSlots.add(slot);
          rebuild();
        };
        l.append(c, document.createTextNode(slot));
        card.append(l);
      }
      if (!['ped', 'vehicle', 'vehicle-part'].includes(a.kind)) {
        const ownerLabel = document.createElement('label');
        ownerLabel.textContent = 'Pemilik outfit / aksesori';
        const ownerSelect = document.createElement('select');
        ownerSelect.dataset.owner = a.id;
        for (const ped of assets.filter((a) => a.kind === 'ped')) {
          const o = document.createElement('option');
          o.value = ped.id;
          o.textContent =
            assets.filter((b) => b.kind === 'ped').indexOf(ped) + 1 + ' · ' + ped.name;
          ownerSelect.append(o);
        }
        ownerSelect.value = String(a.owner);
        ownerSelect.onchange = () => {
          a.owner = Number(ownerSelect.value);
          groupOpen.set(a.owner, true);
          if (!a.grip) a.attach = 'auto';
          rebuild({ fitCamera: false });
        };
        ownerLabel.append(ownerSelect);
        card.append(ownerLabel);
        const grips = document.createElement('div');
        grips.className = 'pb-buttons';
        for (const [side, title] of [
          ['R', 'Pegang · kanan'],
          ['L', 'Pegang · kiri'],
        ]) {
          const button = document.createElement('button');
          button.textContent = title;
          button.dataset.grip = side;
          button.onclick = () => {
            const owner = actorForAsset(assets, a);
            const target = findBoothAttachmentBone(
              assets
                .filter(
                  (b) =>
                    actorForAsset(assets, b) === owner &&
                    !isRigidBoothProp(b) &&
                    b !== a &&
                    b.visible,
                )
                .map((b) => b.root),
              'SKEL_' + side + '_Hand',
            );
            if (!target)
              return setStatus('Bone tangan tidak ditemukan. Tambahkan skeleton ped yang cocok.');
            a.attach = target.name;
            a.grip = true;
            a.offset = [0, 0, 0];
            a.yaw = a.pitch = a.roll = 0;
            rebuild({ fitCamera: false });
          };
          grips.append(button);
        }
        card.append(grips);
        if (isRigidBoothProp(a)) {
          const status = document.createElement('p');
          status.className = 'muted';
          status.dataset.propStatus = a.id;
          status.textContent = a.attachmentStatus || 'Prop belum terikat · pilih tangan kanan/kiri';
          card.append(status);
        }
        const targets = [];
        const owner = actorForAsset(assets, a);
        for (const source of assets.filter(
          (b) => actorForAsset(assets, b) === owner && !isRigidBoothProp(b) && b !== a,
        ))
          source.root.traverse((o) => {
            if (o.isBone) targets.push(o);
          });
        const label = document.createElement('label');
        label.textContent = 'Ikuti bone (aksesori rigid)';
        const select = document.createElement('select');
        select.dataset.bone = a.id;
        const auto = document.createElement('option');
        auto.value = 'auto';
        auto.textContent = 'Otomatis / rig sendiri';
        select.append(auto);
        for (const name of new Set([
          ...targets.map((b) => b.name),
          ...(a.attach !== 'auto' ? [a.attach] : []),
        ])) {
          const o = document.createElement('option');
          o.value = name;
          o.textContent = name;
          select.append(o);
        }
        select.value = a.attach;
        select.onchange = () => {
          a.attach = select.value;
          a.grip = isRigidBoothProp(a) && select.value !== 'auto';
          rebuild({ fitCamera: false });
        };
        label.append(select);
        card.append(label);
      }
      {
        const fields = document.createElement('div');
        fields.className = 'pb-offsets';
        for (let k = 0; k < 4; k++) {
          const l = document.createElement('label');
          l.textContent = ['X', 'Y · tinggi', 'Z · kedalaman', 'Skala'][k];
          const input = document.createElement('input');
          input.type = 'number';
          input.step = '0.01';
          input.value = String(k < 3 ? a.offset[k] : a.scale);
          input.setAttribute('aria-label', l.textContent + ' ' + a.name);
          input.onchange = () => {
            const v = Number(input.value);
            if (!Number.isFinite(v) || Math.abs(v) > 100 || (k === 3 && v <= 0)) return;
            if (k < 3) a.offset[k] = v;
            else {
              a.scale = v;
              a.targetHeightCm = null;
            }
            updateTransform(a);
          };
          l.append(input);
          fields.append(l);
        }
        const turn = document.createElement('input');
        turn.type = 'number';
        turn.min = '-360';
        turn.max = '360';
        turn.step = '5';
        turn.value = a.yaw || 0;
        turn.setAttribute('aria-label', 'Rotasi ' + a.name);
        turn.onchange = () => {
          const v = Number(turn.value);
          if (!Number.isFinite(v) || Math.abs(v) > 360) return;
          a.yaw = v;
          updateTransform(a);
        };
        if (['ped', 'vehicle'].includes(a.kind)) {
          const label = document.createElement('label');
          label.textContent = 'Arah ped · derajat';
          label.append(turn);
          card.append(label);
          const select = document.createElement('button');
          select.textContent = 'Atur emote ped ini';
          select.onclick = () => selectPed(a.id);
          card.append(select);
        }
        if (!['ped', 'vehicle'].includes(a.kind)) {
          const yawLabel = document.createElement('label');
          yawLabel.textContent = 'Rotasi Y · derajat';
          yawLabel.append(turn);
          card.append(yawLabel);
          for (const [key, text] of [
            ['pitch', 'Rotasi X'],
            ['roll', 'Rotasi Z'],
          ]) {
            const label = document.createElement('label'),
              input = document.createElement('input');
            label.textContent = text + ' · derajat';
            input.type = 'number';
            input.min = -360;
            input.max = 360;
            input.step = 5;
            input.value = a[key] || 0;
            input.onchange = () => {
              const value = Number(input.value);
              if (!Number.isFinite(value) || Math.abs(value) > 360) return;
              a[key] = value;
              updateTransform(a);
            };
            label.append(input);
            card.append(label);
          }
        }
        card.append(fields);
      }
      const remove = document.createElement('button');
      remove.textContent = 'Hapus';
      remove.onclick = () => {
        const dependents = assets.filter((b) => b.owner === a.id);
        const obsoleteRefs = new Set(dependents.filter((b) => b.referenceOnly));
        for (const b of dependents) {
          b.owner = null;
          b.motion = { ...a.motion, playing: false };
        }
        const kept = textureFiles
          .map((file, i) => ({ file, owner: textureOwners[i] }))
          .filter((row) => row.owner !== a.id);
        textureFiles = kept.map((row) => row.file);
        textureOwners = kept.map((row) => row.owner);
        textures = textures.filter((t) => t.boothOwner !== a.id);
        assets = assets.filter((b) => b !== a && !obsoleteRefs.has(b));
        loadMotion();
        rebuild();
        disposeGlb(a);
      };
      card.append(remove);
      parent.append(card);
    }
  }
  function disposeGlb(a) {
    if (!a.gltf) return;
    const disposed = new Set();
    a.gltf.scene.traverse((o) => {
      o.geometry?.dispose();
      if (o.skeleton && !disposed.has(o.skeleton)) {
        disposed.add(o.skeleton);
        o.skeleton.dispose();
      }
      for (const m of Array.isArray(o.material) ? o.material : [o.material])
        if (m) {
          for (const v of Object.values(m))
            if (v?.isTexture && !disposed.has(v)) {
              disposed.add(v);
              v.dispose();
            }
          m.dispose();
        }
    });
  }
  async function parseGlb(file) {
    if (file.size > 64 * 1024 ** 2) throw Error('GLB maksimal 64 MB.');
    const buffer = await file.arrayBuffer();
    if (buffer.byteLength < 20 || new DataView(buffer).getUint32(0, true) !== 0x46546c67)
      throw Error('Pilih GLB binary yang valid.');
    const manager = new THREE.LoadingManager();
    manager.setURLModifier((url) => {
      if (!/^(blob:|data:)/.test(url))
        throw Error('GLB harus menyertakan gambar/buffer di dalam file.');
      return url;
    });
    return new GLTFLoader(manager).parseAsync(buffer, '');
  }
  async function importFiles(files, assetKind, category = 'auto', options = {}) {
    if (options.targetActorId != null && !assets.some(a => a.id === options.targetActorId && a.kind === 'ped'))
      throw Error('Ped tujuan tidak ditemukan. Pilih ped freemode lagi.');
    if (options.referenceOnly && !currentActor())
      throw Error('Buka ped dahulu sebelum mengimpor skeleton acuan.');
    if (!files.length) return;
    ensure();
    const models = files.filter((f) => /\.(ydd|ydr|yft|glb)$/i.test(f.name)),
      images = files.filter((f) => /\.(ytd|dds|png|jpg|jpeg|webp)$/i.test(f.name));
    if (images.length + textureFiles.length > 1000)
      throw Error('Maksimal 1.000 file tekstur per scene.');
    if (assets.length + models.length > MAX_BOOTH_MODELS)
      throw Error('Maksimal ' + MAX_BOOTH_MODELS + ' model per sesi.');
    if (
      assets.reduce((n, a) => n + (a.file?.size || 0), 0) + models.reduce((n, f) => n + f.size, 0) >
      MAX_BOOTH_MODEL_BYTES
    )
      throw Error('Total file model maksimal 1 GB per scene.');
    const metadata =
      assetKind === 'vehicle'
        ? vehicleModManifest(
            await Promise.all(
              files
                .filter((f) => /\.meta$/i.test(f.name))
                .map(async (f) => {
                  if (f.size > 2 * 1024 ** 2) throw Error(f.name + ': metadata maksimal 2 MB.');
                  return f.text();
                }),
            ),
          )
        : [];
    const textureParents = [];
    for (const file of files.filter((f) => isTextureParentFile(f.name))) {
      if (file.size > 2 * 1024 ** 2) throw Error(file.name + ': metadata maksimal 2 MB.');
      textureParents.push(...parseTextureParents(await file.text()));
    }
    const pending = [];
    try {
      for (const file of models) {
        if (file.size > 64 * 1024 ** 2) throw Error('Model maksimal 64 MB.');
        setStatus('Membaca ' + file.name + '…');
        const a = {
          id: ++token,
          name: file.name,
          kind: assetKind,
          category:
            assetKind === 'vehicle-part'
              ? 'vehicle-part'
              : outfitCategory(file.name, category, assetKind),
          matte: false,
          visible: !options.referenceOnly,
          referenceOnly: !!options.referenceOnly,
          rigChoice: options.rigChoice || 'auto',
          file,
          offset: [
            ['ped', 'vehicle'].includes(assetKind)
              ? (actors().length +
                  pending.filter((a) => ['ped', 'vehicle'].includes(a.kind)).length) *
                1.5
              : 0,
            0,
            0,
          ],
          yaw: 0,
          owner: options.targetActorId != null && assetKind !== 'ped' && assetKind !== 'vehicle'
            ? options.targetActorId
            : ['ped', 'vehicle'].includes(assetKind)
            ? null
            : assetKind === 'vehicle-part' && currentActor()?.kind === 'vehicle'
              ? currentActor().id
              : currentActor()?.kind === 'ped'
                ? currentActor().id
                : null,
          motion: createActorMotion(),
          scale: 1,
          attach: 'auto',
          hiddenSlots: new Set(),
        };
        if (a.category === 'prop') {
          a.grip = true;
          a.attach = 'SKEL_R_Hand';
        }
        if (/\.glb$/i.test(file.name)) a.gltf = await parseGlb(file);
        else {
          try {
            a.drawables = await decodeResource(
              file.name.split('.').pop().toLowerCase(),
              await file.arrayBuffer(),
            );
          } catch (e) {
            throw Error(file.name + ': ' + e.message);
          }
          a.drawable = defaultDrawableSelection(a.drawables);
        }
        if (options.referenceOnly && !(a.drawables || []).some((d) => d.rig?.length))
          throw Error(
            file.name + ': file ini tidak memiliki skeleton. Pilih YFT/YDD acuan yang lengkap.',
          );
        pending.push(a);
      }
      if (assetKind === 'ped' && options.singleActor) {
        const primary = pending.find((a) => !/\.yft$/i.test(a.name));
        if (!primary) throw Error('Karakter freemode memerlukan model kepala.');
        for (const a of pending)
          if (a !== primary) {
            a.kind = /hair_|teef_|\.yft$/i.test(a.name) ? 'accessory' : 'clothing';
            a.category = outfitCategory(a.name, 'auto', a.kind);
            a.owner = primary.id;
            a.offset = [0, 0, 0];
          }
      }
      if (assetKind === 'vehicle') groupBoothVehicles(pending, assets, metadata);
      if (assetKind === 'ped') {
        const primaries = pending.filter((a) => !/\.yft$/i.test(a.name));
        for (const a of pending.filter((a) => /\.yft$/i.test(a.name))) {
          const stem = a.name.replace(/\.[^.]+$/, '').toLowerCase();
          const owner =
            primaries.find((b) => b.name.replace(/\.[^.]+$/, '').toLowerCase() === stem) ||
            (primaries.length === 1 ? primaries[0] : null);
          if (owner) {
            a.kind = 'accessory';
            a.category = 'other';
            a.owner = owner.id;
            a.offset = [0, 0, 0];
          }
        }
        pending
          .filter((a) => a.kind === 'ped')
          .forEach((a, i) => {
            a.offset[0] = (assets.filter((b) => b.kind === 'ped').length + i) * 1.5;
          });
      }
      const all = [...assets, ...pending];
      if (textureParents.length > 4096) throw Error('Maksimal 4096 relasi dictionary per impor.');
      if (textureParents.length)
        for (const a of all.filter((a) => a.kind === 'vehicle')) {
          a.textureParents = [
            ...new Map(
              [...(a.textureParents || []), ...textureParents].map((p) => [JSON.stringify(p), p]),
            ).values(),
          ];
        }
      if (all.reduce((n, a) => n + boothVertexCount(a), 0) > MAX_BOOTH_VERTICES)
        throw Error(
          'Scene melebihi 5 juta vertex. Kurangi model atau gunakan LOD yang lebih ringan.',
        );
      const refs = modelTextureReferences(all.flatMap((a) => a.drawables || []));
      const warnings = [];
      for (const file of images) {
        const loaded = await loadVehicleTextures([file], refs, {
          decode: decodeResource,
          image: imageData,
          existing: textures,
        });
        const vehicleImport =
          ['vehicle', 'vehicle-part', 'vehicle-texture'].includes(assetKind) ||
          (assetKind === 'texture' && currentActor()?.kind === 'vehicle');
        const target = vehicleImport
          ? vehicleTextureTarget(file, all, loaded.textures, textureParents)
          : outfitTextureTarget(
              file,
              pending,
              currentActor() || pending.find((a) => a.kind === 'ped'),
              loaded.textures,
              (a) => modelTextureReferences(a.drawables || []),
            );
        const ownerId = target?.id ?? null;
        const merged = [
          ...textures.filter((t) => t.boothOwner !== ownerId),
          ...mergeVehicleTextures(
            textures.filter((t) => t.boothOwner === ownerId),
            loaded.textures.map((t) => ({ ...t, boothOwner: ownerId })),
          ),
        ];
        if (merged.reduce((n, t) => n + t.out.length, 0) > MAX_DECODED_TEXTURE_BYTES)
          throw Error('Tekstur booth melebihi batas decoded 1024 MB.');
        textures = merged;
        textureFiles.push(file);
        textureOwners.push(ownerId);
        warnings.push(...loaded.warnings);
      }
      saveMotion();
      assets.push(...pending);
      if (pending.length) root.querySelector('.pb-outfit-import').open = false;
      if (pending.some((a) => ['ped', 'vehicle'].includes(a.kind)))
        selectedActor = pending.find((a) => ['ped', 'vehicle'].includes(a.kind)).id;
      loadMotion();
      rebuild();
      if (warnings.length) setStatus(warnings.join(' · '));
    } catch (e) {
      pending.filter((a) => !assets.includes(a)).forEach(disposeGlb);
      throw e;
    }
  }
  $('pbSavedOutfits').onclick = async () => {
    const library = window.ditashaClothing;
    if (!library) { setStatus('Clothing Library tidak tersedia pada mode ini.'); return; }
    const button = $('pbSavedOutfits');
    button.disabled = true;
    try {
      const outfits = await library.listOutfits();
      if (!outfits.length) { setStatus('Belum ada outfit tersimpan di Clothing Library.'); return; }
      const answer = window.prompt(
        'Pilih nomor outfit untuk Photo Booth:\n' +
          outfits.map((outfit, i) => (i + 1) + '. ' + outfit.name +
            ' (' + outfit.gender + ', ' + outfit.slots.length + ' item)').join('\n'), '1');
      if (answer === null) return;
      const index = Number(answer) - 1;
      if (!Number.isInteger(index) || !outfits[index]) throw Error('Nomor outfit tidak valid.');
      const outfit = outfits[index];
      const packs = await library.list();
      const selected = resolveOutfitEntries(packs, outfit.slots);
      const owner = currentActor();
      if (!owner || owner.kind !== 'ped') throw Error('Pilih atau import ped freemode terlebih dahulu agar outfit menempel pada karakter.');
      const files = [];
      for (const {packId, entry} of selected) {
        const data = await library.previewRead(packId, entry.relativePath);
        files.push(new File([data.bytes], freemodeImportName(entry)));
      }
      await importFiles(files, 'clothing', 'auto', { targetActorId: owner.id });
      const risks = outfitLayerWarnings(assets, owner.id);
      setStatus('Outfit ' + outfit.name + ' dimuat ke ' + owner.name + '. ' + (risks.length ? 'Potensi clipping: ' + risks.join(' ') : 'Tidak terdeteksi pasangan layer berisiko; tetap cek visual.'));
    } catch (error) {
      setStatus('Gagal memuat outfit: ' + error.message);
    } finally { button.disabled = false; }
  };
  $('pbSavedCharacters').onclick = async () => {
    try {
      const characters=await window.ditashaCharacters?.list?.() || [];
      if (!characters.length) return setStatus('Belum ada karakter. Buka Character Maker untuk membuatnya.');
      const answer=window.prompt('Pilih karakter tersimpan:\\n'+
        characters.map((c,i)=>(i+1)+'. '+c.name+' ('+c.gender+')').join('\\n'),'1');
      if (answer===null) return;
      const selected=characters[Number(answer)-1];
      if (!selected) throw Error('Nomor karakter tidak valid.');
      const outfit=(await window.ditashaClothing.listOutfits()).find(o=>o.id===selected.outfitId);
      const packs=await window.ditashaClothing.list();
      const files=[];
      const baseFiles=[];
      if(selected.baseModel)for(const {packId,entry} of resolveCharacterBodyEntries(packs,selected.baseModel,selected.gender)){
        const data=await window.ditashaClothing.previewRead(packId,entry.relativePath);
        baseFiles.push(new File([data.bytes],freemodeImportName(entry)));
      }
      if(outfit)for(const {packId,entry} of resolveOutfitEntries(packs,outfit.slots)){
        const data=await window.ditashaClothing.previewRead(packId,entry.relativePath);
        files.push(new File([data.bytes],freemodeImportName(entry)));
      }
      const result=await new Promise(resolve=>window.dispatchEvent(new CustomEvent(
        'ditasha:character-to-booth',{detail:{preset:selected,files,baseFiles,onComplete:resolve}})));
      if(!result.success)throw Error(result.error);
    }catch(error){setStatus('Karakter tersimpan: '+error.message);}
  };
  // Character Maker hands off saved freemode appearance metadata and optional outfit.
  // Face blend and facial morphs are NOT applied to the offline GTA mesh yet.
  window.addEventListener('ditasha:character-to-booth', async (event) => {
    const detail=event.detail;
    if (!detail?.preset || !Array.isArray(detail.files)) return;
    try {
      activate('photobooth');
      // When the preset contains an actual source YDD, create a new ped without
      // requiring the user to re-import a freemode reference each session.
      const sourceFiles=Array.isArray(detail.baseFiles)?detail.baseFiles:(detail.baseFile?[detail.baseFile]:[]);
      if (sourceFiles.length) await importFiles(sourceFiles, 'ped', 'auto', {singleActor:true});
      const owner=currentActor();
      if (!owner || owner.kind !== 'ped')
        throw Error('Pilih model YDD kepala/tubuh dalam Character Maker atau impor ped freemode dahulu.');
      const actual=freemodeFamily(owner.name);
      if (actual && actual !== detail.preset.gender)
        throw Error('Gender ped tidak sama dengan preset. Pilih ped '+detail.preset.gender+'.');
      if (detail.files.length)
        await importFiles(detail.files,'clothing','auto',{targetActorId:owner.id});
      owner.characterPresetId=detail.preset.id;
      owner.characterAppearance=detail.preset.appearance;
      owner.characterMorphPack=detail.morphPack||null;
      rebuild({fitCamera:false});
      setStatus('Karakter '+detail.preset.name+' ditautkan ke '+owner.name+
        '. Outfit dimuat; morph wajah '+(owner.characterMorphPack ? 'diproses jika topologi kepala sesuai.' : 'tidak tersedia tanpa morph pack.'));
      detail.onComplete?.({success:true});
    } catch(error) {
      setStatus('Character Maker: '+error.message);
      detail.onComplete?.({success:false,error:error.message});
    }
  });
  // Clothing Library V2 sends actual persisted YDD/YTD files to the existing booth importer.
  // This imports outfit parts into the stage; it does not invent a freemode body or morphs.
  window.addEventListener('ditasha:clothing-outfit-to-booth', async (event) => {
    const detail = event.detail;
    if (!detail || !Array.isArray(detail.files) || !detail.files.length) return;
    try {
      activate('photobooth');
      const owner = currentActor();
      if (!owner || owner.kind !== 'ped') throw Error('Import ped freemode di Photo Booth dahulu, kemudian kirim outfit.');
      await importFiles(detail.files, 'clothing', 'auto', { targetActorId: owner.id });
      const risks = outfitLayerWarnings(assets, owner.id);
      setStatus('Outfit dimuat ke ' + owner.name + '. ' + (risks.length ? 'Potensi clipping: ' + risks.join(' ') : 'Cek hasil secara visual untuk clipping.'));
      detail.onComplete?.({ success: true });
    } catch (error) {
      setStatus('Gagal memuat outfit library: ' + error.message);
      detail.onComplete?.({ success: false, error: error.message });
    }
  });
  mountFreemodeCharacter({
    container: root.querySelector('.pb-assets'),
    guard,
    importFiles,
    setStatus,
  });
  for (const [id, value] of [
    ['pbPed', 'ped'],
    ['pbVehicle', 'vehicle'],
    ['pbVehiclePart', 'vehicle-part'],
    ['pbClothes', 'clothing'],
    ['pbAccessory', 'accessory'],
    ['pbProp', 'accessory'],
  ])
    $(id).onclick = () => {
      kind = value;
      importCategory = id === 'pbProp' ? 'prop' : 'auto';
      $('pbInput').click();
    };
  for (const [id, label, type] of OUTFIT_CATEGORIES) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.importOutfit = id;
    button.textContent = '+ ' + label;
    button.onclick = () => {
      kind = type;
      importCategory = id;
      $('pbInput').click();
    };
    $('pbOutfitButtons').append(button);
  }
  for (const [id, open] of [
    ['pbCollapseGroups', false],
    ['pbExpandGroups', true],
  ])
    $(id).onclick = () => {
      for (const a of actors()) groupOpen.set(a.id, open);
      for (const group of $('pbAssets').querySelectorAll('[data-actor-group]')) group.open = open;
    };
  function propCatalog() {
    const query = $('pbPropSearch').value.trim().toLowerCase();
    $('pbPropCatalog').replaceChildren(
      ...GTA_HAND_PROPS.filter(([name, label]) =>
        (name + ' ' + label).toLowerCase().includes(query),
      ).map(([name, label]) => {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = label + ' · ' + name;
        return option;
      }),
    );
  }
  $('pbPropSearch').oninput = propCatalog;
  propCatalog();
  $('pbVehicleFolder').onclick = () => $('pbVehicleFolderInput').click();
  $('pbVehicleFolderInput').onchange = (e) => {
    const files = [...e.target.files].filter((f) => /\.(yft|ydr|ydd|ytd|glb|meta)$/i.test(f.name));
    e.target.value = '';
    guard(() => importFiles(files, 'vehicle'));
  };
  $('pbCategoryFilter').onchange = () => assetList(true);
  $('pbAssetSearch').oninput = () => assetList(true);
  $('pbFolder').onclick = () => {
    $('pbFolderInput').click();
  };
  $('pbFolderInput').onchange = (e) => {
    const files = [...e.target.files].filter((f) =>
      /\.(ydd|ydr|yft|ytd|glb|dds|png|jpg|jpeg|webp)$/i.test(f.name),
    );
    e.target.value = '';
    guard(() => importFiles(files, 'clothing', $('pbImportCategory').value));
  };
  $('pbInput').onchange = (e) => {
    const files = [...e.target.files];
    e.target.value = '';
    guard(() => importFiles(files, kind, importCategory));
  };
  function chooseReplacementYtd(id) {
    if (busy) return;
    replaceYtdTarget = id;
    $('pbReplaceYtdInput').click();
  }
  $('pbReplaceYtdInput').onchange = (e) => {
    const file = e.target.files[0],
      id = replaceYtdTarget;
    e.target.value = '';
    replaceYtdTarget = null;
    if (!file) return;
    guard(async () => {
      const target = assets.find((a) => a.id === id);
      if (
        !target?.drawables ||
        target.referenceOnly ||
        actorForAsset(assets, target).kind !== 'ped'
      )
        throw Error('Bagian ped tidak tersedia. Pilih ulang modelnya.');
      if (!/\.ytd$/i.test(file.name)) throw Error('Pilih file YTD.');
      const retained = textures.filter((t) => t.boothOwner !== id);
      const loaded = await loadVehicleTextures([file], modelTextureReferences(target.drawables), {
        decode: decodeResource,
        image: imageData,
        existing: retained,
      });
      if (loaded.warnings.length) throw Error(loaded.warnings.join(' · '));
      const next = replaceBoothTextureScope(
        { textures, textureFiles, textureOwners },
        id,
        file,
        loaded.textures,
      );
      if (next.textures.reduce((n, t) => n + t.out.length, 0) > MAX_DECODED_TEXTURE_BYTES)
        throw Error('Tekstur booth melebihi 1024 MB.');
      if (next.textureFiles.length > 1000) throw Error('Maksimal 1000 file tekstur.');
      ({ textures, textureFiles, textureOwners } = next);
      target.textureOverride = '';
      rebuild({ fitCamera: false });
      setStatus(
        'YTD ' +
          target.name +
          ' diganti: ' +
          file.name +
          '. Jika nama map berbeda, pilih tekstur preview pada kartu bagian.',
      );
    });
  };
  const vehicleMaps = document.createElement('button');
  vehicleMaps.id = 'pbVehicleTextureFolder';
  vehicleMaps.textContent = 'Folder tekstur kendaraan';
  vehicleMaps.title =
    'Baca semua YTD dan relasi vehicles.meta/gtxd dari folder resource, lalu pasangkan per material';
  $('pbVehicleFolder').after(vehicleMaps);
  const vehicleMapInput = document.createElement('input');
  vehicleMapInput.type = 'file';
  vehicleMapInput.multiple = true;
  vehicleMapInput.webkitdirectory = true;
  vehicleMapInput.hidden = true;
  root.append(vehicleMapInput);
  vehicleMaps.onclick = () => vehicleMapInput.click();
  vehicleMapInput.onchange = (e) => {
    const files = [...e.target.files].filter(
      (f) => /\.(ytd|dds|png|jpg|jpeg|webp)$/i.test(f.name) || isTextureParentFile(f.name),
    );
    e.target.value = '';
    guard(() => importFiles(files, 'vehicle-texture'));
  };
  $('pbTextures').onclick = () => $('pbTextureInput').click();
  $('pbTextureInput').onchange = (e) => {
    const files = [...e.target.files];
    e.target.value = '';
    guard(() => importFiles(files, 'texture'));
  };
  $('pbImportClip').onclick = () => $('pbClipInput').click();
  async function decodeEmote(file, prefix) {
    if (file.size > 64 * 1024 ** 2) throw Error('File emote maksimal 64 MB.');
    if (/\.ycd$/i.test(file.name)) {
      const decoded = readYcd(await file.arrayBuffer());
      return {
        entries: decoded.clips.map((ycd, i) => ({
          ycd,
          clip: { name: ycd.name, duration: ycd.duration, tracks: [] },
          id: prefix + ':' + i,
          label: file.name + ' / ' + ycd.name,
        })),
        warnings: decoded.warnings,
        values: decoded.values,
        memoryBytes: decoded.memoryBytes,
      };
    }
    if (!/\.glb$/i.test(file.name)) throw Error('Pilih emote .ycd atau .glb.');
    const gltf = await parseGlb(file);
    try {
      if (!gltf.animations.length || gltf.animations.length > 256)
        throw Error('GLB memerlukan 1–256 clip.');
      return {
        entries: gltf.animations.map((clip, i) => ({
          clip,
          id: prefix + ':' + i,
          label: file.name + ' / ' + clip.name,
        })),
        warnings: [],
        memoryBytes:
          file.size +
          gltf.animations.reduce(
            (n, c) =>
              n + c.tracks.reduce((n, t) => n + t.values.byteLength + t.times.byteLength, 0),
            0,
          ),
        values: gltf.animations.reduce(
          (n, c) => n + c.tracks.reduce((n, t) => n + t.values.length, 0),
          0,
        ),
      };
    } finally {
      disposeGlb({ gltf });
    }
  }
  $('pbClipSearch').oninput = () => {
    updateClips();
    applyPose();
    setControls();
  };
  $('pbClipInput').onchange = (e) => {
    const files = [...e.target.files];
    e.target.value = '';
    if (files.length) guard(() => importEmoteFiles(files));
  };
  async function importEmoteFiles(inputs) {
    const files = await expandEmoteFiles(inputs);
    let first = null;
    const errors = [];
    let duplicateCount = 0;
    for (const file of files) {
      try {
        const prefix = 'external:' + ++clipSerial,
          decoded = await emoteCatalog.add(file, prefix);
        if (decoded.duplicate) {
          duplicateCount++;
          continue;
        }
        externalClips.push(...decoded.entries);
        clipFiles = [...emoteCatalog.sources];
        first ||= prefix + ':0';
        if ($('pbEmoteAutoSave').checked) {
          try {
            await emoteVault.save(file, decoded.source.key);
          } catch (error) {
            errors.push(file.name + ': belum tersimpan antar sesi · ' + error.message);
          }
        }
        errors.push(...decoded.warnings.map((w) => file.name + ': ' + w));
      } catch (e) {
        errors.push(
          ...(e.details?.length
            ? e.details.map((w) => file.name + ': ' + w)
            : [file.name + ': ' + e.message]),
        );
      }
    }
    if (first) {
      $('pbClipSearch').value = '';
      $('pbPose').value = 'clip';
      time = 0;
      playing = false;
      saveMotion();
      if (currentActor()) currentActor().motion.clip = first;
      await updateClips();
      applyPose();
      setControls();
    }
    const modelIssues = [...$('pbIssueList').children]
      .map((n) => n.textContent)
      .filter((m) => !emoteIssues.includes(m));
    emoteIssues = [...new Set(errors)].slice(0, 200);
    if (errors.length > 200)
      emoteIssues.push(errors.length - 200 + ' peringatan lain tidak ditampilkan.');
    updateIssues(modelIssues);
    setStatus(
      `${clipFiles.length} file emote · ${externalClips.length} clip. ` +
        (duplicateCount ? `${duplicateCount} file duplikat dilewati. ` : '') +
        (errors.length
          ? errors.length + ' peringatan. Klik Lihat masalah.'
          : 'Pilih emote lalu Putar untuk ped terpilih.'),
    );
    await vaultStatus().catch((error) => {
      $('pbEmoteVaultStatus').textContent = error.message;
    });
  }
  $('pbClear').onclick = () => {
    playing = false;
    movie.pause();
    movieBase = null;
    if (stage) clearStage();
    assets.forEach(disposeGlb);
    assets = [];
    textures = [];
    animatedMeshes = 0;
    externalClips = [];
    emoteIssues = [];
    updateIssues([]);
    emoteCatalog = createEmoteCatalog({ decode: decodeEmote });
    emoteGeneration++;
    $('pbClipSearch').value = '';
    textureFiles = [];
    textureOwners = [];
    clipFiles = [];
    time = 0;
    selectedActor = null;
    groupOpen.clear();
    partOpen.clear();
    $('pbCategoryFilter').value = 'all';
    $('pbAssetSearch').value = '';
    updateIssues([]);
    actorPicker();
    syncPedFields();
    assetList();
    setControls();
    setStatus('Booth kosong.');
    render();
  };
  $('pbPose').onchange = () => {
    playing = false;
    time = 0;
    saveMotion();
    updateClips();
    applyPose();
    setControls();
  };
  $('pbQuickPose')
    .querySelectorAll('[data-quick-pose]')
    .forEach((b) => {
      b.onclick = () => {
        $('pbPose').value = b.dataset.quickPose;
        $('pbPose').dispatchEvent(new Event('change'));
        if (!$('pbPlay').disabled) $('pbPlay').click();
      };
    });
  $('pbClip').onchange = () => {
    $('pbPose').value = 'clip';
    time = 0;
    playing = false;
    saveMotion();
    updateClips();
    applyPose();
    setControls();
  };
  $('pbPlay').onclick = () => {
    playing = !playing;
    if ($('pbPose').value === 'clip') updateClips();
    last = 0;
    saveMotion();
    applyPose();
  };
  $('pbResetPose').onclick = () => {
    playing = false;
    time = 0;
    $('pbPose').value = 'relaxed';
    saveMotion();
    applyPose();
    fit();
  };
  $('pbTime').oninput = () => {
    playing = false;
    time = Number($('pbTime').value);
    saveMotion();
    applyPose();
  };
  $('pbSize').onchange = () => {
    resize();
    fit();
  };
  $('pbFit').onclick = () => fit();
  $('pbFront').onclick = () => fit(new THREE.Vector3(0, 0, -1));
  $('pbBack').onclick = () => fit(new THREE.Vector3(0, 0, 1));
  for (const id of [
    'pbBackground',
    'pbTransparent',
    'pbFloor',
    'pbLight',
    'pbShadows',
    'pbShadowStrength',
    'pbShadowAngle',
  ])
    $(id).oninput = render;
  $('pbStageCapture').onclick = () => $('pbCapture').click();
  function exportPhoto(size) {
    return guard(async () => {
      await settleEmotes();
      movie.pause();
      for (const a of actors()) a.motion.playing = false;
      playing = false;
      applyPose();
      const [w, h] = size.split('x').map(Number);
      const aspect = camera.aspect,
        oldPosition = camera.position.clone(),
        oldTarget = controls.target.clone();
      capturing = true;
      try {
        renderer.setPixelRatio(1);
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        // Preserve the chosen camera position and target; never auto-fit during capture.
        render();
        const blob = await new Promise((r) => renderer.domElement.toBlob(r, 'image/png'));
        if (!blob) throw Error('Gagal membuat PNG.');
        setStatus(
          (await download(blob, 'ditasha-photo-booth.png', 'image/png'))
            ? 'Foto tersimpan.'
            : 'Simpan dibatalkan.',
        );
      } finally {
        capturing = false;
        camera.position.copy(oldPosition);
        controls.target.copy(oldTarget);
        controls.update();
        camera.aspect = aspect;
        resize();
      }
    });
  }

  const exportSizes = {
    portrait: ['1080x1350', '3000x4000'],
    landscape: ['1920x1080', '4000x3000'],
    square: ['2048x2048', '3000x3000'],
  };
  function exportSizeOptions() {
    const values = exportSizes[$('pbExportOrientation').value];
    $('pbExportSize').replaceChildren(
      ...values.map((value) => {
        const o = document.createElement('option');
        o.value = value;
        o.textContent = value.replace('x', ' × ');
        return o;
      }),
    );
  }
  function previewExportSize() {
    $('pbSize').value = $('pbExportSize').value;
    resize();
  }
  $('pbExportOrientation').onchange = () => {
    exportSizeOptions();
    previewExportSize();
  };
  $('pbExportSize').onchange = previewExportSize;
  $('pbCapture').onclick = () => {
    for (const a of actors()) a.motion.playing = false;
    playing = false;
    applyPose();
    const [w, h] = $('pbSize').value.split('x').map(Number);
    $('pbExportOrientation').value = w === h ? 'square' : w > h ? 'landscape' : 'portrait';
    exportSizeOptions();
    if (exportSizes[$('pbExportOrientation').value].includes($('pbSize').value))
      $('pbExportSize').value = $('pbSize').value;
    exportDialog.showModal();
  };
  $('pbExportCancel').onclick = () => exportDialog.close();
  $('pbExportConfirm').onclick = () => {
    const size = $('pbExportSize').value;
    exportDialog.close();
    exportPhoto(size);
  };
  root.addEventListener('dragover', (e) => e.preventDefault());
  root.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    guard(() => importFiles([...e.dataTransfer.files], kind, $('pbImportCategory').value));
  });
  function tick(now) {
    if (!active) {
      raf = 0;
      return;
    }
    raf = requestAnimationFrame(tick);
    if (!busy && !movie.playing && now - last > 33) {
      const delta = last ? Math.min((now - last) / 1000, 0.1) : 0;
      last = now;
      let changed = false;
      for (const a of actors())
        if (a.motion.playing) {
          const clip = clipsFor(a).find((c) => c.id === a.motion.clip);
          advanceActorMotion(
            a.motion,
            delta,
            a.motion.pose === 'clip' && clip ? Math.max(0.01, clip.clip.duration) : 4,
          );
          changed = true;
        }
      if (changed) applyPose();
    }
  }
  $('pbActor').onchange = () => selectPed(Number($('pbActor').value));
  $('pbStageActor').onchange = () => selectPed(Number($('pbStageActor').value));
  $('pbSpeed').onchange = () => {
    const speed = Number($('pbSpeed').value);
    if (!Number.isFinite(speed) || speed < 0.1 || speed > 3) {
      $('pbSpeed').value = currentActor()?.motion.speed || 1;
      return;
    }
    saveMotion();
  };
  $('pbPlayAll').onclick = () => {
    saveMotion();
    for (const a of actors()) a.motion.playing = true;
    last = 0;
    updateClips();
    applyPose();
  };
  $('pbPauseAll').onclick = () => {
    for (const a of actors()) a.motion.playing = false;
    applyPose();
  };

  async function refreshLibrary() {
    const rows = await library.list();
    $('pbLibraryList').replaceChildren();
    for (const row of rows.filter((row) =>
      row.name.toLowerCase().includes($('pbLibrarySearch').value.trim().toLowerCase()),
    )) {
      const card = document.createElement('article');
      card.className = 'pb-asset';
      if (row.thumbnail) {
        const img = document.createElement('img');
        img.src = row.thumbnail;
        img.alt = 'Preview ' + row.name;
        img.width = 128;
        card.append(img);
      }
      const name = document.createElement('strong');
      name.textContent = row.name;
      card.append(name);
      const load = document.createElement('button');
      load.textContent = 'Buka preset';
      load.dataset.libraryLoad = row.id;
      load.onclick = () =>
        guard(async () => {
          await restoreScene(await library.get(row.id));
        });
      const remove = document.createElement('button');
      remove.textContent = 'Hapus preset';
      remove.dataset.libraryRemove = row.id;
      remove.onclick = () =>
        guard(async () => {
          await library.remove(row.id);
          await refreshLibrary();
        });
      card.append(load, remove);
      $('pbLibraryList').append(card);
    }
  }
  function snapshotScene() {
    movie.pause();
    saveMotion();
    const small = document.createElement('canvas');
    small.width = 160;
    small.height = 200;
    small.getContext('2d').drawImage(renderer.domElement, 0, 0, 160, 200);
    return {
      version: 1,
      movie: movie.snapshot(),
      name: $('pbLibraryName').value,
      thumbnail: small.toDataURL('image/png'),
      assets: assets.map((a) => ({
        file: a.file,
        kind: a.kind,
        rigChoice: a.rigChoice || 'auto',
        referenceOnly: !!a.referenceOnly,
        targetHeightCm: a.targetHeightCm || null,
        textureOverride: a.textureOverride || '',
        category: a.category,
        oldId: a.id,
        ownerIndex: a.owner == null ? null : assets.findIndex((b) => b.id === a.owner),
        offset: [...a.offset],
        yaw: a.yaw || 0,
        matte: !!a.matte,
        label: a.label || '',
        groupCollapsed: groupOpen.get(a.id) === false,
        scale: a.scale,
        visible: a.visible,
        motion: { ...a.motion, playing: false },
        drawable: a.drawable,
        hiddenSlots: [...a.hiddenSlots],
        attach: a.attach,
        vehicleModel: a.vehicleModel || '',
        vehicleAlt: !!a.vehicleAlt,
        vehicleSlot: a.vehicleSlot || '',
        vehicleBone: a.vehicleBone || '',
        vehicleOffBones: a.vehicleOffBones || [],
        textureParents: a.textureParents || [],
        grip: !!a.grip,
        pitch: a.pitch || 0,
        roll: a.roll || 0,
      })),
      textureFiles,
      textureOwners: textureOwners.map((id) =>
        id == null ? null : assets.findIndex((a) => a.id === id),
      ),
      clipFiles,
      studio: {
        packs: studioPacks.map(({ id, label, files }) => ({ id, label, files })),
        cutaway: $('pbStudioCutaway').checked,
        studioY: Number($('pbStudioY').value) || 0,
        studioYaw: Number($('pbStudioYaw').value) || 0,
        id: $('pbStudio').value,
        background: $('pbBackground').value,
        light: Number($('pbLight').value),
        transparent: $('pbTransparent').checked,
        floor: $('pbFloor').checked,
        size: $('pbSize').value,
        shadows: $('pbShadows').checked,
        shadowStrength: Number($('pbShadowStrength').value),
        shadowAngle: Number($('pbShadowAngle').value),
      },
    };
  }
  async function restoreScene(record) {
    validateBoothScene(record);
    ensure();
    const pending = [],
      newClips = [],
      restoredPacks = [];
    let stagedStudio = null;
    try {
      for (const source of record.assets) {
        const a = {
          ...source,
          id: ++token,
          name: source.file.name,
          category: source.category || outfitCategory(source.file.name, 'auto', source.kind),
          hiddenSlots: new Set(source.hiddenSlots || []),
          motion: { ...source.motion, playing: false },
        };
        if (a.category === 'prop' && a.attach === 'auto' && !a.grip) {
          a.grip = true;
          a.attach = 'SKEL_R_Hand';
        }
        if (/\.glb$/i.test(a.name)) a.gltf = await parseGlb(a.file);
        else
          a.drawables = await decodeResource(
            a.name.split('.').pop().toLowerCase(),
            await a.file.arrayBuffer(),
          );
        pending.push(a);
      }
      if (pending.reduce((n, a) => n + boothVertexCount(a), 0) > MAX_BOOTH_VERTICES)
        throw Error('Preset melebihi 5 juta vertex.');
      for (const a of pending) {
        a.owner = a.ownerIndex === null ? null : pending[a.ownerIndex].id;
        if (a.motion.clip && !a.motion.clip.startsWith('external:')) {
          const [old, index] = a.motion.clip.split(':');
          const original = record.assets.findIndex((s) => String(s.oldId) === old);
          if (original >= 0) a.motion.clip = pending[original].id + ':' + index;
        }
      }
      const refs = modelTextureReferences(pending.flatMap((a) => a.drawables || []));
      let restoredTextures = [];
      const restoreWarnings = [];
      for (const [i, file] of record.textureFiles.entries()) {
        const loaded = await loadVehicleTextures([file], refs, {
          decode: decodeResource,
          image: imageData,
          existing: restoredTextures,
        });
        restoreWarnings.push(...loaded.warnings);
        const ownerIndex = record.textureOwners?.[i],
          ownerId = ownerIndex == null ? null : pending[ownerIndex].id;
        restoredTextures = [
          ...restoredTextures.filter((t) => t.boothOwner !== ownerId),
          ...mergeVehicleTextures(
            restoredTextures.filter((t) => t.boothOwner === ownerId),
            loaded.textures.map((t) => ({ ...t, boothOwner: ownerId })),
          ),
        ];
        if (restoredTextures.reduce((n, t) => n + t.out.length, 0) > MAX_DECODED_TEXTURE_BYTES)
          throw Error('Tekstur preset terlalu besar.');
      }
      const restoredCatalog = createEmoteCatalog({ decode: decodeEmote });
      const clipAliases = new Map();
      for (const c of record.clipFiles) {
        try {
          const result = await restoredCatalog.add(c.file, c.prefix);
          if (result.duplicate) clipAliases.set(c.prefix, result.source.prefix);
          else newClips.push(...result.entries);
          restoreWarnings.push(...result.warnings.map((w) => c.file.name + ': ' + w));
        } catch (error) {
          restoreWarnings.push(c.file.name + ': ' + error.message);
        }
      }
      for (const a of pending)
        for (const [from, to] of clipAliases)
          if (a.motion.clip.startsWith(from + ':'))
            a.motion.clip = to + a.motion.clip.slice(from.length);
      for (const pack of record.studio?.packs || [])
        restoredPacks.push(await prepareStudioPack(pack, decodeResource));
      if (record.studio?.id.startsWith('custom:')) {
        const [, id, index] = record.studio.id.split(':');
        stagedStudio = await buildMapStudio(
          restoredPacks.find((p) => p.id === id),
          Number(index),
          decodeResource,
          { cutawayPlane: studioClipPlane },
        );
      }
      if (stage) clearStage();
      assets.forEach(disposeGlb);
      assets = pending;
      textures = restoredTextures;
      textureFiles = [...record.textureFiles];
      textureOwners = record.textureFiles.map((_, i) =>
        record.textureOwners?.[i] == null ? null : pending[record.textureOwners[i]].id,
      );
      clipFiles = [...restoredCatalog.sources];
      emoteCatalog = restoredCatalog;
      emoteGeneration++;
      externalClips = newClips;
      emoteIssues = restoreWarnings.slice(0, 200);
      if (restoreWarnings.length > 200)
        emoteIssues.push(restoreWarnings.length - 200 + ' peringatan lain tidak ditampilkan.');
      for (const a of pending)
        if (
          a.motion.clip.startsWith('external:') &&
          !newClips.some((c) => c.id === a.motion.clip)
        ) {
          a.motion.clip = '';
          a.motion.pose = 'relaxed';
        }

      $('pbClipSearch').value = '';
      clipSerial = Math.max(clipSerial, ...clipFiles.map((c) => Number(c.prefix.split(':')[1])));
      selectedActor = actors()[0]?.id;
      if (record.studio) {
        studioPacks = restoredPacks;
        updateStudioOptions();
        $('pbStudioCutaway').checked = record.studio.cutaway ?? true;
        $('pbStudioY').value = record.studio.studioY ?? 0;
        $('pbStudioYaw').value = record.studio.studioYaw ?? 0;
        $('pbStudio').value = record.studio.id;
        $('pbBackground').value = record.studio.background;
        $('pbLight').value = record.studio.light;
        $('pbTransparent').checked = record.studio.transparent;
        $('pbFloor').checked = record.studio.floor;
        $('pbSize').value = record.studio.size;
        $('pbShadows').checked = record.studio.shadows ?? true;
        $('pbShadowStrength').value = record.studio.shadowStrength ?? 1;
        $('pbShadowAngle').value = record.studio.shadowAngle ?? 37;
        await changeStudio(stagedStudio);
      }
      loadMotion();
      rebuild();
      resize();
      fit();
      movieBase = null;
      movie.restore(
        record.movie || {
          version: 1,
          duration: 10,
          fps: 24,
          size: '1280x720',
          interpolation: 'smooth',
          time: 0,
          keys: [],
          view: getMovieFrame(true),
        },
      );
      await settleEmotes();
      $('pbLibraryName').value = record.name;
      if (restoreWarnings.length) {
        updateIssues([
          ...new Set(
            [...$('pbIssueList').children]
              .map((n) => n.textContent)
              .concat(restoreWarnings.slice(0, 200)),
          ),
        ]);
        setStatus(
          'Preset dibuka · ' +
            restoreWarnings.length +
            ' peringatan tekstur/emote. Klik Lihat masalah. File sumber tetap tersimpan.',
        );
      } else setStatus('Preset dibuka. Pose tiap ped dipertahankan; playback dijeda.');
    } catch (e) {
      if (stagedStudio && stagedStudio !== studio) disposeBoothStudio(stagedStudio);
      pending.filter((a) => !assets.includes(a)).forEach(disposeGlb);
      throw e;
    }
  }
  $('pbLibrarySave').onclick = () =>
    guard(async () => {
      setStatus('Menyalin sumber preset ke library lokal…');
      await library.save(snapshotScene(), (done, total) =>
        setStatus('Menyimpan preset · ' + Math.round((100 * done) / Math.max(1, total)) + '%'),
      );
      await refreshLibrary();
      setStatus('Scene, outfit dan emote tersimpan di library lokal.');
    });
  $('pbLibraryRefresh').onclick = () => guard(refreshLibrary);
  $('pbLibrarySearch').oninput = () => refreshLibrary().catch((e) => setStatus(e.message));
  return {
    root,
    setActive(value) {
      active = value;
      if (value) {
        ensure();
        if (!vaultStarted) {
          vaultStarted = true;
          vaultRestoring = guard(loadSavedEmotes).finally(() => {
            vaultRestoring = null;
          });
        }
        attachTransform();
        setControls();
        resize();
        if (!raf) raf = requestAnimationFrame(tick);
      } else {
        movie.cancel();
        if (exportDialog.open) exportDialog.close();
        if (expanded) setExpanded(false);
        transform?.detach();
        for (const a of actors()) a.motion.playing = false;
        playing = false;
        last = 0;
        if (raf) cancelAnimationFrame(raf);
        raf = 0;
      }
    },
    importFiles,
  };
}
