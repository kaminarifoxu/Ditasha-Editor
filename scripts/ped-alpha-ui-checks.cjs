module.exports = async function checkPedAlpha(fixtures) {
  const $ = (id) => document.getElementById(id);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const assert = (ok, message) => {
    if (!ok) throw Error(message);
  };
  async function load(name, model) {
    const dt = new DataTransfer();
    dt.items.add(new File([new Uint8Array(model)], name + '.yft'));
    dt.items.add(new File([new Uint8Array(fixtures.texture)], name + '.ytd'));
    $('fileInput').files = dt.files;
    $('fileInput').dispatchEvent(new Event('change'));
    const until = Date.now() + 20000;
    while (Date.now() < until) {
      if (
        $('fileLoading').hidden &&
        $('modelTitle').textContent === name + '.yft' &&
        $('textureTitle').textContent === 'head_diff_000_a_uni'
      ) {
        await sleep(200);
        return;
      }
      await sleep(40);
    }
    throw Error('Ped alpha fixture failed to load: ' + name);
  }
  function redPixels() {
    const source = $('viewport').querySelector('canvas');
    const c = document.createElement('canvas');
    c.width = source.width;
    c.height = source.height;
    const ctx = c.getContext('2d');
    ctx.drawImage(source, 0, 0);
    const rgba = ctx.getImageData(0, 0, c.width, c.height).data;
    let red = 0;
    for (let i = 0; i < rgba.length; i += 4)
      if (rgba[i] > 65 && rgba[i] > rgba[i + 1] * 1.8 && rgba[i] > rgba[i + 2] * 1.8) red++;
    return red;
  }
  document.querySelector('[data-page="editor"]').click();
  await load('skin-alpha-fixture', fixtures.skin);
  const skin = redPixels();
  assert(skin > 20, 'Head skin atlas lost its opaque preview');
  await load('brow-alpha-fixture', fixtures.brow);
  assert(
    $('pedMaterialMode').value === 'cutout',
    'Head texture filename overrode brow shader alpha',
  );
  const brow = redPixels();
  assert(brow < 10, 'Transparent brow card still rendered as a solid surface: ' + brow);
  $('pedMaterialMode').value = 'opaque';
  $('pedMaterialMode').dispatchEvent(new Event('change'));
  await sleep(150);
  assert(redPixels() > 20, 'Explicit opaque control no longer overrides automatic alpha');
  $('pedMaterialReset').click();
  await sleep(150);
  assert(redPixels() < 10, 'Reset did not restore transparent brow alpha');
  console.log('DITASHA_SNAPSHOT:ped-brow-alpha');
  await sleep(200);
  return {
    skinPixels: skin,
    transparentBrowPixels: brow,
    shaderBeforeFilename: true,
    manualOverride: true,
    reset: true,
  };
};
