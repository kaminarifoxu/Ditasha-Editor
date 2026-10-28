module.exports = async function checkFullped(fixtures) {
  const $ = (id) => document.getElementById(id);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const assert = (ok, message) => {
    if (!ok) throw Error(message);
  };
  async function wait(fn, label) {
    const end = Date.now() + 20000;
    while (Date.now() < end) {
      if (fn()) return;
      await sleep(40);
    }
    throw Error(label);
  }
  function upload(id, files) {
    const dt = new DataTransfer();
    for (const [name, data] of files) dt.items.add(new File([new Uint8Array(data)], name));
    $(id).files = dt.files;
    $(id).dispatchEvent(new Event('change'));
  }
  document.querySelector('[data-page="modelviewer"]').click();
  upload('mvInput', [
    ['multipart.ydd', fixtures.model],
    ['multipart.ytd', fixtures.texture],
  ]);
  await wait(
    () => $('mvTitle').textContent === 'multipart.ydd' && !$('mvOpen').disabled,
    'Fullped viewer load failed',
  );
  assert(
    $('mvDrawable').value === '-1',
    'Component ped did not select all drawable parts automatically',
  );
  assert(
    $('mvStatus').textContent.includes('18 vertices'),
    'Viewer dropped fullped geometry: ' + $('mvStatus').textContent,
  );
  assert($('mvParts').querySelectorAll('.mesh-parts').length === 6, 'Fullped visibility groups missing');
  $('mvDrawable').value = '0';
  $('mvDrawable').dispatchEvent(new Event('change'));
  assert($('mvStatus').textContent.includes('6 vertices'), 'Individual component selection failed');
  $('mvDrawable').value = '-1';
  $('mvDrawable').dispatchEvent(new Event('change'));
  assert($('mvStatus').textContent.includes('18 vertices'), 'Fullped could not be restored');
  console.log('DITASHA_SNAPSHOT:fullped-viewer');
  await sleep(200);
  document.querySelector('[data-page="editor"]').click();
  upload('fileInput', [['multipart.ydd', fixtures.model]]);
  await wait(
    () => $('fileLoading').hidden && $('modelTitle').textContent === 'multipart.ydd',
    'Fullped editor load failed',
  );
  assert(
    $('drawable').value === '-1' && $('modelStats').textContent.includes('18 vertex'),
    'Editor did not assemble fullped',
  );
  assert(
    $('textureTitle').textContent === 'UV · Semua drawable',
    'Combined UV map was not selected',
  );
  const card = (name) =>
    [...$('texturestrip').querySelectorAll('button')].find((b) => b.textContent.includes(name));
  assert(
    $('texturestrip').querySelectorAll('button').length === 4,
    'Individual and combined UV cards missing',
  );
  card('lowr_000_u').click();
  assert(
    $('drawable').value === '0' && $('modelStats').textContent.includes('6 vertex'),
    'UV card did not switch the matching 3D component',
  );
  card('Semua drawable').click();
  assert(
    $('drawable').value === '-1' && $('modelStats').textContent.includes('18 vertex'),
    'Combined UV card did not restore fullped',
  );
  upload('fileInput', [['multipart.ytd', fixtures.texture]]);
  await wait(
    () => $('fileLoading').hidden && $('textureTitle').textContent === 'cloth_diffuse',
    'Fullped texture failed to load',
  );
  assert($('modelStats').textContent.includes('18 vertex'), 'Loading YTD hid fullped components');
  assert(
    !$('materialBindingStatus').textContent.includes('belum ditemukan'),
    'Fullped diffuse unresolved',
  );
  console.log('DITASHA_SNAPSHOT:fullped-editor');
  await sleep(200);
  return {
    automaticAssembly: true,
    viewerVertices: 18,
    individualVertices: 6,
    parts: 6,
    combinedUV: true,
    uvCardSwitchesModel: true,
    textureRetainsBody: true,
  };
};
