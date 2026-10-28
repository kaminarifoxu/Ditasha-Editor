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
  let saved = null;
  window.ditashaDesktop = {
    saveExport: async (req) => {
      saved = req;
      return { saved: true };
    },
  };
  document.querySelector('[data-page=photobooth]').click();
  await sleep(100);
  assert($('pbCapture').disabled, 'Empty booth allows capture');
  upload('pbInput', [['native-ped.ydd', fixtures.native]]);
  await wait(
    () => !$('pbPed').disabled && $('pbAssets').children.length === 1,
    'Native rig import',
  );
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
    () =>
      !$('pbPed').disabled &&
      $('pbAssets').children.length === 1 &&
      $('pbClip').options.length === 3,
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
  console.log('DITASHA_SNAPSHOT:photo-booth-ycd-emote');
  await sleep(150);
  $('pbPose').value = 'rest';
  $('pbPose').dispatchEvent(new Event('change'));
  $('pbClothes').click();
  upload('pbInput', [['outfit.ydd', fixtures.native]]);
  await wait(() => !$('pbPed').disabled && $('pbAssets').children.length === 2, 'Clothing import');
  $('pbAccessory').click();
  upload('pbInput', [['accessory.ydd', fixtures.native]]);
  await wait(() => !$('pbPed').disabled && $('pbAssets').children.length === 3, 'Accessory import');
  const bone = $('pbAssets').lastElementChild.querySelector('[data-bone]');
  bone.value = 'SKEL_L_UpperArm';
  bone.dispatchEvent(new Event('change'));
  assert(
    $('pbAssets').lastElementChild.querySelector('[data-bone]').value === 'SKEL_L_UpperArm',
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
  await wait(
    () => !$('pbPed').disabled && $('pbAssets').children.length === 1,
    'Rigged GLB import',
  );
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
  $('pbCapture').click();
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
  bitmap.close();
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
  await wait(
    () => !$('pbPed').disabled && $('pbAssets').children.length === 3,
    'Owned clothing import',
  );
  let owner = $('pbAssets').lastElementChild.querySelector('[data-owner]');
  assert(owner.value === actorIds[0], 'Clothing assigned to wrong ped');
  owner.value = actorIds[1];
  owner.dispatchEvent(new Event('change'));
  assert(
    $('pbAssets').lastElementChild.querySelector('[data-owner]').value === actorIds[1],
    'Changing outfit owner failed',
  );
  selectActor(actorIds[1]);
  assert($('pbPose').value === 'dance', 'Outfit reassignment overwrote emote');
  const category = $('pbAssets').lastElementChild.querySelector('[data-outfit-category]');
  category.value = 'vest';
  category.dispatchEvent(new Event('change'));
  $('pbCategoryFilter').value = 'vest';
  $('pbCategoryFilter').dispatchEvent(new Event('change'));
  assert($('pbAssets').children.length === 1, 'Category filter missing outfit');
  $('pbCategoryFilter').value = 'all';
  $('pbCategoryFilter').dispatchEvent(new Event('change'));
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
    () =>
      !$('pbPed').disabled &&
      $('pbActor').options.length === 2 &&
      $('pbAssets').children.length === 3,
    'Library restore',
  );
  const loadedIds = [...$('pbActor').options].map((o) => o.value);
  selectActor(loadedIds[0]);
  assert($('pbPose').value === 'catalog', 'Library lost ped A pose');
  selectActor(loadedIds[1]);
  assert(
    $('pbPose').value === 'dance' && $('pbTimeLabel').textContent === '0.75 s',
    'Library lost independent ped B pose/time',
  );
  assert(
    $('pbAssets').lastElementChild.querySelector('[data-owner]').value === loadedIds[1],
    'Library lost outfit owner',
  );
  assert(
    $('pbAssets').lastElementChild.dataset.category === 'vest',
    'Library lost outfit category',
  );
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
    () => !$('pbPed').disabled && $('pbAssets').children.length === 25,
    'Folder import above old 20-model limit',
  );
  assert(
    $('pbAssets').querySelectorAll('[data-category=pants]').length === 22,
    'GTA folder category detection failed',
  );
  $('pbAssetSearch').value = 'lowr_005';
  $('pbAssetSearch').dispatchEvent(new Event('input'));
  assert($('pbAssets').children.length === 1, 'Model search failed');
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
  assert($('pbAssets').children.length === 25, 'Over-limit import changed scene');
  upload(
    'pbFolderInput',
    Array.from({ length: 75 }, (_, i) => [
      'feet_' + String(i).padStart(3, '0') + '_u.ydd',
      fixtures.native,
    ]),
  );
  await wait(
    () => !$('pbPed').disabled && $('pbAssets').children.length === 100,
    '100 model import',
  );
  assert($('pbModelCount').textContent === '100 / 100 model', 'Model counter incorrect');
  $('pbCategoryFilter').value = 'shoes';
  $('pbCategoryFilter').dispatchEvent(new Event('change'));
  assert($('pbAssets').children.length === 75, 'Shoe filter lost imports');
  await sleep(150);
  console.log('DITASHA_SNAPSHOT:photo-booth-outfit-categories');
  await sleep(150);
  $('pbClear').click();
  $('pbPed').click();
  upload('pbInput', [['unknown-no-skeleton.ydd', fixtures.missingRig]]);
  await wait(
    () => !$('pbPed').disabled && $('pbAssets').children.length === 1,
    'Missing skeleton import',
  );
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
    () => !$('pbPed').disabled && $('pbAssets').children.length === 1,
    'Freemode no-skeleton import',
  );
  assert(
    $('pbRigStatus').textContent.includes('1 mesh GTA skinned'),
    'Automatic freemode recovery failed',
  );
  $('pbClear').click();
  $('pbPed').click();
  upload('pbInput', [['height-test.glb', fixtures.glb]]);
  await wait(
    () => !$('pbPed').disabled && $('pbAssets').children.length === 1,
    'Height regression model',
  );
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
    () => !$('pbReference').disabled && $('pbAssets').children.length === 2,
    'Reference skeleton import',
  );
  assert(
    $('pbAssets').lastElementChild.querySelector('[data-reference-checkbox]'),
    'Reference file checkbox not marked',
  );
  await sleep(150);
  console.log('DITASHA_SNAPSHOT:photo-booth-height-rig-controls');
  await sleep(150);
  return {
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
    pngAlpha: true,
    navigationRetainsSession: true,
  };
};
