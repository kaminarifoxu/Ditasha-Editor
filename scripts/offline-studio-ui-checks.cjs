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
      if (payload.mode === 'debadge_analyze')
        nativeState = {
          ...nativeState,
          status: 'success',
          report: {
            ok: true,
            mode: payload.mode,
            candidates: [{ name: 'front_badge', faces: 12 }],
          },
        };
      return nativeState;
    },
    cancel: async () => true,
    reveal: async () => true,
    docs: async () => true,
  };
  $('vehicleStrobo').click();
  assert(
    $('nbMode').value === 'strobo' && !$('nbStrobo').hidden,
    'Strobo shortcut selected wrong build',
  );
  $('nbClose').click();
  $('openNativeBuild').click();
  assert($('nbMode').value === 'ped', 'Rig ped shortcut selected wrong build');
  $('nbClose').click();
  $('vehicleDebadge').click();
  assert(
    $('nbMode').value === 'debadge' && !$('nbDebadge').hidden,
    'Debadge shortcut selected wrong build',
  );
  $('nativeBuildDialog').querySelector('[data-pick="vehicle"]').click();
  await sleep(30);
  $('nbAnalyze').click();
  await wait(
    () => $('nbCandidates').querySelector('input') && !$('nbRun').disabled,
    'Native badge analysis UI failed',
  );
  $('nbCandidates').querySelector('input').checked = true;
  $('nbRun').click();
  await wait(
    () => nativeCalls.some((c) => c.mode === 'debadge') && !$('nbRun').disabled,
    'Native build UI did not dispatch',
  );
  assert(
    nativeCalls.find((c) => c.mode === 'debadge').selected[0] === 'front_badge',
    'Native candidate selection was lost before build',
  );
  assert(
    nativeCalls.find((c) => c.mode === 'debadge').inputs.vehicle === 'vehicle-token',
    'Renderer did not use picker token',
  );
  window.ditashaNative.start = async () => {
    throw Error('Engine tidak tersedia untuk tes');
  };
  $('nbRun').click();
  await wait(
    () => $('nbStatus').textContent.includes('Engine tidak tersedia'),
    'Native engine error was hidden',
  );
  $('nbClose').click();
  return {
    saves: saves.map((s) => ({ name: s.name, size: s.data.length })),
    slots: 6,
    worker: true,
    quality: 'eco',
  };
};
