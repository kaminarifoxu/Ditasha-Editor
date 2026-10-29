module.exports = async function checkPhotoBooth(fixtures) {
  const $ = (id) => document.getElementById(id),
    sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const assert = (v, m) => {
    if (!v) throw Error(m);
  };
  async function wait(fn, msg) {
    const end = Date.now() + 15000;
    while (Date.now() < end) {
      if (fn()) return;
      await sleep(40);
    }
    throw Error(msg + ': ' + $('pbStatus').textContent);
  }
  const upload = (id, files) => {
    const dt = new DataTransfer();
    for (const [name, b] of files) dt.items.add(new File([new Uint8Array(b)], name));
    $(id).files = dt.files;
    $(id).dispatchEvent(new Event('change'));
  };
  const assetCards = () =>
    [...$('pbAssets').querySelectorAll('[data-asset-card]')].sort(
      (a, b) => Number(a.dataset.assetCard) - Number(b.dataset.assetCard),
    );
  let saved = null;
  window.ditashaDesktop = {
    saveExport: async (req) => {
      saved = req;
      return { saved: true };
    },
  };
  document.querySelector('[data-page=photobooth]').click();
  await sleep(100);
  assert($('pbSize').value === '1920x1080', 'Booth must default to landscape');
  assert($('pbPropCatalog').options.length >= 10, 'Prop reference catalog missing');
  assert($('pbCapture').disabled, 'Empty booth allows capture');
  upload('pbInput', [['native-ped.ydd', fixtures.native]]);
  await wait(() => !$('pbPed').disabled && assetCards().length === 1, 'Native rig import');
  assert($('pbRigStatus').textContent.includes('1 mesh GTA skinned'), 'Native skin not bound');
  assert(!$('pbPlay').disabled, 'Pose controls disabled');
  const canvas = () => $('pbViewport').querySelector('canvas');
  const initial = canvas().toDataURL();
  $('pbPose').value = 'rest';
  $('pbPose').dispatchEvent(new Event('change'));
  assert(canvas().toDataURL() !== initial, 'Pose did not change rendered skin');
  upload('pbClipInput', [['native-compatible-emote.glb', fixtures.glb]]);
  await wait(
    () => !$('pbImportClip').disabled && $('pbPose').value === 'clip',
    'Native custom emote import',
  );
  const nativeClipStart = canvas().toDataURL();
  $('pbTime').value = '.5';
  $('pbTime').dispatchEvent(new Event('input'));
  assert(
    canvas().toDataURL() !== nativeClipStart,
    'Compatible custom GLB clip did not animate native GTA bones',
  );
  upload('pbClipInput', [
    ['batch-one.ycd', fixtures.ycd],
    ['batch-two.ycd', fixtures.ycd],
    ['broken.ycd', [1, 2, 3]],
  ]);
  await wait(
    () => !$('pbImportClip').disabled && $('pbClip').options.length === 3,
    'YCD batch import',
  );
  assert($('pbStatus').textContent.includes('broken.ycd'), 'Invalid YCD not diagnosed');
  const ycdStart = canvas().toDataURL();
  $('pbTime').value = '.75';
  $('pbTime').dispatchEvent(new Event('input'));
  assert(canvas().toDataURL() !== ycdStart, 'Native binary YCD did not move skinned mesh');
  const pausedYcd = canvas().toDataURL();
  $('pbTime').dispatchEvent(new Event('input'));
  assert(
    canvas().toDataURL() === pausedYcd,
    'YCD repeated paused frame reset cached bone properties',
  );
  assert(!$('pbPlay').disabled, 'YCD playback disabled with matching tags');
  $('pbPlay').click();
  await sleep(150);
  $('pbPlay').click();
  assert(Number($('pbTime').value) > 0.75, 'YCD clock did not advance');
  $('pbClipSearch').value = 'batch-two';
  $('pbClipSearch').dispatchEvent(new Event('input'));
  assert($('pbClip').options.length === 2, 'Emote search must keep current clip and matching clip');
  $('pbClipSearch').value = '';
  $('pbClipSearch').dispatchEvent(new Event('input'));
  $('pbLibraryName').value = 'QA binary YCD';
  $('pbLibrarySave').click();
  await wait(
    () => !$('pbLibrarySave').disabled && $('pbLibraryList').querySelector('[data-library-load]'),
    'YCD library save',
  );
  const ycdLibraryId = $('pbLibraryList').querySelector('[data-library-load]').dataset.libraryLoad;
  $('pbClear').click();
  $('pbLibraryList').querySelector(`[data-library-load="${ycdLibraryId}"]`).click();
  await wait(
    () => !$('pbPed').disabled && assetCards().length === 1 && $('pbClip').options.length === 3,
    'YCD library restore',
  );
  assert($('pbPose').value === 'clip' && !$('pbPlay').disabled, 'YCD preset lost native binding');
  const restoredYcd = canvas().toDataURL();
  $('pbTime').value = '0';
  $('pbTime').dispatchEvent(new Event('input'));
  assert(canvas().toDataURL() !== restoredYcd, 'Restored YCD lost animation samples');
  $('pbLibraryList').querySelector(`[data-library-remove="${ycdLibraryId}"]`).click();
  await wait(
    () => !$('pbLibraryList').querySelector(`[data-library-load="${ycdLibraryId}"]`),
    'YCD preset cleanup',
  );
  upload(
    'pbClipInput',
    Array.from({ length: 101 }, (_, i) => ['bulk-' + i + '.ycd', fixtures.ycd]),
  );
  await wait(
    () => !$('pbImportClip').disabled && $('pbStatus').textContent.includes('104 file emote'),
    'More than 100 YCD files',
  );
  console.log('DITASHA_SNAPSHOT:photo-booth-ycd-emote');
  await sleep(150);
  $('pbPose').value = 'rest';
  $('pbPose').dispatchEvent(new Event('change'));
  $('pbClothes').click();
  upload('pbInput', [['outfit.ydd', fixtures.native]]);
  await wait(() => !$('pbPed').disabled && assetCards().length === 2, 'Clothing import');
  $('pbAccessory').click();
  upload('pbInput', [['accessory.ydd', fixtures.native]]);
  await wait(() => !$('pbPed').disabled && assetCards().length === 3, 'Accessory import');
  const bone = assetCards().at(-1).querySelector('[data-bone]');
  bone.value = 'SKEL_L_UpperArm';
  bone.dispatchEvent(new Event('change'));
  assert(
    assetCards().at(-1).querySelector('[data-bone]').value === 'SKEL_L_UpperArm',
    'Rigid bone target did not persist',
  );
  $('pbPose').value = 'walk';
  $('pbPose').dispatchEvent(new Event('change'));
  $('pbPlay').click();
  await sleep(250);
  assert(Number($('pbTime').value) > 0, 'Animation did not advance');
  $('pbPlay').click();
  const paused = $('pbTime').value;
  await sleep(150);
  assert($('pbTime').value === paused, 'Pause failed');
  $('pbTime').value = '.75';
  $('pbTime').dispatchEvent(new Event('input'));
  assert($('pbTimeLabel').textContent === '0.75 s', 'Frame scrub failed');
  $('pbClear').click();
  $('pbPed').click();
  upload('pbInput', [['rigged-mannequin.glb', fixtures.glb]]);
  await wait(() => !$('pbPed').disabled && assetCards().length === 1, 'Rigged GLB import');
  assert(!$('pbClipField').hidden, 'Embedded animation missing');
  $('pbPose').value = 'clip';
  $('pbPose').dispatchEvent(new Event('change'));
  const bind = canvas().toDataURL();
  $('pbTime').value = '.5';
  $('pbTime').dispatchEvent(new Event('input'));
  assert(canvas().toDataURL() !== bind, 'GLB clip did not move mesh');
  upload('pbClipInput', [['external-emote.glb', fixtures.glb]]);
  await wait(
    () => !$('pbImportClip').disabled && $('pbClip').options.length === 2,
    'External animation import',
  );
  $('pbPose').value = 'catalog';
  $('pbPose').dispatchEvent(new Event('change'));
  $('pbFront').click();
  await sleep(120);
  console.log('DITASHA_SNAPSHOT:photo-booth');
  await sleep(200);
  $('pbTransparent').checked = true;
  $('pbTransparent').dispatchEvent(new Event('input'));
  $('pbFullscreen').click();
  await sleep(100);
  canvas().dispatchEvent(
    new WheelEvent('wheel', { deltaY: -120, bubbles: true, cancelable: true }),
  );
  $('pbCapture').click();
  assert($('pbExportDialog').open, 'PNG orientation dialog missing');
  $('pbExportOrientation').value = 'portrait';
  $('pbExportOrientation').dispatchEvent(new Event('change'));
  const previewBeforeExport = await createImageBitmap(canvas());
  $('pbExportConfirm').click();
  await wait(() => saved && !$('pbCapture').disabled, 'PNG export');
  const bytes = new Uint8Array(saved.data);
  assert(
    bytes[0] === 137 && bytes[1] === 80 && saved.name === 'ditasha-photo-booth.png',
    'Invalid PNG',
  );
  const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
  assert(bitmap.width === 1080 && bitmap.height === 1350, 'Wrong PNG size');
  const c = document.createElement('canvas');
  c.width = bitmap.width;
  c.height = bitmap.height;
  const ctx = c.getContext('2d');
  ctx.drawImage(bitmap, 0, 0);
  assert(ctx.getImageData(0, 0, 1, 1).data[3] === 0, 'Transparent PNG lost alpha');
  function alphaBounds(image) {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const ctx = c.getContext('2d');
    ctx.drawImage(image, 0, 0, 128, 128);
    const data = ctx.getImageData(0, 0, 128, 128).data;
    let minX = 128,
      minY = 128,
      maxX = -1,
      maxY = -1;
    for (let y = 0; y < 128; y++)
      for (let x = 0; x < 128; x++)
        if (data[(y * 128 + x) * 4 + 3] > 100) {
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
    return [minX, minY, maxX, maxY];
  }
  const beforeBounds = alphaBounds(previewBeforeExport),
    afterBounds = alphaBounds(bitmap);
  assert(
    beforeBounds.every((v, i) => Math.abs(v - afterBounds[i]) <= 2),
    'PNG reframed the chosen preview camera',
  );
  previewBeforeExport.close();
  bitmap.close();
  $('pbFullscreen').click();
  saved = null;
  $('pbCapture').click();
  $('pbExportOrientation').value = 'landscape';
  $('pbExportOrientation').dispatchEvent(new Event('change'));
  $('pbExportConfirm').click();
  await wait(() => saved && !$('pbCapture').disabled, 'Landscape PNG export');
  const landscape = await createImageBitmap(
    new Blob([new Uint8Array(saved.data)], { type: 'image/png' }),
  );
  assert(landscape.width === 1920 && landscape.height === 1080, 'Landscape PNG dimensions wrong');
  landscape.close();
  $('pbCapture').click();
  $('pbExportCancel').click();
  assert(!$('pbExportDialog').open, 'PNG cancel did not close dialog');

  document.querySelector('[data-page=editor]').click();
  const t = $('pbTime').value;
  await sleep(100);
  document.querySelector('[data-page=photobooth]').click();
  assert($('pbTime').value === t, 'Booth session lost on navigation');
  const panel = document.querySelector('.photo-booth-workspace');
  assert(panel.scrollWidth <= panel.clientWidth + 1, 'Photo booth overflow');
  $('pbClear').click();
  assert($('pbCapture').disabled, 'Clear retained exportable meshes');
  // Two characters must keep independent pose, clip and timeline states.
  $('pbPed').click();
  upload('pbInput', [
    ['ped-a.glb', fixtures.glb],
    ['ped-b.glb', fixtures.glb],
  ]);
  await wait(
    () => !$('pbPed').disabled && $('pbActor').options.length === 2,
    'Multiple ped import',
  );
  const actorIds = [...$('pbActor').options].map((o) => o.value);
  const selectActor = (id) => {
    $('pbActor').value = id;
    $('pbActor').dispatchEvent(new Event('change'));
  };
  const setCm = (id, value) => {
    $(id).value = String(value);
    $(id).dispatchEvent(new Event('change'));
  };
  selectActor(actorIds[0]);
  const beforeMove = canvas().toDataURL();
  setCm('pbPositionX', -100);
  setCm('pbPositionZ', 25);
  assert(canvas().toDataURL() !== beforeMove, 'Ped XY/Z controls did not move rendered model');
  selectActor(actorIds[1]);
  assert(Number($('pbPositionZ').value) === 0, 'Moving ped A moved ped B');
  setCm('pbPositionX', 100);
  selectActor(actorIds[0]);
  assert(
    Number($('pbPositionX').value) === -100 && Number($('pbPositionZ').value) === 25,
    'Ped placement lost on selection',
  );
  $('pbMove').click();
  assert($('pbMove').getAttribute('aria-pressed') === 'true', 'Move tool not enabled');
  $('pbStageActor').value = actorIds[1];
  $('pbStageActor').dispatchEvent(new Event('change'));
  assert($('pbActor').value === actorIds[1], 'Viewport actor picker out of sync');
  $('pbMove').click();
  $('pbStudio').value = 'catalogue';
  $('pbStudio').dispatchEvent(new Event('change'));
  $('pbTransparent').checked = false;
  $('pbTransparent').dispatchEvent(new Event('input'));
  $('pbFit').click();
  const catalogue = canvas().toDataURL();
  $('pbStudio').value = 'loft';
  $('pbStudio').dispatchEvent(new Event('change'));
  assert(canvas().toDataURL() !== catalogue, 'Loft scene did not change rendered background');
  const loft = canvas().toDataURL();
  $('pbStageStudio').value = 'neon';
  $('pbStageStudio').dispatchEvent(new Event('change'));
  assert(
    $('pbStudio').value === 'neon' && canvas().toDataURL() !== loft,
    'Neon studio missing or unsynchronized',
  );
  $('pbFullscreen').click();
  await sleep(180);
  const stageRect = document.querySelector('.pb-stage').getBoundingClientRect();
  assert(
    stageRect.width >= innerWidth - 2 && stageRect.height >= innerHeight - 2,
    'Fullscreen stage does not fill window',
  );
  const viewportRect = $('pbViewport').getBoundingClientRect(),
    canvasRect = canvas().getBoundingClientRect();
  assert(
    canvasRect.width <= viewportRect.width + 2 &&
      canvasRect.height <= viewportRect.height + 2 &&
      (canvasRect.width >= viewportRect.width - 2 ||
        canvasRect.height >= viewportRect.height - 2) &&
      Math.abs(
        canvasRect.width / canvasRect.height -
          Number($('pbSize').value.split('x')[0]) / Number($('pbSize').value.split('x')[1]),
      ) < 0.01,
    'Fullscreen preview must maximize available space while keeping PNG aspect',
  );
  $('pbFit').click();
  console.log('DITASHA_SNAPSHOT:photo-booth-fullscreen-neon');
  await sleep(150);
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  await sleep(150);
  assert(
    !document.querySelector('.pb-stage').classList.contains('pb-expanded'),
    'Escape did not leave fullscreen',
  );
  $('pbStudio').value = 'loft';
  $('pbStudio').dispatchEvent(new Event('change'));
  selectActor(actorIds[0]);
  const choosePose = (pose, t) => {
    $('pbPose').value = pose;
    $('pbPose').dispatchEvent(new Event('change'));
    $('pbTime').value = t;
    $('pbTime').dispatchEvent(new Event('input'));
  };
  choosePose('catalog', '.25');
  selectActor(actorIds[1]);
  choosePose('wave', '1.25');
  selectActor(actorIds[0]);
  assert(
    $('pbPose').value === 'catalog' && $('pbTimeLabel').textContent === '0.25 s',
    'Ped A pose/time overwritten by ped B',
  );
  $('pbPlay').click();
  await sleep(220);
  selectActor(actorIds[1]);
  assert($('pbTimeLabel').textContent === '1.25 s', 'Ped B clock advanced while paused');
  $('pbPauseAll').click();
  choosePose('dance', '.75');
  selectActor(actorIds[0]);
  assert($('pbPose').value === 'catalog', 'Changing ped B changed ped A pose');
  $('pbClothes').click();
  upload('pbInput', [['owned-shirt.ydd', fixtures.native]]);
  await wait(() => !$('pbPed').disabled && assetCards().length === 3, 'Owned clothing import');
  let owner = assetCards().at(-1).querySelector('[data-owner]');
  assert(owner.value === actorIds[0], 'Clothing assigned to wrong ped');
  owner.value = actorIds[1];
  owner.dispatchEvent(new Event('change'));
  assert(
    assetCards().at(-1).querySelector('[data-owner]').value === actorIds[1],
    'Changing outfit owner failed',
  );
  selectActor(actorIds[1]);
  assert($('pbPose').value === 'dance', 'Outfit reassignment overwrote emote');
  let groups = [...$('pbAssets').querySelectorAll('[data-actor-group]')];
  assert(groups.length === 2, 'Expected one collapsible group per ped');
  const groupFor = (id) => $('pbAssets').querySelector('[data-actor-group="' + id + '"]');
  assert(
    groupFor(actorIds[1]).querySelectorAll('[data-asset-card]').length === 2,
    'Owned outfit not in ped group',
  );
  const alias = groupFor(actorIds[1]).querySelector('[data-actor-label]');
  alias.value = 'Test Ped B';
  alias.dispatchEvent(new Event('change'));
  assert(
    $('pbActor').selectedOptions[0].textContent.includes('Test Ped B'),
    'Group name not reflected in actor picker',
  );
  const groupedPixels = canvas().toDataURL();
  $('pbCollapseGroups').click();
  await sleep(60);
  assert(
    [...$('pbAssets').querySelectorAll('[data-actor-group]')].every((g) => !g.open),
    'Collapse all failed',
  );
  assert(canvas().toDataURL() === groupedPixels, 'Collapsing groups changed visible scene');
  $('pbYaw').value = '0';
  $('pbYaw').dispatchEvent(new Event('change'));
  assert(!groupFor(actorIds[1]).open, 'Collapsed group reopened after editing ped');
  groupFor(actorIds[1]).querySelector('[data-select-actor]').click();
  assert(
    groupFor(actorIds[1]).open && $('pbActor').value === actorIds[1],
    'Group pick did not select/open owner',
  );
  const part = assetCards().at(-1);
  part.open = true;
  await sleep(40);
  assert(part.querySelector('[data-owner]'), 'Grouped part lost edit controls');

  const category = assetCards().at(-1).querySelector('[data-outfit-category]');
  category.value = 'vest';
  category.dispatchEvent(new Event('change'));
  $('pbCategoryFilter').value = 'vest';
  $('pbCategoryFilter').dispatchEvent(new Event('change'));
  assert(assetCards().length === 1, 'Category filter missing outfit');
  $('pbCategoryFilter').value = 'all';
  $('pbCategoryFilter').dispatchEvent(new Event('change'));
  groupFor(actorIds[1]).open = false;
  await sleep(60);
  $('pbLibraryName').value = 'QA two-ped outfit';
  $('pbLibrarySave').click();
  await wait(
    () => !$('pbLibrarySave').disabled && $('pbLibraryList').querySelector('[data-library-load]'),
    'Library save',
  );
  const libraryId = $('pbLibraryList').querySelector('[data-library-load]').dataset.libraryLoad;
  $('pbClear').click();
  $('pbLibraryList').querySelector(`[data-library-load="${libraryId}"]`).click();
  await wait(
    () => !$('pbPed').disabled && $('pbActor').options.length === 2 && assetCards().length === 3,
    'Library restore',
  );
  const loadedIds = [...$('pbActor').options].map((o) => o.value);
  assert(
    groupFor(loadedIds[1]).querySelector('summary strong').textContent === 'Test Ped B',
    'Preset lost group name',
  );
  assert(!groupFor(loadedIds[1]).open, 'Preset lost collapsed group state');
  selectActor(loadedIds[0]);
  assert($('pbPose').value === 'catalog', 'Library lost ped A pose');
  assert(
    Number($('pbPositionX').value) === -100 && Number($('pbPositionZ').value) === 25,
    'Library lost ped position',
  );
  assert(
    $('pbStudio').value === 'loft' && $('pbStageStudio').value === 'loft',
    'Library lost studio preset',
  );
  selectActor(loadedIds[1]);
  assert(
    $('pbPose').value === 'dance' && $('pbTimeLabel').textContent === '0.75 s',
    'Library lost independent ped B pose/time',
  );
  assert(
    assetCards().at(-1).querySelector('[data-owner]').value === loadedIds[1],
    'Library lost outfit owner',
  );
  assert(assetCards().at(-1).dataset.category === 'vest', 'Library lost outfit category');
  $('pbFit').click();
  await sleep(150);
  console.log('DITASHA_SNAPSHOT:photo-booth-multiple-peds');
  await sleep(150);
  assert(
    document.querySelectorAll('[data-import-outfit]').length >= 16,
    'Detailed outfit import buttons missing',
  );
  $('pbImportCategory').value = 'auto';
  upload(
    'pbFolderInput',
    Array.from({ length: 22 }, (_, i) => [
      'lowr_' + String(i).padStart(3, '0') + '_r.ydd',
      fixtures.native,
    ]),
  );
  await wait(
    () => !$('pbPed').disabled && assetCards().length === 25,
    'Folder import above old 20-model limit',
  );
  assert(
    $('pbAssets').querySelectorAll('[data-category=pants]').length === 22,
    'GTA folder category detection failed',
  );
  $('pbAssetSearch').value = 'lowr_005';
  $('pbAssetSearch').dispatchEvent(new Event('input'));
  assert(assetCards().length === 1, 'Model search failed');
  $('pbAssetSearch').value = '';
  $('pbAssetSearch').dispatchEvent(new Event('input'));
  upload(
    'pbFolderInput',
    Array.from({ length: 78 }, (_, i) => ['overflow_' + i + '.ydd', fixtures.native]),
  );
  await wait(
    () => !$('pbPed').disabled && $('pbStatus').textContent.includes('100 model'),
    '100-model guard',
  );
  assert(assetCards().length === 25, 'Over-limit import changed scene');
  upload(
    'pbFolderInput',
    Array.from({ length: 75 }, (_, i) => [
      'feet_' + String(i).padStart(3, '0') + '_u.ydd',
      fixtures.native,
    ]),
  );
  await wait(() => !$('pbPed').disabled && assetCards().length === 100, '100 model import');
  assert($('pbModelCount').textContent === '100 / 100 model', 'Model counter incorrect');
  $('pbCategoryFilter').value = 'shoes';
  $('pbCategoryFilter').dispatchEvent(new Event('change'));
  assert(assetCards().length === 75, 'Shoe filter lost imports');
  await sleep(150);
  console.log('DITASHA_SNAPSHOT:photo-booth-outfit-categories');
  await sleep(150);
  $('pbClear').click();
  $('pbPed').click();
  upload('pbInput', [['unknown-no-skeleton.ydd', fixtures.missingRig]]);
  await wait(() => !$('pbPed').disabled && assetCards().length === 1, 'Missing skeleton import');
  assert(
    !$('pbIssues').hidden && $('pbIssueList').textContent.includes('41'),
    'Missing skeleton not diagnosed',
  );
  assert($('pbPlay').disabled, 'Incompatible skin incorrectly enabled playback');
  $('pbRigSource').value = 'freemode-male';
  $('pbRigSource').dispatchEvent(new Event('change'));
  assert(
    $('pbRigStatus').textContent.includes('1 mesh GTA skinned'),
    'Selected freemode reference did not bind native skin',
  );
  document.querySelector('[data-quick-pose=walk]').click();
  await sleep(200);
  assert(Number($('pbTime').value) > 0, 'Quick emote did not start native animation');
  $('pbPauseAll').click();
  $('pbTextures').click();
  upload('pbTextureInput', [['replacement.ytd', fixtures.replacementYtd]]);
  await wait(
    () => !$('pbPed').disabled && $('pbAssets').querySelector('[data-preview-texture]'),
    'Replacement texture import',
  );
  $('pbPose').value = 'rest';
  $('pbPose').dispatchEvent(new Event('change'));
  $('pbFit').click();
  const beforeReplacement = canvas().toDataURL();
  const replace = $('pbAssets').querySelector('[data-preview-texture]');
  replace.selectedIndex = 1;
  replace.dispatchEvent(new Event('change'));
  assert(
    canvas().toDataURL() !== beforeReplacement,
    'Texture override did not change native preview',
  );
  $('pbLibraryName').value = 'QA repaired native rig';
  $('pbLibrarySave').click();
  await wait(
    () =>
      !$('pbLibrarySave').disabled &&
      [...$('pbLibraryList').querySelectorAll('strong')].some(
        (n) => n.textContent === 'QA repaired native rig',
      ),
    'Repaired preset save',
  );
  const repaired = [...$('pbLibraryList').querySelectorAll('article')]
    .find((a) => a.querySelector('strong').textContent === 'QA repaired native rig')
    .querySelector('[data-library-load]').dataset.libraryLoad;
  $('pbClear').click();
  $('pbLibraryList').querySelector(`[data-library-load="${repaired}"]`).click();
  await wait(
    () => !$('pbPed').disabled && $('pbActor').options.length === 1,
    'Repaired preset restore',
  );
  assert(
    $('pbRigSource').value === 'freemode-male' &&
      $('pbAssets').querySelector('[data-preview-texture]').selectedIndex === 1,
    'Library lost rig or preview texture override',
  );
  $('pbClear').click();
  $('pbPed').click();
  upload('pbInput', [['mp_m_freemode_01^head_002_r.ydd', fixtures.missingRig]]);
  await wait(
    () => !$('pbPed').disabled && assetCards().length === 1,
    'Freemode no-skeleton import',
  );
  assert(
    $('pbRigStatus').textContent.includes('1 mesh GTA skinned'),
    'Automatic freemode recovery failed',
  );
  $('pbClear').click();
  $('pbPed').click();
  upload('pbInput', [['height-test.glb', fixtures.glb]]);
  await wait(() => !$('pbPed').disabled && assetCards().length === 1, 'Height regression model');
  $('pbPose').value = 'rest';
  $('pbPose').dispatchEvent(new Event('change'));
  $('pbFit').click();
  $('pbTransparent').checked = true;
  $('pbTransparent').dispatchEvent(new Event('input'));
  const pixelHeight = () => {
    const source = canvas(),
      c = document.createElement('canvas');
    c.width = source.width;
    c.height = source.height;
    const ctx = c.getContext('2d');
    ctx.drawImage(source, 0, 0);
    const data = ctx.getImageData(0, 0, c.width, c.height).data;
    let min = Infinity,
      max = -Infinity;
    for (let y = 0; y < c.height; y++)
      for (let x = 0; x < c.width; x++)
        if (data[(y * c.width + x) * 4 + 3] > 40) {
          min = Math.min(min, y);
          max = Math.max(max, y);
        }
    return max - min;
  };
  const originalHeight = Number($('pbHeightCm').value),
    beforeSize = pixelHeight();
  $('pbHeightCm').value = String(originalHeight * 0.7);
  $('pbHeightCm').dispatchEvent(new Event('change'));
  assert(
    pixelHeight() > 0 && pixelHeight() < beforeSize * 0.85,
    'Height change was canceled by auto-fit',
  );
  const beforeRaise = canvas().toDataURL();
  $('pbElevationCm').value = '20';
  $('pbElevationCm').dispatchEvent(new Event('change'));
  assert(canvas().toDataURL() !== beforeRaise, 'Elevation did not move visible model');
  document.querySelector('[data-quick-pose=walk]').click();
  $('pbHeightCm').value = '123';
  await sleep(120);
  assert($('pbHeightCm').value === '123', 'Playback overwrote height typing');
  $('pbHeightCm').dispatchEvent(new Event('change'));
  $('pbSpeed').value = '.5';
  await sleep(120);
  assert(Number($('pbSpeed').value) === 0.5, 'Playback overwrote speed typing');
  $('pbSpeed').dispatchEvent(new Event('change'));
  $('pbPauseAll').click();
  $('pbReference').click();
  upload('pbReferenceInput', [['rig-source.ydd', fixtures.native]]);
  await wait(
    () => !$('pbReference').disabled && assetCards().length === 2,
    'Reference skeleton import',
  );
  assert(
    assetCards().at(-1).querySelector('[data-reference-checkbox]'),
    'Reference file checkbox not marked',
  );
  await sleep(150);
  console.log('DITASHA_SNAPSHOT:photo-booth-height-rig-controls');
  await sleep(150);
  return {
    portraitLandscapeExport: true,
    groupedPedAssets: true,
    collapsiblePartCards: true,
    groupAliasPersistence: true,
    collapseWithoutHidingScene: true,
    pedPlacement: true,
    fullscreenAllPeds: true,
    offlineStudios: true,
    studioPresetPersistence: true,
    binaryYcd: true,
    batchYcdImport: true,
    ycdSearch: true,
    ycdLibraryPersistence: true,
    automaticFreemodeRig: true,
    manualReference: true,
    nativeEmoteRecovery: true,
    heightWithoutRefit: true,
    elevation: true,
    typingDuringPlayback: true,
    previewTextureOverride: true,
    repairedPresetPersistence: true,
    detailedOutfits: 16,
    folderImport: true,
    maxModels: 100,
    categoryPersistence: true,
    nativeCustomGlbClip: true,
    independentPedEmotes: true,
    independentClocks: true,
    outfitOwnership: true,
    persistentLibraryRoundTrip: true,
    nativeSkin: true,
    nativePoseChangesPixels: true,
    clothing: true,
    accessory: true,
    playPauseScrub: true,
    glbAnimation: true,
    externalClip: true,
    png: [1080, 1350],
    captureKeepsPreviewFraming: true,
    bulkYcdOver100: true,
    landscapeDefault: true,
    pngAlpha: true,
    navigationRetainsSession: true,
  };
};
