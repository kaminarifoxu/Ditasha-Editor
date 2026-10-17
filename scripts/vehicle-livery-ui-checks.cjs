module.exports = async function checkVehicleLivery(fixtures) {
  const $ = (id) => document.getElementById(id),
    sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const assert = (ok, message) => {
    if (!ok) throw Error(message);
  };
  const wait = async (test, message) => {
    const end = Date.now() + 20000;
    while (Date.now() < end) {
      if (test()) return;
      await sleep(40);
    }
    throw Error(message + ' · ' + $('mvStatus').textContent);
  };
  const upload = (id, files) => {
    const dt = new DataTransfer();
    for (const [name, bytes] of files) {
      const file = new File([new Uint8Array(bytes)], name.split('/').at(-1));
      if (id === 'mvTextureFolderInput')
        Object.defineProperty(file, 'webkitRelativePath', { value: name });
      dt.items.add(file);
    }
    $(id).files = dt.files;
    $(id).dispatchEvent(new Event('change'));
  };
  const colors = (canvas) => {
    const c = document.createElement('canvas');
    c.width = canvas.width;
    c.height = canvas.height;
    const ctx = c.getContext('2d');
    ctx.drawImage(canvas, 0, 0);
    const data = ctx.getImageData(0, 0, c.width, c.height).data;
    let green = 0,
      blue = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 1] > 65 && data[i + 1] > data[i] * 1.8 && data[i + 1] > data[i + 2] * 1.8)
        green++;
      if (data[i + 2] > 65 && data[i + 2] > data[i] * 1.8 && data[i + 2] > data[i + 1] * 1.8)
        blue++;
    }
    return { green, blue };
  };
  document.querySelector('[data-page="modelviewer"]').click();
  upload('mvInput', [
    ['livery.yft', fixtures.model],
    ['livery.ytd', fixtures.base],
  ]);
  await wait(
    () => $('mvTitle').textContent === 'livery.yft' && !$('mvOpen').disabled,
    'Livery fixture model did not load',
  );
  await sleep(150);
  assert(
    colors($('mvViewport').querySelector('canvas')).green > 20,
    'Primary diffuse was not visible before livery',
  );
  upload('mvTextureInput', [['livery.ytd', fixtures.livery]]);
  await wait(
    () => !$('mvOpen').disabled && $('mvStatus').textContent.includes('1 livery meshes'),
    'Adding YTD did not activate secondary livery',
  );
  await sleep(200);
  const viewer = colors($('mvViewport').querySelector('canvas'));
  assert(
    viewer.blue > 20 && viewer.green > 20,
    'Livery failed UV2/transparent-over-base GPU rendering: ' + JSON.stringify(viewer),
  );
  assert(
    $('mvMaterialInfo').textContent.includes('Livery UV 2: vehicle_sign_1 · aktif'),
    'Resolved livery slot was not reported',
  );
  console.log('DITASHA_SNAPSHOT:vehicle-livery-viewer');
  await sleep(200);
  $('mvPhotoshoot').click();
  await sleep(150);
  const photo = colors($('psCanvas'));
  assert(photo.blue > 20 && photo.green > 20, 'Photoshoot clone lost the livery shader');
  console.log('DITASHA_SNAPSHOT:vehicle-livery-photoshoot');
  await sleep(200);
  $('psClose').click();
  // Manual material selection remains an explicit replacement of automatic layers.
  $('mvMaterialTexture').value = '0';
  $('mvMaterialTexture').dispatchEvent(new Event('change'));
  await sleep(100);
  assert(
    colors($('mvViewport').querySelector('canvas')).blue < 10,
    'Manual replacement retained an automatic livery',
  );
  $('mvMaterialTexture').value = '';
  $('mvMaterialTexture').dispatchEvent(new Event('change'));
  await sleep(100);
  assert(
    colors($('mvViewport').querySelector('canvas')).blue > 20,
    'Automatic livery did not recover',
  );
  // Search an explicitly selected folder, decode only missing maps and preserve UV2 layering.
  upload('mvInput', [['livery.yft', fixtures.searchModel]]);
  await wait(
    () => !$('mvOpen').disabled && $('mvStatus').textContent.includes('0 external textures'),
    'Untextured model did not load',
  );
  upload('mvTextureFolderInput', [['library/shared.ytd', fixtures.combined]]);
  await wait(
    () =>
      !$('mvOpen').disabled &&
      $('mvTextureSearchStatus').textContent.includes('2 tekstur dipasang'),
    'Folder repair did not attach both maps',
  );
  await sleep(200);
  const repaired = colors($('mvViewport').querySelector('canvas'));
  assert(repaired.green > 20 && repaired.blue > 20, 'Folder repair lost livery/base GPU pixels');
  assert(
    $('mvTextureSearchReport').textContent.includes('library/shared.ytd'),
    'Repair report lost source path',
  );
  console.log('DITASHA_SNAPSHOT:texture-auto-repair');
  await sleep(200);
  upload('mvInput', [['next.yft', fixtures.searchModel]]);
  await wait(
    () =>
      !$('mvOpen').disabled &&
      $('mvTitle').textContent === 'next.yft' &&
      $('mvStatus').textContent.includes('2 external textures'),
    'Next model did not automatically reuse folder index',
  );
  $('mvTextureAuto').checked = false;
  upload('mvInput', [['third.yft', fixtures.searchModel]]);
  await wait(
    () => !$('mvOpen').disabled && $('mvTitle').textContent === 'third.yft',
    'Third model did not load',
  );
  upload('mvTextureFolderInput', [
    ['library/a.ytd', fixtures.combined],
    ['library/b.ytd', fixtures.combined],
  ]);
  await wait(
    () =>
      !$('mvOpen').disabled &&
      $('mvTextureSearchReport').textContent.includes('Perlu dipilih manual'),
    'Ambiguous textures were not reported',
  );
  assert(
    $('mvStatus').textContent.includes('0 external textures'),
    'Ambiguous search guessed a dictionary',
  );
  const stableReport = $('mvTextureSearchStatus').textContent;
  $('mvTextureAuto').checked = true;
  $('mvTextureAuto').dispatchEvent(new Event('change'));
  await sleep(600);
  assert(
    !$('mvOpen').disabled && $('mvTextureSearchStatus').textContent === stableReport,
    'Unresolved textures caused an automatic search loop',
  );
  // The existing manual upload remains usable after an ambiguous search.
  upload('mvTextureInput', [['third.ytd', fixtures.combined]]);
  await wait(
    () => !$('mvOpen').disabled && $('mvStatus').textContent.includes('2 external textures'),
    'Manual texture selection failed after ambiguous repair',
  );
  document.querySelector('[data-page="editor"]').click();
  upload('fileInput', [
    ['livery.yft', fixtures.model],
    ['livery.ytd', fixtures.combined],
  ]);
  await wait(
    () => $('fileLoading').hidden && $('material').options.length >= 2,
    'Editor livery files did not load',
  );
  // Select the livery texture for editing; it must not overwrite the base on every mesh.
  const option = [...$('material').options].find((o) => o.textContent.includes('vehicle_sign_1'));
  assert(option, 'Livery texture missing from editor variants');
  $('material').value = option.value;
  $('material').dispatchEvent(new Event('change'));
  await sleep(200);
  const editor = colors($('viewport').querySelector('canvas'));
  assert(
    editor.blue > 20 && editor.green > 20,
    'Texture & Model lost the secondary-UV livery/base separation: ' + JSON.stringify(editor),
  );
  console.log('DITASHA_SNAPSHOT:vehicle-livery-editor');
  await sleep(200);
  return {
    viewer,
    photo,
    editor,
    autoTextureRepair: true,
    folderReused: true,
    ambiguousSearchRefused: true,
    secondaryUv: true,
    transparentBasePreserved: true,
    manualOverride: true,
  };
};
