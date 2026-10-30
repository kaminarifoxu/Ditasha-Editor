module.exports = async function checkLogoProp(png) {
  const $ = (id) => document.getElementById(id),
    pause = (ms) => new Promise((r) => setTimeout(r, ms));
  async function wait(test, message) {
    const end = Date.now() + 20000;
    while (!test()) {
      if (Date.now() > end) throw Error(message + ': ' + $('lpStatus')?.textContent);
      await pause(40);
    }
  }
  const saves = [];
  window.ditashaDesktop = {
    ...window.ditashaDesktop,
    saveExport: async ({ name, data }) => {
      saves.push({ name, size: data.length, header: [...data.slice(0, 4)] });
      return { saved: true };
    },
  };
  document.querySelector('[data-page=logoprop]').click();
  const upload = (file) => {
    const dt = new DataTransfer();
    dt.items.add(file);
    $('lpInput').files = dt.files;
    $('lpInput').dispatchEvent(new Event('change'));
  };
  upload(new File([new Uint8Array(png)], 'logo-with-hole.png', { type: 'image/png' }));
  await wait(
    () => !$('lpGlb').disabled && $('lpStats').textContent.includes('1 lubang'),
    'Logo import',
  );
  const canvas = document.querySelector('#lpViewport canvas');
  if (!canvas || canvas.width < 100) throw Error('No 3D preview');
  $('lpDepth').value = '12';
  $('lpDepth').dispatchEvent(new Event('input'));
  await wait(
    () => $('lpStats').textContent.includes('0.120 m') && !$('lpGlb').disabled,
    'Depth update',
  );
  $('lpGlb').click();
  await wait(() => saves.some((s) => s.name.endsWith('.glb')), 'GLB export');
  if (saves.find((s) => s.name.endsWith('.glb')).header.join(',') !== '103,108,84,70')
    throw Error('Invalid GLB');
  $('lpMode').value = 'board';
  $('lpMode').dispatchEvent(new Event('input'));
  await wait(
    () => $('lpStats').textContent.includes('12 segitiga') && !$('lpGlb').disabled,
    'Board mode',
  );
  const source = document.createElement('canvas');
  source.width = source.height = 32;
  const ctx = source.getContext('2d');
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, 32, 32);
  ctx.fillStyle = 'black';
  ctx.fillRect(6, 6, 20, 20);
  ctx.fillStyle = 'white';
  ctx.fillRect(12, 12, 8, 8);
  const blob = await new Promise((r) => source.toBlob(r));
  upload(new File([blob], 'flat-background.png', { type: 'image/png' }));
  await wait(() => $('unsavedDialog').open, 'Replace logo confirmation');
  $('unsavedDiscard').click();
  await wait(
    () => $('lpImageInfo').textContent.includes('flat-background') && !$('lpGlb').disabled,
    'Background image',
  );
  $('lpMode').value = 'logo';
  $('lpBgColor').value = '#ffffff';
  $('lpBackground').value = 'edge';
  $('lpBackground').dispatchEvent(new Event('input'));
  await wait(
    () =>
      !$('lpGlb').disabled && $('lpImage').getContext('2d').getImageData(0, 0, 1, 1).data[3] === 0,
    'Edge background',
  );
  if ($('lpImage').getContext('2d').getImageData(16, 16, 1, 1).data[3] !== 255)
    throw Error('Edge removal damaged enclosed image');
  $('lpBackground').value = 'color';
  $('lpBackground').dispatchEvent(new Event('input'));
  await wait(
    () =>
      !$('lpGlb').disabled &&
      $('lpImage').getContext('2d').getImageData(16, 16, 1, 1).data[3] === 0,
    'All-color background',
  );
  $('lpPng').click();
  await wait(() => saves.some((s) => s.name.endsWith('.png')), 'PNG export');
  let captured;
  window.ditashaNative = {
    state: async () => ({
      engine: 'blender.exe',
      running: false,
      status: 'success',
      message: 'Native output ready',
      report: { mode: 'logo' },
      output: 'test',
    }),
    pick: async () => ({ id: 'chosen-output' }),
    start: async (value) => {
      captured = value;
    },
    reveal: async () => {},
  };
  $('lpNative').click();
  await wait(() => !!captured, 'Native payload');
  document.querySelector('[data-page=home]').click();
  document.querySelector('[data-page=logoprop]').click();
  if ($('lpStats').textContent.includes('0 segitiga')) throw Error('Workspace lost geometry');
  const viewport = $('lpViewport').getBoundingClientRect();
  if (viewport.width < 200 || viewport.height < 300) throw Error('Preview collapsed');
  return {
    nativePayload: captured,
    report: {
      pngImport: true,
      realHole: true,
      extrusionDepth: true,
      board: true,
      edgeAndColorRemoval: true,
      glbExport: true,
      pngExport: true,
      workspacePersistence: true,
      saves,
    },
  };
};
