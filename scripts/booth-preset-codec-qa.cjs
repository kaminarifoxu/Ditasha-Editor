'use strict';
module.exports = async function checkBoothPresetCodecs(fixtures) {
  const $ = (id) => document.getElementById(id),
    pause = (ms) => new Promise((r) => setTimeout(r, ms));
  async function ready(fn, msg) {
    const end = Date.now() + 15000;
    while ($('pbPed').disabled || !fn()) {
      if (Date.now() > end) throw Error(msg + ': ' + $('pbStatus').textContent);
      await pause(40);
    }
  }
  const input = $('pbTextureInput'),
    dt = new DataTransfer();
  dt.items.add(new File([new Uint8Array(fixtures.mixed)], 'w_pi_combatpistol.ytd'));
  input.files = dt.files;
  input.dispatchEvent(new Event('change'));
  await ready(() => $('pbStatus').textContent.includes('broken_unused'), 'Mixed BC5 import');
  $('pbLibraryName').value = 'QA BC5 recoverable preset';
  $('pbLibrarySave').click();
  await ready(() => true, 'BC5 preset save');
  const row = [...$('pbLibraryList').querySelectorAll('article')].find((n) =>
      n.textContent.includes('QA BC5 recoverable preset'),
    ),
    id = row.querySelector('[data-library-load]').dataset.libraryLoad;
  $('pbClear').click();
  document.querySelector('[data-library-load="' + id + '"]').click();
  await ready(
    () => $('pbActor').options.length === 2 && $('pbStatus').textContent.includes('Preset dibuka'),
    'Recover BC5 preset',
  );
  if ($('pbIssues').hidden || !$('pbIssueList').textContent.includes('broken_unused'))
    throw Error('Partial texture warning was hidden');
  const options = [...$('pbAssets').querySelectorAll('[data-preview-texture] option')];
  if (!options.some((o) => o.textContent.includes('env_smooth_concrete2')))
    throw Error('BC5 map was discarded');
  if (!options.some((o) => o.textContent.includes('preview_repair')))
    throw Error('Other ped YTD was discarded');
  if ($('pbIssueList').textContent.includes('32495441')) throw Error('ATI2 remains unsupported');
  return {
    bc5PresetRestore: true,
    partialTexturePresetRestore: true,
    readableMapsRetained: true,
    presetWarningsVisible: true,
  };
};
