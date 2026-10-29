'use strict';
module.exports = async function checkBoothVehicles(fixtures) {
  const $ = (id) => document.getElementById(id),
    pause = (ms) => new Promise((r) => setTimeout(r, ms));
  async function ready(n) {
    const end = Date.now() + 15000;
    while ($('pbPed').disabled || $('pbActor').options.length !== n) {
      if (Date.now() > end) throw Error('Vehicle pack timeout: ' + $('pbStatus').textContent);
      await pause(40);
    }
  }
  $('pbClear').click();
  const cols =
      '<CVehicleModelInfoVarGlobal><Kits><Item><kitName>bike_kit</kitName><visibleMods><Item><modelName>bike_seat_a</modelName><bone>chassis</bone><type>VMT_CHASSIS</type><turnOffBones><Item>seat</Item></turnOffBones></Item></visibleMods></Item></Kits></CVehicleModelInfoVarGlobal>',
    vars =
      '<CVehicleModelInfoVariation><variationData><Item><modelName>bike</modelName><kits><Item>bike_kit</Item></kits></Item></variationData></CVehicleModelInfoVariation>';
  const dt = new DataTransfer();
  for (const [name, bytes] of [
    ['bike.yft', fixtures.yft],
    ['bike_hi.yft', fixtures.yft],
    ['bike_seat_a.yft', fixtures.yft],
    ['bike.ytd', fixtures.ytd],
    ['carcols.meta', cols],
    ['carvariations.meta', vars],
  ])
    dt.items.add(new File([typeof bytes === 'string' ? bytes : new Uint8Array(bytes)], name));
  $('pbVehicleFolderInput').files = dt.files;
  $('pbVehicleFolderInput').dispatchEvent(new Event('change'));
  await ready(1);
  const cards = () => [...$('pbAssets').querySelectorAll('[data-asset-card]')],
    card = (name) => cards().find((c) => c.querySelector('summary strong').textContent === name),
    visible = (name) => card(name).querySelector('input[type=checkbox]');
  if (cards().length !== 3 || $('pbAssets').querySelectorAll('[data-actor-group]').length !== 1)
    throw Error('Multi YFT resource was split into independent cars');
  if (visible('bike_hi.yft').checked || !visible('bike_seat_a.yft').checked)
    throw Error('HI/mod default visibility incorrect');
  const pixels = () => document.querySelector('#pbViewport canvas').toDataURL();
  $('pbPositionX').value = '200';
  const before = pixels();
  $('pbPositionX').dispatchEvent(new Event('change'));
  if (pixels() === before) throw Error('Vehicle group movement failed');
  visible('bike_hi.yft').checked = true;
  visible('bike_hi.yft').dispatchEvent(new Event('change'));
  if (visible('bike.yft').checked) throw Error('HI overlaps base vehicle');
  visible('bike.yft').checked = true;
  visible('bike.yft').dispatchEvent(new Event('change'));
  if (visible('bike_hi.yft').checked) throw Error('Base overlaps HI alternative');
  $('pbLibraryName').value = 'QA vehicle resource';
  $('pbLibrarySave').click();
  while ($('pbLibrarySave').disabled) await pause(40);
  const row = [...$('pbLibraryList').querySelectorAll('article')].find((n) =>
      n.textContent.includes('QA vehicle resource'),
    ),
    id = row.querySelector('[data-library-load]').dataset.libraryLoad;
  $('pbClear').click();
  document.querySelector('[data-library-load="' + id + '"]').click();
  await ready(1);
  if (cards().length !== 3 || visible('bike_hi.yft').checked || !visible('bike_seat_a.yft').checked)
    throw Error('Vehicle part preset lost hierarchy/visibility');
  return {
    vehicleResourceFolder: true,
    vehiclePartGrouping: true,
    vehicleHiExclusive: true,
    vehiclePartsMoveTogether: true,
    vehiclePackPreset: true,
  };
};
