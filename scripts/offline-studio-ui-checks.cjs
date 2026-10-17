module.exports = async function checkOfflineStudio(fixtures) {
  const $ = (id) => document.getElementById(id),
    assert = (v, m) => {
      if (!v) throw Error(m);
    },
    sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const wait = async (fn, m) => {
    const end = Date.now() + 20000;
    while (Date.now() < end) {
      if (fn()) return;
      await sleep(25);
    }
    throw Error(
      m +
        ' · ' +
        $('lvStatus')?.textContent +
        ' · ' +
        $('mvStatus')?.textContent +
        ' · ' +
        $('toast')?.textContent,
    );
  };
  const saves = [];
  window.ditashaDesktop = {
    saveExport: async ({ name, data }) => {
      saves.push({ name, data: [...data] });
      return { saved: true };
    },
  };
  const input = async (id, files, ready) => {
    const dt = new DataTransfer();
    files.forEach((f) => dt.items.add(f));
    $(id).files = dt.files;
    $(id).dispatchEvent(new Event('change'));
    await wait(ready, 'Import failed: ' + id);
  };
  const change = (id, value, type = 'change') => {
    $(id).value = value;
    $(id).dispatchEvent(new Event(type, { bubbles: true }));
  };
  await input(
    'fileInput',
    [new File([new Uint8Array(fixtures.ytd)], 'livery.ytd')],
    () => $('textureTitle').textContent !== 'Belum ada tekstur' && $('fileLoading').hidden,
  );
  $('canvasW').value = $('canvasH').value = '256';
  $('confirmSize').click();
  const original = $('textureCanvas').toDataURL();
  $('openLivery').click();
  assert($('liveryDialog').open, 'Livery studio did not open');
  change('lvText', 'DITASHA', 'input');
  change('lvResolution', '512');
  $('lvApply').click();
  await wait(
    () => !$('lvApply').disabled && $('lvStatus').textContent.startsWith('Layer livery'),
    'Livery layer not applied',
  );
  assert($('textureCanvas').toDataURL() !== original, 'Livery did not reach 2D atlas');
  const count = $('layers').children.length,
    first = $('textureCanvas').toDataURL();
  change('lv_px', '65', 'input');
  $('lvApply').click();
  await wait(() => !$('lvApply').disabled, 'Livery transform did not finish');
  assert($('layers').children.length === count, 'Updating livery duplicated the layer');
  assert($('textureCanvas').toDataURL() !== first, 'Livery movement did not update atlas');
  $('lvZip').click();
  await wait(
    () => saves.some((s) => s.name.endsWith('slots.zip')) && !$('lvZip').disabled,
    'Slot ZIP not exported',
  );
  const zip = saves.find((s) => s.name.endsWith('slots.zip'));
  assert(zip.data[0] === 0x50 && zip.data[1] === 0x4b, 'Invalid slot ZIP');
  $('lvProjectSave').click();
  await wait(
    () => saves.some((s) => s.name === 'ditasha-livery.json') && !$('lvProjectSave').disabled,
    'Project not saved',
  );
  const project = saves.find((s) => s.name === 'ditasha-livery.json'),
    data = JSON.parse(new TextDecoder().decode(new Uint8Array(project.data)));
  assert(data.slots[0].px === 65, 'Project lost slot transforms');
  change('lvText', 'CHANGED', 'input');
  await input(
    'lvProjectInput',
    [new File([new Uint8Array(project.data)], 'project.json')],
    () => !$('lvProjectOpen').disabled && $('lvText').value === 'DITASHA',
  );
  const logo = document.createElement('canvas');
  logo.width = logo.height = 32;
  logo.getContext('2d').fillStyle = '#20d060';
  logo.getContext('2d').fillRect(0, 0, 32, 32);
  const logoBlob = await new Promise((r) => logo.toBlob(r, 'image/png'));
  await input(
    'lvInput',
    [new File([logoBlob], 'logo.png', { type: 'image/png' })],
    () => !$('lvImport').disabled,
  );
  const imagePixel = $('lvCanvas').getContext('2d').getImageData(300, 256, 1, 1).data;
  assert(imagePixel[1] > 100 && imagePixel[3] > 0, 'PNG slot import did not render');
  $('lvRemoveImage').click();
  console.log('DITASHA_SNAPSHOT:livery-studio');
  $('lvClose').click();
  $('previewPerformance').click();
  change('previewQuality', 'eco');
  assert($('previewPerformance').textContent.includes('Hemat'), 'GPU quality did not update');
  assert($('gpuDiagnostics').textContent.includes('viewport:'), 'GPU diagnostics missing');
  $('performanceDialog').close();
  const vehicleTab = document.querySelector('[data-page="vehicles"]');
  assert(
    document.querySelector('[data-page="archives"]').nextElementSibling === vehicleTab,
    'Vehicle tab must follow GTA V Explorer',
  );
  vehicleTab.click();
  assert(
    !$('vehicleWorkshop').hidden && !$('vehicleOpen').closest('section').hidden,
    'Dedicated vehicle workspace missing',
  );
  await input(
    'mvInput',
    [new File([new Uint8Array(fixtures.model)], 'vehicle.ydd')],
    () => $('mvTitle').textContent === 'vehicle.ydd' && !$('mvOpen').disabled,
  );
  assert(vehicleTab.classList.contains('active'), 'Import left the vehicle workspace');
  assert($('vwMesh').options.length === 2, 'Workshop mesh list missing');
  document.querySelector('[data-page="modelviewer"]').click();
  assert($('vehicleWorkshop').hidden, 'Vehicle tools leaked into model viewer');
  vehicleTab.click();
  assert(
    $('mvTitle').textContent === 'vehicle.ydd' && !$('vehicleWorkshop').hidden,
    'Vehicle model lost after switching workspaces',
  );
  $('vehicleWorkshop').open = true;
  change('vw_x', '.25');
  $('vwAddLight').click();
  assert($('vwl_y').value > 0, 'Preview lightbar not positioned above roof');
  $('vwSave').click();
  await wait(
    () => saves.some((s) => s.name === 'ditasha-vehicle.json') && !$('mvOpen').disabled,
    'Vehicle project not saved',
  );
  $('vwGlb').click();
  await wait(
    () => saves.some((s) => s.name.endsWith('.glb')) && !$('mvOpen').disabled,
    'Vehicle GLB export failed',
  );
  const glb = saves.find((s) => s.name.endsWith('.glb'));
  assert(glb.data.slice(0, 4).join(',') === '103,108,84,70', 'Invalid scene GLB');
  const view = new DataView(new Uint8Array(glb.data).buffer),
    jsonLength = view.getUint32(12, true),
    gltf = JSON.parse(
      new TextDecoder().decode(new Uint8Array(glb.data.slice(20, 20 + jsonLength))),
    );
  assert(
    gltf.nodes.some((n) => n.name === 'DITASHA preview lightbar'),
    'Lightbar absent from GLB',
  );
  $('mvHideAll').click();
  $('vwNative').click();
  await wait(
    () => saves.some((s) => s.name === 'vehicle-masked.ydd') && !$('mvOpen').disabled,
    'Native mesh masking export failed',
  );
  const masked = saves.find((s) => s.name === 'vehicle-masked.ydd');
  assert(masked.data.slice(0, 4).join(',') === '82,83,67,55', 'Invalid native resource');
  $('mvShowAll').click();
  console.log('DITASHA_SNAPSHOT:vehicle-workshop');
  const nativeCalls = [];
  let nativeState = {
    status: 'idle',
    running: false,
    message: 'Siap',
    engine: 'blender.exe',
    report: null,
  };
  window.ditashaNative = {
    state: async () => nativeState,
    pick: async (kind) => ({ id: kind + '-token', name: kind + '.yft' }),
    start: async (payload) => {
      nativeCalls.push(payload);
      if (['debadge_analyze', 'strobo_preview'].includes(payload.mode))
        nativeState = {
          ...nativeState,
          status: 'success',
          previewId: payload.mode + '-preview',
          report: {
            ok: true,
            mode: payload.mode,
            candidates: [{ name: 'front_badge', faces: 12 }],
          },
        };
      return nativeState;
    },
    preview: async () => ({
      version: 1,
      basis: 'gta-z-up',
      textures: [],
      meshes: [
        {
          name: 'front_badge',
          kind: 'base',
          candidate: 'front_badge',
          positions: [-1, 0, 0, 1, 0, 0, 0, 0, 2],
          uvs: [0, 0, 1, 0, 0.5, 1],
        },
        ...(nativeState.report.mode === 'strobo_preview'
          ? [
              {
                name: 'lamp',
                kind: 'donor',
                candidate: null,
                positions: [-0.2, 0, 2.1, 0.2, 0, 2.1, 0, 0, 2.3],
                uvs: [0, 0, 1, 0, 0.5, 1],
              },
            ]
          : []),
      ],
    }),
    cancel: async () => true,
    reveal: async () => true,
    docs: async () => true,
  };
  $('vehicleStrobo').click();
  assert(
    $('nbMode').value === 'strobo' && !$('nbStrobo').hidden,
    'Strobo shortcut selected wrong build',
  );
  assert(
    $('nativeBuildDialog').tagName === 'SECTION' && !document.querySelector('dialog[open]'),
    'Native operation still opens a modal',
  );
  assert(
    document.querySelector('.vehicle-native-host').contains($('nativeBuildDialog')),
    'Vehicle operation not embedded',
  );
  $('nbClose').click();
  $('openNativeBuild').click();
  assert(
    $('nbMode').value === 'ped' &&
      !$('nativeBuildDialog').hidden &&
      document.body.dataset.workspace === 'rig',
    'Rig ped shortcut selected wrong build',
  );
  await sleep(250);
  console.log('DITASHA_SNAPSHOT:rig-workspace');
  await sleep(250);
  $('nbClose').click();
  $('vehicleDebadge').click();
  assert(!$('debadgeWorkspace').hidden, 'Direct debadge workspace did not open');
  $('dbBack').click();
  $('vehicleStrobo').click();
  $('nativeBuildDialog').querySelector('[data-pick="vehicle"]').click();
  await sleep(30);
  $('nativeBuildDialog').querySelector('[data-pick="donor"]').click();
  await sleep(30);
  $('nbPreviewLoad').click();
  await wait(
    () => $('nbPreviewStatus').textContent.startsWith('2 triangles'),
    'Real donor preview did not load',
  );
  const canvas = $('nbViewport').querySelector('canvas');
  change('nbX', '.25');
  $('nbX').dispatchEvent(new Event('input', { bubbles: true }));
  change('nbZ', '1.5');
  $('nbZ').dispatchEvent(new Event('input', { bubbles: true }));
  $('nbPreviewPlace').click();
  await sleep(100);
  const lampRect = canvas.getBoundingClientRect();
  for (const type of ['pointerdown', 'pointerup'])
    canvas.dispatchEvent(
      new PointerEvent(type, {
        bubbles: true,
        clientX: lampRect.x + lampRect.width / 2,
        clientY: lampRect.y + lampRect.height / 2,
        button: 0,
        pointerId: 1,
      }),
    );
  assert(
    !$('nbPreviewPlace').classList.contains('active'),
    '3D surface placement did not complete',
  );
  const expectedOffset = ['nbX', 'nbY', 'nbZ'].map((id) => Number($(id).value));
  assert(
    expectedOffset.every(Number.isFinite) && expectedOffset.some((v) => v !== 0),
    '3D donor offset not synchronized',
  );
  $('nbRun').click();
  await wait(
    () => nativeCalls.some((c) => c.mode === 'strobo') && !$('nbRun').disabled,
    'Strobo build not dispatched',
  );
  assert(
    JSON.stringify(nativeCalls.find((c) => c.mode === 'strobo').offset) ===
      JSON.stringify(expectedOffset),
    '3D offset differs from native build',
  );
  console.log('DITASHA_SNAPSHOT:native-strobo-preview');
  window.ditashaNative.start = async () => {
    throw Error('Engine tidak tersedia untuk tes');
  };
  $('nbRun').click();
  await wait(
    () => $('nbStatus').textContent.includes('Engine tidak tersedia'),
    'Native engine error was hidden',
  );
  $('nbClose').click();
  $('vehicleStrobo').click();
  await sleep(60);
  assert(
    !$('nbViewport').closest('.native-preview').hidden,
    'Reopened native preview was hidden by an older close event',
  );
  $('nbClose').click();
  $('openNativeBuild').click();
  await sleep(40);
  $('nbReference').value = 'mp_f';
  $('nbHeight').value = '1.62';
  $('nbFingers').checked = false;
  $('nbFingers').dispatchEvent(new Event('change'));
  assert($('nbHandTemplate').disabled, 'Hand template must follow the fingers option');
  let resolveArmPose,
    armRequested = false,
    failLegPose = false;
  const basePreview = window.ditashaNative.preview;
  window.ditashaNative.preview = async (id, pose = 'rest') => {
    assert(id === 'ped-result-preview', 'Pose did not use the current preview token');
    const data = await basePreview();
    if (pose === 'arms') {
      armRequested = true;
      await new Promise((resolve) => {
        resolveArmPose = resolve;
      });
      data.meshes[0].positions[8] = 1;
    }
    if (pose === 'legs' && failLegPose) throw Error('Pose uji sengaja gagal');
    return data;
  };
  window.ditashaNative.start = async (payload) => {
    assert(payload.mode === 'ped', 'Rig preview requested wrong operation');
    assert(
      payload.pedOptions.reference === 'mp_f' &&
        payload.pedOptions.height === 1.62 &&
        !payload.pedOptions.fingers,
      'Rig settings did not reach the native job',
    );
    nativeState = {
      ...nativeState,
      status: 'success',
      running: false,
      output: null,
      stagedId: 'staged-ped',
      previewId: 'ped-result-preview',
      reviewId: 'review-project',
      report: {
        ok: true,
        mode: 'ped',
        pedOptions: payload.pedOptions,
        preview: {
          poses: [
            { id: 'rest', label: 'Pose awal' },
            { id: 'arms', label: 'Uji lengan' },
            { id: 'legs', label: 'Uji kaki' },
          ],
        },
        quality: {
          vertices: 6,
          bones: 128,
          unweighted: 0,
          overFour: 0,
          unnormalized: 0,
          invalidWeights: 0,
        },
      },
      message: 'Preview rig siap.',
    };
    return nativeState;
  };
  let savedPed = false;
  let copiedReview = false;
  window.ditashaNative.saveReview = async (id) => {
    assert(id === 'review-project', 'Correction project token lost');
    copiedReview = true;
    return true;
  };
  window.ditashaNative.save = async (id) => {
    assert(id === 'staged-ped', 'Save did not use staged result');
    savedPed = true;
    nativeState = {
      ...nativeState,
      stagedId: null,
      output: 'chosen-output',
      message: 'Resource ped disimpan.',
    };
    return true;
  };
  $('nbRun').click();
  await wait(
    () =>
      !$('nbSave').disabled &&
      !$('nbViewport').closest('.native-preview').hidden &&
      $('nbViewport').querySelector('canvas'),
    'Rig result did not show a preview before save',
  );
  assert(!savedPed, 'Rig result was saved before user approval');
  assert(
    !document.querySelector('.rig-settings').open,
    'Completed rig settings should collapse to make room for the preview',
  );
  const rigViewport = $('nbViewport').getBoundingClientRect();
  assert(
    rigViewport.top < innerHeight - 120 && rigViewport.bottom > 200,
    'Completed rig preview is below the visible workspace',
  );
  assert(
    document.querySelector('.rig-quality') && $('nbPedPose').options.length === 3,
    'Rig quality report or test poses missing',
  );
  $('nbPedPose').value = 'arms';
  $('nbPedPose').dispatchEvent(new Event('change'));
  await wait(
    () => armRequested && $('nbSave').disabled,
    'Saving was enabled while the pose was still loading',
  );
  $('nbSave').click();
  assert(!savedPed, 'Unloaded pose bypassed the preview-before-save gate');
  resolveArmPose();
  await wait(() => !$('nbSave').disabled, 'Arm pose did not finish loading');
  failLegPose = true;
  $('nbPedPose').value = 'legs';
  $('nbPedPose').dispatchEvent(new Event('change'));
  await sleep(100);
  assert($('nbSave').disabled, 'A failed pose preview must not enable Save');
  $('nbPedPose').value = 'rest';
  $('nbPedPose').dispatchEvent(new Event('change'));
  await wait(() => !$('nbSave').disabled, 'Rest pose did not recover after a failed pose');
  [...$('nbReport').querySelectorAll('button')]
    .find((b) => b.textContent.includes('.blend'))
    .click();
  await wait(
    () => copiedReview && !$('nbSave').disabled,
    'Correction project copy did not restore the save controls',
  );
  assert(
    window.ditashaWorkspace.unsavedItems().some((v) => v.name.includes('Hasil rig')),
    'Staged rig is not tracked as unsaved',
  );
  await sleep(250);
  console.log('DITASHA_SNAPSHOT:rig-result-preview');
  await sleep(250);
  $('nbSave').click();
  await wait(() => savedPed && !$('nbReveal').disabled, 'Explicit rig save failed');
  assert(
    !window.ditashaWorkspace.unsavedItems().some((v) => v.name.includes('Hasil rig')),
    'Saved rig remains dirty',
  );
  $('nbClose').click();
  return {
    saves: saves.map((s) => ({ name: s.name, size: s.data.length })),
    slots: 6,
    worker: true,
    quality: 'eco',
  };
};
