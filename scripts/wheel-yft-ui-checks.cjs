module.exports = async function checkWheelYft(bytes) {
  const $ = (id) => document.getElementById(id);
  const assert = (value, message) => {
    if (!value) throw Error(message);
  };
  const wait = async (test, message) => {
    const end = Date.now() + 20000;
    while (Date.now() < end) {
      if (test()) return;
      await new Promise((r) => setTimeout(r, 50));
    }
    throw Error(message);
  };
  const upload = (id) => {
    const transfer = new DataTransfer();
    transfer.items.add(new File([new Uint8Array(bytes)], 'six-wheel.yft'));
    $(id).files = transfer.files;
    $(id).dispatchEvent(new Event('change'));
  };
  document.querySelector('[data-page="modelviewer"]').click();
  upload('mvInput');
  await wait(
    () => !$('mvOpen').disabled && $('mvParts').querySelectorAll('.mesh-parts').length === 14,
    'Complete vehicle omitted wheel instances',
  );
  assert(
    $('mvDrawable').options[0].textContent === 'Vehicle · lengkap',
    'Complete vehicle is not the default choice',
  );
  assert($('mvDrawable').options.length === 8, 'Individual pristine/damaged choices were lost');
  console.log('DITASHA_SNAPSHOT:six-wheel-model-viewer');
  await new Promise((r) => setTimeout(r, 200));
  $('mvPhotoshoot').click();
  assert($('photoshootDialog').open, 'Assembled vehicle did not open in Photoshoot');
  console.log('DITASHA_SNAPSHOT:six-wheel-photoshoot');
  await new Promise((r) => setTimeout(r, 200));
  $('psClose').click();
  document.querySelector('[data-page="editor"]').click();
  upload('fileInput');
  await wait(
    () => $('fileLoading').hidden && /14 segitiga/.test($('modelStats').textContent),
    'Texture & Model preview omitted wheel geometry',
  );
  console.log('DITASHA_SNAPSHOT:six-wheel-editor');
  await new Promise((r) => setTimeout(r, 200));
  return {
    sixWheels: true,
    sharedDonors: true,
    defaultCompleteVehicle: true,
    fragmentChoices: 8,
    editor: true,
    photoshoot: true,
  };
};
