module.exports = async function checkManualStudio(fixtures) {
  const $ = (id) => document.getElementById(id),
    assert = (condition, message) => {
      if (!condition) throw Error(message);
    };
  async function wait(check, message) {
    const until = Date.now() + 20000;
    while (Date.now() < until) {
      if (check()) return;
      await new Promise((r) => setTimeout(r, 40));
    }
    throw Error(message + ' · ' + $('toast').textContent);
  }
  async function input(id, files) {
    const dt = new DataTransfer();
    files.forEach((f) => dt.items.add(f));
    $(id).files = dt.files;
    $(id).dispatchEvent(new Event('change'));
  }
  const saves = [];
  window.ditashaDesktop = {
    saveExport: async (data) => {
      saves.push(data);
      return { saved: true };
    },
  };
  const c = document.createElement('canvas');
  c.width = c.height = 8;
  c.getContext('2d').fillStyle = '#ff0000';
  c.getContext('2d').fillRect(0, 0, 8, 8);
  const image = await new Promise((resolve) => c.toBlob(resolve));
  document.querySelector('[data-page=editor]').click();
  await input('fileInput', [new File([image], 'studio-red.png', { type: 'image/png' })]);
  await wait(() => $('textureTitle').textContent.includes('studio-red'), 'Canvas source failed');
  $('duplicateLayer').click();
  $('color').value = '#808080';
  $('fillLayer').click();
  $('csBlend').value = 'multiply';
  $('csBlend').dispatchEvent(new Event('change'));
  const pixel = () => [...$('textureCanvas').getContext('2d').getImageData(4, 4, 1, 1).data];
  assert(
    pixel().join(',') === '128,0,0,255',
    'Blend mode does not affect exported pixels: ' + pixel(),
  );
  $('size').value = 2;
  $('csMaskHide').click();
  const target = $('textureCanvas'),
    r = target.getBoundingClientRect(),
    capture = target.setPointerCapture;
  target.setPointerCapture = () => {};
  target.dispatchEvent(
    new PointerEvent('pointerdown', {
      clientX: r.x + r.width / 2,
      clientY: r.y + r.height / 2,
      button: 0,
      pointerId: 1,
      bubbles: true,
    }),
  );
  target.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1, bubbles: true }));
  target.setPointerCapture = capture;
  assert(pixel().join(',') === '255,0,0,255', 'Mask did not reveal the original layer: ' + pixel());
  $('undo').click();
  assert(pixel()[0] === 128, 'Mask undo failed');
  $('redo').click();
  assert(pixel()[0] === 255, 'Mask redo failed');
  $('csSave').click();
  await wait(() => saves.some((s) => s.name === 'ditasha-canvas.json'), 'Canvas project not saved');
  const saved = saves.find((s) => s.name === 'ditasha-canvas.json'),
    project = JSON.parse(new TextDecoder().decode(saved.data));
  assert(
    project.layers.length === 2 && project.layers[1].mask && project.layers[1].blend === 'multiply',
    'Layer project omitted masks/blend',
  );
  await input('csProjectInput', [new File([saved.data], 'project.json')]);
  await wait(() => $('csStatus').textContent.includes('tab baru'), 'Canvas project restore failed');
  assert($('csBlend').value === 'multiply' && pixel()[0] === 255, 'Canvas project pixels changed');
  $('csLock').click();
  assert($('csMaskHide').disabled, 'Locked layer can still be masked');
  $('csLock').click();
  const change = (id, value) => {
    $(id).value = value;
    $(id).dispatchEvent(new Event('change'));
  };
  change('layerW', 4);
  change('layerX', 1);
  document.querySelector('[data-align=right]').click();
  assert(Number($('layerX').value) === 4, 'Canvas alignment failed');
  const tabCount = $('documentTabs').children.length;
  await input('csProjectInput', [
    new File(
      [
        JSON.stringify({
          ...project,
          layers: [{ ...project.layers[0], image: 'https://example.com/image.png' }],
        }),
      ],
      'invalid.json',
    ),
  ]);
  await new Promise((r) => setTimeout(r, 120));
  assert($('documentTabs').children.length === tabCount, 'Invalid project mutated workspace');
  document.querySelector('[data-page=modelviewer]').click();
  await input('mvInput', [new File([new Uint8Array(fixtures.model)], 'studio.ydd')]);
  await wait(
    () => $('mvTitle').textContent.includes('studio') && !$('mvOpen').disabled,
    'Scene source failed',
  );
  assert($('ssModelObject').options.length > 0, 'Scene outliner empty');
  change('ssModelx', 0.5);
  assert(Number($('ssModelx').value) === 0.5, 'Scene move failed');
  $('ssModelUndo').click();
  assert(Number($('ssModelx').value) === 0, 'Scene undo failed');
  $('ssModelRedo').click();
  assert(Number($('ssModelx').value) === 0.5, 'Scene redo failed');
  change('ssModelsy', 2);
  $('mvMaterialAlpha').value = 'opaque';
  $('mvMaterialAlpha').dispatchEvent(new Event('change'));
  assert(
    Number($('ssModelx').value) === 0.5 && Number($('ssModelsy').value) === 2,
    'Material rebuild discarded scene transform',
  );
  $('ssModelFov').value = 60;
  $('ssModelFov').dispatchEvent(new Event('input'));
  $('ssModelLight').value = 'warm';
  $('ssModelLight').dispatchEvent(new Event('input'));
  const count = $('ssModelObject').options.length;
  await input('ssModelImageInput', [new File([image], 'backdrop.png', { type: 'image/png' })]);
  await wait(() => $('ssModelObject').options.length === count + 1, 'PNG backdrop not added');
  change('ssModelx', 0.2);
  $('ssModelSave').click();
  await wait(() => saves.some((s) => s.name === 'ditasha-scene.json'), 'Scene project save failed');
  const sceneSave = saves.find((s) => s.name === 'ditasha-scene.json'),
    sceneProject = JSON.parse(new TextDecoder().decode(sceneSave.data));
  assert(
    sceneProject.props.length === 1 &&
      sceneProject.camera.fov === 60 &&
      sceneProject.lighting.preset === 'warm',
    'Scene project lost backdrop/camera/lighting',
  );
  assert(sceneProject.objects[0].transform.sy === 2, 'Scene lost independent scale axes');
  window.confirm = () => true;
  change('ssModelx', 0.9);
  await input('ssModelProjectInput', [new File([sceneSave.data], 'scene.json')]);
  await wait(() => $('ssModelStatus').textContent === 'Scene dimuat.', 'Scene reload failed');
  const backdrop = [...$('ssModelObject').options].find((o) => o.value.startsWith('backdrop:'));
  $('ssModelObject').value = backdrop.value;
  $('ssModelObject').dispatchEvent(new Event('change'));
  assert(Number($('ssModelx').value) === 0.2, 'Backdrop position was not restored');
  console.log('DITASHA_SNAPSHOT:manual-scene-studio');
  await new Promise((r) => setTimeout(r, 250));
  return {
    blendPixels: true,
    maskUndo: true,
    canvasRoundTrip: true,
    alignment: true,
    gizmoControls: true,
    sceneUndo: true,
    sceneRoundTrip: true,
    backdrop: true,
  };
};
