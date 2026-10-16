module.exports = async function checkDebadge({ vehicle }) {
  const $ = (id) => document.getElementById(id),
    assert = (v, m) => {
      if (!v) throw Error(m);
    },
    sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const wait = async (fn, message) => {
    const end = Date.now() + 20000;
    while (Date.now() < end) {
      if (fn()) return;
      await sleep(50);
    }
    throw Error(message + ' · ' + $('dbStatus').textContent);
  };
  const saves = [];
  let cancel = true;
  window.ditashaDesktop = {
    saveExport: async (p) => {
      saves.push(p);
      return { saved: !cancel };
    },
  };
  const calls = [];
  window.ditashaNative = {
    start: async (p) => {
      calls.push(p);
      throw Error('Debadge must not call Blender.');
    },
  };
  document.querySelector('[data-page=vehicles]').click();
  $('vehicleDebadge').click();
  assert(
    !$('debadgeWorkspace').hidden &&
      document.querySelector('.vehicle-native-host').contains($('debadgeWorkspace')),
    'Debadge is not inline',
  );
  const dt = new DataTransfer();
  dt.items.add(new File([Uint8Array.from(vehicle)], 'testvehicle.yft'));
  $('dbViewport').dispatchEvent(
    new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }),
  );
  await wait(
    () => $('dbParts').children.length === 2 && !$('dbOpen').disabled,
    'Vehicle preview did not load connected parts',
  );
  const rows = [...$('dbParts').children];
  rows.at(-1).querySelector('button').click();
  await sleep(150);
  const canvas = $('dbViewport').querySelector('canvas'),
    r = canvas.getBoundingClientRect();
  assert(r.width > 150 && r.height > 100, 'Debadge viewport collapsed');
  for (const type of ['pointerdown', 'pointerup'])
    canvas.dispatchEvent(
      new PointerEvent(type, {
        bubbles: true,
        clientX: r.x + r.width * 0.48,
        clientY: r.y + r.height * 0.52,
        button: 0,
        pointerId: 5,
      }),
    );
  assert($('dbCount').textContent === '1', 'Real raycast did not select an unnamed badge');
  assert(
    $('dbSelection').textContent.includes('1 triangles'),
    'Click selected the body instead of the separate badge',
  );
  $('dbHide').checked = true;
  $('dbHide').dispatchEvent(new Event('change'));
  $('dbUndo').click();
  assert($('dbCount').textContent === '0', 'Selection undo failed');
  $('dbRedo').click();
  assert($('dbCount').textContent === '1', 'Selection redo failed');
  $('dbExport').click();
  await wait(() => !$('dbExport').disabled && saves.length, 'YFT export did not complete');
  assert(
    window.ditashaWorkspace.unsavedItems().some((x) => x.name.includes('debadge')),
    'Canceled export lost dirty selection',
  );
  cancel = false;
  $('dbExport').click();
  await wait(() => !$('dbExport').disabled && saves.length === 2, 'YFT save did not finish');
  assert(
    !window.ditashaWorkspace.unsavedItems().some((x) => x.name.includes('Visual debadge')),
    'Successful save remains dirty',
  );
  assert(!calls.length, 'Visual debadge still calls Sollumz');
  const saved = saves.at(-1);
  assert(saved.name === 'testvehicle.yft', 'Native export lost the original filename');
  assert([...saved.data.slice(0, 4)].join(',') === '82,83,67,55', 'Export is not RSC7');
  $('dbHide').checked = false;
  $('dbHide').dispatchEvent(new Event('change'));
  $('dbFit').click();
  await sleep(150);
  console.log('DITASHA_SNAPSHOT:direct-debadge');
  // Bad input must preserve the existing vehicle and selection.
  const bad = new DataTransfer();
  bad.items.add(new File(['invalid'], 'broken.yft'));
  $('dbInput').files = bad.files;
  $('dbInput').dispatchEvent(new Event('change'));
  await wait(() => !$('dbOpen').disabled, 'Invalid import did not settle');
  assert(
    $('dbFiles').textContent.includes('testvehicle.yft'),
    'Bad import replaced the current vehicle',
  );
  $('dbBack').click();
  assert($('debadgeWorkspace').hidden, 'Back did not restore workshop');
  return {
    raycast: true,
    connectedPart: true,
    preview: true,
    undoRedo: true,
    cancelGuard: true,
    nativeExport: true,
    noBlender: true,
    data: [...saved.data],
  };
};
