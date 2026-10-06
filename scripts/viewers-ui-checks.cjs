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
  async function checkSticker3d() {
    const original2d = $('textureCanvas').toDataURL();
    const source = document.querySelector('#viewport canvas');
    if (!source) {
      assert(!fixtures.requireWebgl, 'No WebGL for decal test');
      return;
    }
    const sample = document.createElement('canvas');
    sample.width = source.width;
    sample.height = source.height;
    const context = sample.getContext('2d');
    context.drawImage(source, 0, 0);
    const pixels = context.getImageData(0, 0, sample.width, sample.height).data;
    let xsum = 0,
      ysum = 0,
      count = 0;
    for (let y = 0; y < sample.height; y += 2)
      for (let x = 0; x < sample.width; x += 2) {
        const i = (y * sample.width + x) * 4;
        if (pixels[i] > 60 && pixels[i] > pixels[i + 1] * 2 && pixels[i] > pixels[i + 2] * 2) {
          xsum += x;
          ysum += y;
          count++;
        }
      }
    assert(count > 10, 'No surface to test PNG placement');
    const image = document.createElement('canvas');
    image.width = image.height = 32;
    const ctx = image.getContext('2d');
    ctx.fillStyle = '#0000ff';
    ctx.fillRect(0, 0, 32, 32);
    const blob = await new Promise((resolve) => image.toBlob(resolve, 'image/png'));
    await input(
      'stickerInput',
      [new File([blob], 'logo.png', { type: 'image/png' })],
      () => $('stickerPlace').getAttribute('aria-pressed') === 'true',
    );
    const rect = $('viewport').getBoundingClientRect();
    $('viewport').dispatchEvent(
      new PointerEvent('pointerdown', {
        bubbles: true,
        button: 0,
        clientX: rect.left + (xsum / count / sample.width) * rect.width,
        clientY: rect.top + (ysum / count / sample.height) * rect.height,
      }),
    );
    assert($('stickerList').children.length === 1, 'PNG was not projected onto 3D surface');
    await sleep(150);
    context.drawImage(source, 0, 0);
    const after = context.getImageData(0, 0, sample.width, sample.height).data;
    let blue = 0;
    for (let i = 0; i < after.length; i += 4)
      if (after[i + 2] > 70 && after[i + 2] > after[i] * 2 && after[i + 2] > after[i + 1] * 2)
        blue++;
    assert(blue > 10, '3D PNG decal did not render');
    assert($('textureCanvas').toDataURL() === original2d, '3D PNG altered 2D texture');
    $('stickerSize').value = 30;
    $('stickerSize').dispatchEvent(new Event('input'));
    $('stickerRotation').value = 25;
    $('stickerRotation').dispatchEvent(new Event('input'));
    console.log('DITASHA_SNAPSHOT:png-3d-sticker');
    await sleep(200);
    $('photoshoot').click();
    assert($('photoshootDialog').open, 'Decal photoshoot did not open');
    const photo = $('psCanvas'),
      data = photo.getContext('2d').getImageData(0, 0, photo.width, photo.height).data;
    let photoBlue = 0;
    for (let i = 0; i < data.length; i += 4)
      if (data[i + 2] > 70 && data[i + 2] > data[i] * 2 && data[i + 2] > data[i + 1] * 2)
        photoBlue++;
    assert(photoBlue > 10, 'Photoshoot omitted PNG sticker');
    $('psClose').click();
    await sleep(50);
    $('stickerRemove').click();
    assert($('stickerList').children.length === 0, 'PNG sticker could not be removed');
    $('stickerClear').click();
    assert($('textureCanvas').toDataURL() === original2d, 'Decal cleanup changed texture');
  }
  async function checkPhotoshoot(prefix) {
    $(prefix === 'ped' ? 'photoshoot' : 'mvPhotoshoot').click();
    assert($('photoshootDialog').open, 'Photoshoot failed to open');
    const canvas = $('psCanvas');
    assert(canvas.width === 1920 && canvas.height === 1080, 'Wrong photoshoot dimensions');
    $('psTransparent').checked = true;
    $('psTransparent').dispatchEvent(new Event('input'));
    await sleep(200);
    const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    const panels = [
      { red: 0, green: 0 },
      { red: 0, green: 0 },
      { red: 0, green: 0 },
    ];
    for (let y = 160; y < 950; y += 2)
      for (let x = 0; x < 1920; x += 2) {
        const i = (y * 1920 + x) * 4,
          p = panels[Math.min(2, Math.floor(x / 640))];
        if (!pixels[i + 3]) continue;
        if (pixels[i] > 60 && pixels[i] > pixels[i + 1] * 1.5) p.red++;
        if (pixels[i + 1] > 60 && pixels[i + 1] > pixels[i] * 1.5) p.green++;
      }
    assert(
      panels.every((p) => p.red > 10 && p.green > 10),
      'Three-angle photoshoot lost face/hair textures: ' + JSON.stringify(panels),
    );
    assert(pixels[3] === 0, 'Transparent background became opaque');
    $('psPreset').value = 'clothing';
    $('psPreset').dispatchEvent(new Event('change'));
    await sleep(150);
    assert($('psAngle1').value === '180', 'Clothing preset has no back view');
    $('psFront').value = 'x';
    $('psFront').dispatchEvent(new Event('input'));
    await sleep(100);
    assert($('psStatus').textContent.includes('PNG'), 'Alternate model orientation failed');
    $('psFront').value = 'camera';
    $('psFront').dispatchEvent(new Event('input'));
    $('psPreset').value = 'ped';
    $('psPreset').dispatchEvent(new Event('change'));
    $('psTitle').value = 'DITASHA · Catalog';
    $('psTitle').dispatchEvent(new Event('input'));
    $('psCaption').value = 'Three views · Ditasha-Workshop';
    $('psCaption').dispatchEvent(new Event('input'));
    const image = document.createElement('canvas');
    image.width = image.height = 16;
    const ctx = image.getContext('2d');
    ctx.fillStyle = '#3344ee';
    ctx.fillRect(0, 0, 16, 16);
    const blob = await new Promise((resolve) => image.toBlob(resolve, 'image/png'));
    await input(
      'psBackgroundInput',
      [new File([blob], 'background.png', { type: 'image/png' })],
      () => !$('psTransparent').checked,
    );
    await sleep(150);
    const corner = canvas.getContext('2d').getImageData(0, 0, 1, 1).data;
    assert(corner[2] === 238 && corner[3] === 255, 'Background image not composed');
    await input('psLogoInput', [new File([blob], 'logo.png', { type: 'image/png' })], () => true);
    await sleep(150);
    $('psClearBackground').click();
    $('psTransparent').checked = true;
    $('psTransparent').dispatchEvent(new Event('input'));
    await sleep(150);
    const logoPixel = canvas.getContext('2d').getImageData(55, 30, 1, 1).data;
    assert(logoPixel[2] === 238 && logoPixel[3] === 255, 'Logo image not composed');
    console.log('DITASHA_SNAPSHOT:' + prefix + '-photoshoot');
    await sleep(200);
    const before = saves.length;
    canceled = true;
    $('psExport').click();
    await wait(
      () => !$('psExport').disabled && saves.length > before,
      'Canceled photoshoot export hung',
    );
    assert($('psStatus').textContent.includes('dibatalkan'), 'Canceled export reported success');
    canceled = false;
    $('psExport').click();
    await wait(
      () => !$('psExport').disabled && saves.length > before + 1,
      'Photoshoot PNG not saved',
    );
    assert(
      saves.at(-1).name === 'ditasha-photoshoot.png' &&
        saves.at(-1).magic.join(',') === '137,80,78,71',
      'Invalid photoshoot PNG',
    );
    $('psClearLogo').click();
    $('psTitle').value = '';
    $('psCaption').value = '';
    $('psClose').click();
    await sleep(50);
    assert(!$('photoshootDialog').open, 'Photoshoot failed to close');
  }
  async function checkPedMaterial(prefix, canvasSelector, loadTexture) {
    const id = (suffix) => prefix + 'Material' + suffix;
    const snapshot = async () => {
      await sleep(150);
      const source = document.querySelector(canvasSelector);
      if (!source) {
        assert(!fixtures.requireWebgl, 'Ped WebGL missing');
        return null;
      }
      const canvas = document.createElement('canvas');
      canvas.width = source.width;
      canvas.height = source.height;
      canvas.getContext('2d').drawImage(source, 0, 0);
      const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
      let hash = 2166136261,
        opaque = 0;
      for (let i = 0; i < pixels.length; i++) {
        hash = Math.imul(hash ^ pixels[i], 16777619) >>> 0;
        if (i % 4 === 3 && pixels[i]) opaque++;
      }
      return { hash, opaque };
    };
    assert(
      $(id('Mode')).value === 'cutout' && !$(id('Black')).checked,
      'Ped alpha defaults incorrect',
    );
    assert($(id('Part')).options.length === 3, 'Ped meshes not available separately');
    await loadTexture(fixtures.pedAlphaYtd, 'ped-alpha.ytd');
    const empty = await snapshot();
    change(id('Mode'), 'opaque');
    let visible = await snapshot();
    if (empty)
      assert(
        visible.hash !== empty.hash && visible.opaque > empty.opaque + 10,
        'Ped opaque override did not render alpha cards',
      );
    change(id('Mode'), 'cutout');
    visible = await snapshot();
    if (empty) assert(visible.hash === empty.hash, 'Base ped ignored diffuse alpha');
    change(id('Cutoff'), '2');
    assert($(id('Cutoff')).value === '0.25', 'Invalid alpha threshold accepted');
    const first = $(id('Part')).options[1].value,
      second = $(id('Part')).options[2].value;
    change(id('Part'), first);
    change(id('Mode'), 'opaque');
    visible = await snapshot();
    if (empty) assert(visible.opaque > empty.opaque + 10, 'Individual ped material did not render');
    change(id('Part'), second);
    assert($(id('Mode')).value === 'cutout', 'Per-mesh alpha changed another part');
    change(id('Part'), 'all');
    change(id('Mode'), 'cutout');
    await loadTexture(fixtures.pedBlackYtd, 'ped-black.ytd');
    const black = await snapshot();
    if (empty) assert(black.opaque > empty.opaque + 10, 'Base black material removed by default');
    change(id('Part'), first);
    $(id('Black')).checked = true;
    $(id('Black')).dispatchEvent(new Event('change'));
    visible = await snapshot();
    if (empty)
      assert(
        visible.opaque > empty.opaque + 10,
        'Per-part black removal changed shared texture on another mesh',
      );
    change(id('Part'), second);
    assert(!$(id('Black')).checked, 'Per-part black removal changed other part settings');
    change(id('Part'), 'all');
    $(id('Black')).checked = true;
    $(id('Black')).dispatchEvent(new Event('change'));
    visible = await snapshot();
    if (empty)
      assert(visible.hash === empty.hash, 'Ped black background did not become transparent');
    if (prefix === 'ped') {
      const pixel = $('textureCanvas').getContext('2d').getImageData(0, 0, 1, 1).data;
      assert(
        pixel[3] === 255 && pixel[0] === 0,
        'Preview black removal changed editor/export pixels',
      );
    }
    $(id('Black')).checked = false;
    $(id('Black')).dispatchEvent(new Event('change'));
    visible = await snapshot();
    if (black)
      assert(visible.hash === black.hash, 'Disabling black removal failed to restore source');
    change(id('Part'), first);
    change(id('Mode'), 'blend');
    change(id('Cutoff'), '0.4');
    await loadTexture(fixtures.faceYtd, 'ped-restored.ytd');
    assert(
      $(id('Part')).value === first &&
        $(id('Mode')).value === 'blend' &&
        $(id('Cutoff')).value === '0.4',
      'Replacing YTD reset per-part settings',
    );
    change(id('Part'), 'all');
    $(id('Reset')).click();
    assert(
      $(id('Mode')).value === 'cutout' &&
        $(id('Cutoff')).value === '0.25' &&
        !$(id('Black')).checked,
      'Ped reset failed',
    );
    console.log('DITASHA_SNAPSHOT:' + prefix + '-material-alpha');
    await sleep(350);
  }
  async function checkHair(prefix, canvasSelector, fitId, baseTitleId, loadFaceTextures) {
    const title = $(baseTitleId).textContent;
    await input(
      prefix + 'HairInput',
      [new File([new Uint8Array(fixtures.model)], 'hair.ydd')],
      () => !$(prefix + 'AddHair').disabled,
    );
    await input(
      prefix + 'HairInput',
      [new File([new Uint8Array(fixtures.hairYtd)], 'hair.ytd')],
      () => !$(prefix + 'AddHair').disabled,
    );
    await input(
      prefix + 'HairTextureInput',
      [new File([new Uint8Array(fixtures.hairYtd)], 'hair-top.ytd')],
      () => !$(prefix + 'AddHair').disabled,
    );
    const list = $(prefix + 'HairList');
    assert(
      [...list.querySelectorAll('button')].every((b) => b.querySelector('.di-icon') && b.title),
      'Dynamic hair actions lost icons or tooltips',
    );
    assert(
      list.querySelector('[data-control="Tekstur rambut"]').textContent.includes('hair-top.ytd'),
      'YTD-only or top texture input failed',
    );
    assert(
      list.children.length === 1 && $(baseTitleId).textContent === title,
      'Hair replaced face model',
    );
    assert(
      list.textContent.includes('2 segitiga') && list.textContent.includes('Tekstur siap'),
      'Hair geometry/material not ready',
    );
    const transform = (key, value) => {
      const el = list.querySelector('[data-transform="' + key + '"]');
      el.value = value;
      el.dispatchEvent(new Event('change'));
    };
    transform('x', '1.5');
    transform('z', '0.2');
    transform('ry', '10');
    transform('scale', '0.8');
    $(fitId).click();
    await loadFaceTextures();
    assert(list.children.length === 1, 'Face YTD erased hair');
    const colors = async () => {
      await sleep(150);
      const source = document.querySelector(canvasSelector);
      if (!source) {
        assert(!fixtures.requireWebgl, 'Hair preview WebGL missing');
        return null;
      }
      const c = document.createElement('canvas');
      c.width = source.width;
      c.height = source.height;
      c.getContext('2d').drawImage(source, 0, 0);
      const data = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      let green = 0,
        red = 0,
        hash = 2166136261;
      for (let i = 0; i < data.length; i += 4) {
        if (
          data[i + 3] &&
          data[i + 1] > 30 &&
          data[i + 1] > data[i] * 2 &&
          data[i + 1] > data[i + 2] * 2
        )
          green++;
        for (let channel = 0; channel < 4; channel++)
          hash = Math.imul(hash ^ data[i + channel], 16777619) >>> 0;
        if (data[i + 3] && data[i] > 30 && data[i] > data[i + 1] * 2 && data[i] > data[i + 2] * 2)
          red++;
      }
      return { green, red, hash };
    };
    let pixels = await colors();
    if (pixels)
      assert(
        pixels.green > 10 && pixels.red > 10,
        'Hair/face materials not rendered independently: ' + JSON.stringify(pixels),
      );
    // A second YTD with a different name and colour must visibly replace the old diffuse.
    await input(
      prefix + 'HairTextureInput',
      [new File([new Uint8Array(fixtures.faceYtd)], 'replacement.ytd')],
      () => !$(prefix + 'AddHair').disabled,
    );
    pixels = await colors();
    if (pixels)
      assert(pixels.green === 0 && pixels.red > 10, 'Replacement YTD did not update hair pixels');
    await input(
      prefix + 'HairTextureInput',
      [new File([new Uint8Array(fixtures.hairYtd)], 'hair-restored.ytd')],
      () => !$(prefix + 'AddHair').disabled,
    );
    const mode = list.querySelector('[data-control="Transparansi rambut"]');
    assert(mode.value === 'cutout', 'Hair did not default to alpha cutout');
    const black = list.querySelector('[data-control="remove-black"]');
    assert(!black.checked, 'Black hair removed by default');
    black.checked = true;
    black.dispatchEvent(new Event('change'));
    pixels = await colors();
    if (pixels) assert(pixels.green > 10, 'Black removal damaged colour texture');
    [...list.querySelectorAll('button')].find((b) => b.textContent === 'Hapus YTD rambut').click();
    assert(!list.textContent.includes('hair-restored.ytd'), 'External YTD not removed');
    pixels = await colors();
    if (pixels)
      assert(pixels.green === 0 && pixels.red > 10, 'YTD removal erased face or retained hair map');
    await input(
      prefix + 'HairTextureInput',
      [new File([new Uint8Array(fixtures.hairYtd)], 'hair-restored.ytd')],
      () => !$(prefix + 'AddHair').disabled,
    );
    await input(
      prefix + 'HairTextureInput',
      [new File([new Uint8Array(fixtures.transparentHairYtd)], 'alpha.ytd')],
      () => !$(prefix + 'AddHair').disabled,
    );
    pixels = await colors();
    if (pixels)
      assert(
        pixels.green === 0 && pixels.red > 10,
        'Hair alpha did not discard transparent cards · ' +
          prefix +
          ' · ' +
          JSON.stringify(pixels) +
          ' · face pixel ' +
          JSON.stringify([...$('textureCanvas').getContext('2d').getImageData(0, 0, 1, 1).data]),
      );
    const transparentHash = pixels?.hash;
    const setBlackRemoval = (enabled) => {
      const control = list.querySelector('[data-control="remove-black"]');
      control.checked = enabled;
      control.dispatchEvent(new Event('change'));
    };
    setBlackRemoval(false);
    await input(
      prefix + 'HairTextureInput',
      [new File([new Uint8Array(fixtures.blackHairYtd)], 'black.ytd')],
      () => !$(prefix + 'AddHair').disabled,
    );
    pixels = await colors();
    if (pixels) assert(pixels.hash !== transparentHash, 'Genuine black hair was not preserved');
    setBlackRemoval(true);
    pixels = await colors();
    if (pixels)
      assert(
        pixels.hash === transparentHash && pixels.red > 10,
        'Optional black background removal failed or affected face',
      );
    setBlackRemoval(false);
    await input(
      prefix + 'HairTextureInput',
      [new File([new Uint8Array(fixtures.hairYtd)], 'hair-restored.ytd')],
      () => !$(prefix + 'AddHair').disabled,
    );
    if (prefix === 'ped') await checkSticker3d();
    await checkPhotoshoot(prefix);
    console.log('DITASHA_SNAPSHOT:' + prefix + '-hair-preview');
    await sleep(350);
    const visible = list.querySelector('input[type="checkbox"]');
    visible.checked = false;
    visible.dispatchEvent(new Event('change'));
    pixels = await colors();
    if (pixels) assert(pixels.green === 0 && pixels.red > 10, 'Hair visibility changed face');
    visible.checked = true;
    visible.dispatchEvent(new Event('change'));
    await input(
      prefix + 'HairInput',
      [new File(['broken'], 'bad.ydd')],
      () => !$(prefix + 'AddHair').disabled,
    );
    assert(
      list.children.length === 1 && $(baseTitleId).textContent === title,
      'Bad hair erased preview',
    );
    const textureInput = list.querySelector('[data-control="hair-textures"]');
    const dt = new DataTransfer();
    dt.items.add(new File(['broken'], 'bad.ytd'));
    textureInput.files = dt.files;
    textureInput.dispatchEvent(new Event('change'));
    await wait(() => !$(prefix + 'AddHair').disabled, 'Hair texture operation did not finish');
    pixels = await colors();
    if (pixels) assert(pixels.green > 10, 'Bad YTD erased hair material');
    const manual = list.querySelector('[data-control="Tekstur rambut"]');
    manual.value = '0';
    manual.dispatchEvent(new Event('change'));
    const reset = [...list.querySelectorAll('button')].find(
      (b) => b.textContent === 'Reset posisi',
    );
    reset.click();
    assert(
      list.querySelector('[data-transform="x"]').value === '0' &&
        list.querySelector('[data-transform="scale"]').value === '1',
      'Hair reset failed',
    );
    transform('scale', '0');
    assert(
      list.querySelector('[data-transform="scale"]').value === '1',
      'Invalid hair scale accepted',
    );
    $(prefix + 'RemoveHair').click();
    assert(
      list.children.length === 0 && $(baseTitleId).textContent === title,
      'Remove hair erased face',
    );
  }
  document.querySelector('[data-page="editor"]').click();
  await wait(() => $('fileLoading').hidden, 'Previous editor import not finished');
  await input(
    'fileInput',
    [new File([new Uint8Array(fixtures.model)], 'face.ydd')],
    () => $('fileLoading').hidden && $('modelTitle').textContent === 'face.ydd',
  );
  await checkHair('ped', '#viewport canvas', 'reset', 'modelTitle', () =>
    input(
      'fileInput',
      [new File([new Uint8Array(fixtures.faceYtd)], 'face.ytd')],
      () =>
        $('fileLoading').hidden &&
        $('textureTitle').textContent === 'cloth_diffuse' &&
        $('dimensions').textContent.includes('1'),
    ),
  );
  await checkPedMaterial('ped', '#viewport canvas', (bytes, name) =>
    input(
      'fileInput',
      [new File([new Uint8Array(bytes)], name)],
      () => $('fileLoading').hidden && $('textureTitle').textContent === 'cloth_diffuse',
    ),
  );
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
    $('mvLod').options.length === 2 && $('mvParts').querySelectorAll(':scope > label').length === 2,
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
    $('mvStatus').textContent.includes('Medium') &&
      $('mvParts').querySelectorAll(':scope > label').length === 1,
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
  await checkHair('mvPed', '#mvViewport canvas', 'mvFit', 'mvTitle', () =>
    input(
      'mvTextureInput',
      [new File([new Uint8Array(fixtures.faceYtd)], 'face.ytd')],
      () => !$('mvAddTextures').disabled,
    ),
  );
  await checkPedMaterial('mvPed', '#mvViewport canvas', (bytes, name) =>
    input(
      'mvTextureInput',
      [new File([new Uint8Array(bytes)], name)],
      () => !$('mvAddTextures').disabled,
    ),
  );
  await input(
    'mvPedHairInput',
    [new File([new Uint8Array(fixtures.model)], 'hair.ydd')],
    () => !$('mvPedAddHair').disabled,
  );
  await input(
    'mvPedHairInput',
    [new File([new Uint8Array(fixtures.model)], 'second-hair.ydd')],
    () => !$('mvPedAddHair').disabled,
  );
  change('mvPedHairTarget', '0');
  await input(
    'mvPedHairInput',
    [new File([new Uint8Array(fixtures.hairYtd)], 'selected-hair.ytd')],
    () => !$('mvPedAddHair').disabled,
  );
  assert(
    $('mvPedHairList').children[0].textContent.includes('selected-hair.ytd') &&
      !$('mvPedHairList').children[1].textContent.includes('selected-hair.ytd'),
    'YTD applied to wrong hair',
  );
  change('mvLod', '1');
  assert($('mvPedHairList').children.length === 2, 'LOD switch erased hair');
  $('mvPedRemoveHair').click();
  assert(
    $('mvPedHairList').children.length === 1 &&
      $('mvPedHairList').textContent.includes('second-hair.ydd'),
    'Selected removal removed wrong hair',
  );
  $('mvPedClearHair').click();
  assert(
    !$('mvPedHairList').children.length && $('mvPedHairTargetRow').hidden,
    'Clear all left stale target or mesh',
  );

  await input(
    'mvPedHairInput',
    [new File([new Uint8Array(fixtures.model)], 'replacement-base-test.ydd')],
    () => !$('mvPedAddHair').disabled,
  );
  assert($('mvPedHairList').children.length === 1, 'Base replacement test did not load hair');
  await input(
    'mvInput',
    [new File([new Uint8Array(fixtures.model)], 'new-face.ydd')],
    () => !$('mvOpen').disabled,
  );
  assert(!$('mvPedHairList').children.length, 'New base retained old hair');
  assert(
    $('mvPedMaterialMode').value === 'cutout' && !$('mvPedMaterialBlack').checked,
    'New base retained old material overrides',
  );
  // Restore the expected title used by the invalid-model regression below.
  await input(
    'mvInput',
    [new File([new Uint8Array(fixtures.model)], 'fixture.ydd')],
    () => !$('mvOpen').disabled,
  );

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
  document.querySelector('[data-page="modelviewer"]').click();
  await input(
    'mvInput',
    [new File([new Uint8Array(fixtures.model)], 'vehicle.ydd')],
    () => !$('mvOpen').disabled,
  );
  await input(
    'mvTextureInput',
    [new File([new Uint8Array(fixtures.alphaYtd)], 'vehicle.ytd')],
    () => !$('mvOpen').disabled,
  );
  assert($('mvTextures').textContent.includes('vehicle_mask'), 'A8 vehicle YTD failed in viewer');
  const beforeExtra = $('mvStatus').textContent;
  await input(
    'mvExtraInput',
    [new File([new Uint8Array(fixtures.fragmentYft)], 'coq_livery1.yft')],
    () => !$('mvOpen').disabled,
  );
  assert(
    $('mvModels').querySelectorAll('input[type=checkbox]').length === 2,
    'YFT livery/fragment drawables not added',
  );
  assert(
    [...$('mvModels').querySelectorAll('input[type=checkbox]')].every((i) => !i.checked),
    'Variants stacked automatically',
  );
  const extra = $('mvModels').querySelector('input[type=checkbox]');
  extra.checked = true;
  extra.dispatchEvent(new Event('change'));
  assert($('mvStatus').textContent !== beforeExtra, 'Extra YFT geometry not combined with vehicle');
  assert($('mvParts').querySelector('.mesh-parts input'), 'Individual mesh controls missing');
  const offsetInput = $('mvModels').querySelector('.extra-transform input');
  offsetInput.value = '0.75';
  offsetInput.dispatchEvent(new Event('change'));
  assert(
    $('mvModels').querySelector('.extra-transform input').value === '0.75',
    'Extra transform not retained',
  );
  const image = document.createElement('canvas');
  image.width = image.height = 16;
  const ctx = image.getContext('2d');
  ctx.fillStyle = '#0000ff';
  ctx.fillRect(0, 0, 16, 16);
  const blob = await new Promise((resolve) => image.toBlob(resolve, 'image/png'));
  await input(
    'mvTextureInput',
    [new File([blob], 'manual_livery.png', { type: 'image/png' })],
    () => !$('mvOpen').disabled,
  );
  $('mvMaterialMesh').value =
    $('mvMaterialMesh').options[$('mvMaterialMesh').options.length - 1].value;
  $('mvMaterialMesh').dispatchEvent(new Event('change'));
  const choice = [...$('mvMaterialTexture').options].find((o) =>
    o.textContent.includes('manual_livery.png'),
  );
  assert(choice, 'Manual livery texture not available');
  $('mvMaterialTexture').value = choice.value;
  $('mvMaterialTexture').dispatchEvent(new Event('change'));
  assert(
    $('mvMaterialTexture').selectedOptions[0].textContent.includes('manual_livery.png'),
    'Material override lost',
  );
  await sleep(150);
  const viewerCanvas = document.querySelector('#mvViewport canvas'),
    actual = document.createElement('canvas');
  actual.width = viewerCanvas.width;
  actual.height = viewerCanvas.height;
  actual.getContext('2d').drawImage(viewerCanvas, 0, 0);
  const materialPixels = actual
    .getContext('2d')
    .getImageData(0, 0, actual.width, actual.height).data;
  let materialBlue = 0;
  for (let i = 0; i < materialPixels.length; i += 4)
    if (
      materialPixels[i + 2] > 70 &&
      materialPixels[i + 2] > materialPixels[i] * 2 &&
      materialPixels[i + 2] > materialPixels[i + 1] * 2
    )
      materialBlue++;
  assert(materialBlue > 10, 'Manual livery assignment did not change rendered mesh');
  console.log('DITASHA_SNAPSHOT:vehicle-material-extra');
  await sleep(200);
  const retained = $('mvModels').textContent;
  await input('mvExtraInput', [new File(['broken'], 'bad.yft')], () => !$('mvOpen').disabled);
  assert($('mvModels').textContent === retained, 'Invalid extra destroyed vehicle state');
  $('mvModels').querySelector('button').click();
  assert(
    $('mvModels').querySelectorAll('input[type=checkbox]').length === 1,
    'Extra YFT not removable',
  );
  return {
    saves,
    checks:
      'Vehicle A8 YTD, separate YFT livery/fragment choices, individual meshes, manual texture assignment and invalid extra retention; PNG decals render and enter Photoshoot without touching 2D; Photoshoot three views with face/hair, background/logo, transparent PNG and canceled/successful saves in both workspaces; texture gallery, exact size/zoom, grid/list, search/background, PNG/DDS/bulk export and canceled save; model LOD/parts, external/embedded textures and invalid-file retention; ped hair YDD/YTD, independent rendered face/hair materials, transforms, visibility, invalid imports and reset/removal; folder sort, text/hex inspection, paired viewers and new RPF',
  };
};
