module.exports = async function checkViewers(fixtures) {
  const $ = (id) => document.getElementById(id),
    assert = (ok, message) => {
      if (!ok) throw Error(message);
    },
    sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const wait = async (test, message) => {
    const end = Date.now() + 15000;
    while (Date.now() < end) {
      if (test()) return;
      await sleep(25);
    }
    throw Error(message + ' · ' + $('tvStatus')?.textContent + ' · ' + $('mvStatus')?.textContent);
  };
  const saves = [];
  let canceled = false;
  window.ditashaDesktop.saveExport = async ({ name, data }) => {
    saves.push({ name, size: data.length, magic: [...data.slice(0, 4)] });
    return { saved: !canceled };
  };
  async function input(id, files, ready) {
    const dt = new DataTransfer();
    files.forEach((f) => dt.items.add(f));
    $(id).files = dt.files;
    $(id).dispatchEvent(new Event('change'));
    await wait(ready, 'File operation failed');
  }
  const change = (id, value) => {
    $(id).value = value;
    $(id).dispatchEvent(new Event('change'));
  };
  document.querySelector('[data-page="textureviewer"]').click();
  await input(
    'tvInput',
    [new File([new Uint8Array(fixtures.ytd)], 'test.ytd')],
    () => !$('tvOpen').disabled,
  );
  assert(
    $('tvGallery').children.length === 1 && $('tvInfo').textContent.includes('4 × 4'),
    'Texture gallery or metadata missing',
  );
  assert(!$('tvCanvas').hidden, 'Selected texture missing');
  $('tvOriginal').click();
  assert($('tvCanvas').style.width === '4px', 'Original-size preview not exact');
  $('tvZoomIn').click();
  assert($('tvCanvas').style.width === '5px', 'Texture zoom failed');
  change('tvLayout', 'list');
  assert($('tvGallery').classList.contains('is-list'), 'List view not active');
  change('tvBackground', 'white');
  assert($('tvPreview').classList.contains('white'), 'Alpha background failed');
  $('tvSearch').value = 'no match';
  $('tvSearch').dispatchEvent(new Event('input'));
  assert(!$('tvGallery').children.length, 'Texture search failed');
  $('tvSearch').value = '';
  $('tvSearch').dispatchEvent(new Event('input'));
  change('tvLayout', 'grid');
  change('tvBackground', 'checker');
  $('tvFit').click();
  console.log('DITASHA_SNAPSHOT:texture-viewer');
  canceled = true;
  $('tvExport').click();
  await wait(() => !$('tvOpen').disabled, 'Canceled texture save failed');
  assert($('tvStatus').textContent === 'Save canceled.', 'Canceled texture save reported success');
  assert(saves.at(-1).magic.join(',') === '137,80,78,71', 'Invalid viewer PNG');
  canceled = false;
  change('tvFormat', 'dds');
  $('tvExport').click();
  await wait(() => !$('tvOpen').disabled, 'DDS export failed');
  assert(saves.at(-1).magic.join(',') === '68,68,83,32', 'Invalid viewer DDS');
  $('tvExportAll').click();
  await wait(() => !$('tvOpen').disabled, 'Bulk texture export failed');
  assert(saves.at(-1).name === 'ditasha-textures.zip', 'Bulk texture export missing');
  await input('tvInput', [new File(['broken'], 'bad.ytd')], () => !$('tvOpen').disabled);
  assert($('tvGallery').children.length === 1, 'Invalid texture erased previous gallery');
  document.querySelector('[data-page="modelviewer"]').click();
  await input(
    'mvInput',
    [new File([new Uint8Array(fixtures.model)], 'fixture.ydd')],
    () => !$('mvOpen').disabled,
  );
  assert(
    $('mvLod').options.length === 2 && $('mvParts').children.length === 2,
    'LOD / part selection missing',
  );
  assert($('mvStatus').textContent.includes('2 triangles'), 'Model stats wrong');
  assert($('mvTextures').textContent.includes('cloth_diffuse'), 'Embedded texture missing');
  $('mvHideAll').click();
  assert(
    [...$('mvParts').querySelectorAll('input')].every((i) => !i.checked),
    'Hide all failed',
  );
  $('mvShowAll').click();
  assert(
    [...$('mvParts').querySelectorAll('input')].every((i) => i.checked),
    'Show all failed',
  );
  change('mvLod', '1');
  assert(
    $('mvStatus').textContent.includes('Medium') && $('mvParts').children.length === 1,
    'LOD did not switch',
  );
  for (const id of ['mvGrid', 'mvWire', 'mvBounds', 'mvPoints']) {
    $(id).checked = !$(id).checked;
    $(id).dispatchEvent(new Event('change'));
  }
  change('mvLod', '0');
  $('mvFit').click();
  if (fixtures.requireWebgl)
    assert($('mvViewport').querySelector('canvas'), 'WebGL model rendering unavailable');
  if ($('mvViewport').querySelector('canvas')) {
    for (const [id, value] of [
      ['mvWire', false],
      ['mvBounds', true],
      ['mvPoints', false],
      ['mvGrid', true],
    ]) {
      $(id).checked = value;
      $(id).dispatchEvent(new Event('change'));
    }
    $('mvSnapshot').click();
    await wait(() => !$('mvOpen').disabled, 'Model snapshot failed');
    assert(saves.at(-1).magic.join(',') === '137,80,78,71', 'Invalid model snapshot PNG');
    const source = $('mvViewport').querySelector('canvas'),
      c = document.createElement('canvas');
    c.width = source.width;
    c.height = source.height;
    c.getContext('2d').drawImage(source, 0, 0);
    const pixels = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let opaque = 0;
    for (let i = 3; i < pixels.length; i += 4) if (pixels[i]) opaque++;
    assert(opaque > 100, '3D renderer produced no visible geometry');
  }
  console.log('DITASHA_SNAPSHOT:model-viewer');
  await input(
    'mvTextureInput',
    [new File([new Uint8Array(fixtures.ytd)], 'extra.ytd')],
    () => !$('mvAddTextures').disabled,
  );
  assert($('mvTextures').textContent.includes('test_texture'), 'External YTD not loaded');
  await input('mvInput', [new File(['broken'], 'bad.yft')], () => !$('mvOpen').disabled);
  assert($('mvTitle').textContent === 'fixture.ydd', 'Bad model erased previous model');
  document.querySelector('[data-page="archives"]').click();
  const ytd = new File([new Uint8Array(fixtures.ytd)], 'test.ytd'),
    model = new File([new Uint8Array(fixtures.model)], 'test.ydd'),
    text = new File(['<meta>preview</meta>'], 'settings.meta');
  for (const f of [ytd, model, text])
    Object.defineProperty(f, 'webkitRelativePath', { value: 'gta/assets/' + f.name });
  await input('archiveFolderInput', [ytd, model, text], () => !$('archiveOpen').disabled);
  assert(
    $('archiveKind').textContent === 'Folder' && $('archiveEntries').children.length === 3,
    'Folder did not open',
  );
  assert($('archiveAdd').disabled && $('archiveExport').disabled, 'Folder unexpectedly writable');
  change('archiveSort', 'size');
  const select = (name) =>
    [...$('archiveEntries').querySelectorAll('button')].find((b) => b.textContent === name).click();
  select('assets/settings.meta');
  $('archiveInspect').click();
  await wait(() => $('archiveInspector').open, 'Text inspector did not open');
  assert(
    $('inspectorContent').textContent === '<meta>preview</meta>',
    'Text inspection did not preserve source',
  );
  $('inspectorHex').click();
  assert($('inspectorContent').textContent.includes('3c 6d 65 74'), 'Hex inspection wrong');
  $('inspectorClose').click();
  select('assets/test.ydd');
  $('archiveModelViewer').click();
  await wait(
    () =>
      !document.querySelector('.model-viewer').hidden && $('mvTitle').textContent === 'test.ydd',
    'Explorer did not open model viewer',
  );
  assert($('mvTextures').textContent.includes('test_texture'), 'Paired folder YTD missing');
  document.querySelector('[data-page="archives"]').click();
  select('assets/test.ytd');
  $('archiveTextureViewer').click();
  await wait(
    () =>
      !document.querySelector('.texture-viewer').hidden && $('tvTitle').textContent === 'test.ytd',
    'Explorer did not open texture viewer',
  );
  document.querySelector('[data-page="archives"]').click();
  $('archiveNew').click();
  await wait(() => !$('archiveOpen').disabled, 'New RPF failed');
  assert(
    $('archiveTitle').textContent === 'untitled.rpf' && !$('archiveAdd').disabled,
    'New archive missing',
  );
  $('archiveExport').click();
  await wait(() => !$('archiveOpen').disabled, 'Empty RPF export failed');
  assert(
    saves.at(-1).name === 'untitled-edited.rpf' && saves.at(-1).magic.join(',') === '55,70,80,82',
    'New RPF export invalid',
  );
  return {
    saves,
    checks:
      'Texture gallery, exact size/zoom, grid/list, search/background, PNG/DDS/bulk export and canceled save; model LOD/parts, external/embedded textures and invalid-file retention; folder sort, text/hex inspection, paired viewers and new RPF',
  };
};
