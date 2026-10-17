module.exports = async function checkVehicleSurface(fixtures) {
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
  const energy = () => {
    const source = $('mvViewport').querySelector('canvas'),
      canvas = document.createElement('canvas');
    canvas.width = source.width;
    canvas.height = source.height;
    const c = canvas.getContext('2d');
    c.drawImage(source, 0, 0);
    const p = c.getImageData(0, 0, canvas.width, canvas.height).data;
    let value = 0,
      green = 0;
    for (let i = 0; i < p.length; i += 4) {
      value += ((p[i] + p[i + 1] + p[i + 2]) * p[i + 3]) / 255;
      if (p[i + 1] > p[i] * 1.5 && p[i + 1] > p[i + 2] * 1.5) green++;
    }
    return { value, green };
  };
  document.querySelector('[data-page="modelviewer"]').click();
  upload('mvInput', [
    ['surface.yft', fixtures.model],
    ['surface.ytd', fixtures.flat],
  ]);
  await wait(
    () =>
      !$('mvOpen').disabled && $('mvStatus').textContent.includes('1 normal / 1 specular meshes'),
    'Surface maps not active',
  );
  await sleep(250);
  assert(
    $('mvMaterialInfo').textContent.includes('normal: surface_normal — aktif') &&
      $('mvMaterialInfo').textContent.includes('specular: surface_spec — aktif'),
    'Per-mesh role diagnostics missing',
  );
  const flat = energy();
  assert(flat.value > 10000, 'Flat RG normal (blue=0) failed to reconstruct a lit surface');
  upload('mvTextureInput', [['surface.ytd', fixtures.shiny]]);
  await wait(() => !$('mvOpen').disabled, 'Specular map update busy');
  await sleep(300);
  const shiny = energy();
  assert(
    shiny.value > flat.value * 1.03,
    'RGB specular mask did not affect GPU lighting: ' + JSON.stringify({ flat, shiny }),
  );
  console.log('DITASHA_SNAPSHOT:vehicle-surface-specular');
  await sleep(150);
  upload('mvTextureInput', [['surface.ytd', fixtures.tilted]]);
  await wait(() => !$('mvOpen').disabled, 'Normal map update busy');
  await sleep(300);
  const tilted = energy();
  assert(Math.abs(tilted.value - flat.value) > 1000, 'RG normal map did not affect GPU lighting');
  $('mvPhotoshoot').click();
  await sleep(250);
  assert($('psCanvas').width > 0, 'Surface Photoshoot missing');
  console.log('DITASHA_SNAPSHOT:vehicle-surface-photoshoot');
  await sleep(150);
  $('psClose').click();
  upload('mvInput', [
    ['surface.yft', fixtures.model],
    ['surface.ytd', fixtures.aux],
  ]);
  await wait(
    () =>
      !$('mvOpen').disabled &&
      $('mvStatus').textContent.includes('Missing textures: cloth_diffuse'),
    'Missing diffuse was not diagnosed',
  );
  upload('mvTextureFolderInput', [
    ['pack/a.ytd', fixtures.wrong],
    ['pack/base.ytd', fixtures.parent],
    ['pack/vehicles.meta', fixtures.metadata],
  ]);
  await wait(
    () => !$('mvOpen').disabled && !$('mvStatus').textContent.includes('Missing textures:'),
    'Parent dictionary did not resolve missing diffuse',
  );
  await sleep(250);
  const repaired = energy();
  assert(repaired.green > 20, 'Parent relationship selected the wrong diffuse map');
  assert(
    $('mvTextureLibraryStatus').textContent.includes('1 relasi parent'),
    'Parent metadata count not shown',
  );
  assert($('mvMaterialInfo').textContent.includes('base.ytd'), 'Chosen parent source not shown');
  console.log('DITASHA_SNAPSHOT:vehicle-surface-parent');
  await sleep(150);
  return {
    flat,
    shiny,
    tilted,
    parent: repaired,
    normalRg: true,
    specularRgbMask: true,
    photoshoot: true,
    parentMetadata: true,
  };
};
