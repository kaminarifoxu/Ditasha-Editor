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
  $('pbClothes').click();
  upload('pbInput', [['outfit.ydd', fixtures.native]]);
  await wait(() => !$('pbPed').disabled && $('pbAssets').children.length === 2, 'Clothing import');
  $('pbAccessory').click();
  upload('pbInput', [['accessory.ydd', fixtures.native]]);
  await wait(() => !$('pbPed').disabled && $('pbAssets').children.length === 3, 'Accessory import');
  const bone = $('pbAssets').lastElementChild.querySelector('select');
  bone.value = 'SKEL_L_UpperArm';
  bone.dispatchEvent(new Event('change'));
  assert(
    $('pbAssets').lastElementChild.querySelector('select').value === 'SKEL_L_UpperArm',
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
  return {
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
