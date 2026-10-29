'use strict';
module.exports = async function checkBoothTextureSwap(fixtures) {
  const $ = (id) => document.getElementById(id),
    pause = (ms) => new Promise((r) => setTimeout(r, ms));
  async function ready(test, msg) {
    const end = Date.now() + 15000;
    while ($('pbPed').disabled || !test()) {
      if (Date.now() > end) throw Error(msg + ': ' + $('pbStatus').textContent);
      await pause(40);
    }
  }
  function upload(id, files) {
    const dt = new DataTransfer();
    for (const [name, bytes] of files) dt.items.add(new File([new Uint8Array(bytes)], name));
    $(id).files = dt.files;
    $(id).dispatchEvent(new Event('change'));
  }
  const cards = () => [...$('pbAssets').querySelectorAll('[data-asset-card]')],
    card = (name) => cards().find((c) => c.querySelector('summary strong').textContent === name),
    image = () => document.querySelector('#pbViewport canvas').toDataURL();
  $('pbClear').click();
  $('pbPed').click();
  upload('pbInput', [
    ['ped-a.ydd', fixtures.native],
    ['ped-b.ydd', fixtures.native],
  ]);
  await ready(() => $('pbActor').options.length === 2, 'Two ped swap fixture');
  const firstActor = $('pbActor').value;
  card('ped-b.ydd').querySelector('[data-replace-ytd]').click();
  upload('pbReplaceYtdInput', [['red.ytd', fixtures.red]]);
  await ready(
    () => card('ped-b.ydd').querySelector('[data-ytd-source]')?.textContent.includes('red.ytd'),
    'First targeted replacement',
  );
  if ($('pbActor').value !== firstActor || card('ped-a.ydd').querySelector('[data-ytd-source]'))
    throw Error('Replacement changed another ped target');
  const override = () => card('ped-b.ydd').querySelector('[data-preview-texture]');
  override().selectedIndex = 1;
  override().dispatchEvent(new Event('change'));
  const red = image();
  document.querySelectorAll('[data-replace-ped-ytd]')[1].click();
  upload('pbReplaceYtdInput', [['blue.ytd', fixtures.blue]]);
  await ready(
    () => card('ped-b.ydd').querySelector('[data-ytd-source]')?.textContent.includes('blue.ytd'),
    'Second replacement',
  );
  if (card('ped-b.ydd').querySelector('[data-ytd-source]').textContent.includes('red.ytd'))
    throw Error('Old YTD source retained');
  override().selectedIndex = 1;
  override().dispatchEvent(new Event('change'));
  if (image() === red) throw Error('Changed YTD did not update rendered pixels');
  const before = image();
  card('ped-b.ydd').querySelector('[data-replace-ytd]').click();
  upload('pbReplaceYtdInput', [['broken.ytd', [1, 2, 3]]]);
  await ready(
    () => $('pbStatus').textContent.includes('broken.ytd'),
    'Invalid replacement diagnosis',
  );
  if (
    image() !== before ||
    !card('ped-b.ydd').querySelector('[data-ytd-source]').textContent.includes('blue.ytd')
  )
    throw Error('Failed replacement discarded the working texture');
  $('pbLibraryName').value = 'QA targeted YTD';
  $('pbLibrarySave').click();
  await ready(() => true, 'Swap preset save');
  const row = [...$('pbLibraryList').querySelectorAll('article')].find((n) =>
      n.textContent.includes('QA targeted YTD'),
    ),
    id = row.querySelector('[data-library-load]').dataset.libraryLoad;
  $('pbClear').click();
  document.querySelector('[data-library-load="' + id + '"]').click();
  await ready(() => cards().length === 2, 'Swap preset restore');
  if (
    !card('ped-b.ydd').querySelector('[data-ytd-source]').textContent.includes('blue.ytd') ||
    card('ped-a.ydd').querySelector('[data-ytd-source]')
  )
    throw Error('Swap owner/source persistence lost');
  return {
    targetedPedYtdSwap: true,
    replacementChangesPixels: true,
    invalidYtdKeepsPrevious: true,
    ytdSwapPreset: true,
  };
};
