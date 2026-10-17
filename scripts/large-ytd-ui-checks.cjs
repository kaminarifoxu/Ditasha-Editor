module.exports = async function checkLargeYtd(bytes) {
  const $ = (id) => document.getElementById(id);
  const assert = (value, message) => {
    if (!value) throw Error(message);
  };
  const wait = async (test, message) => {
    const end = Date.now() + 45000;
    while (Date.now() < end) {
      if (test()) return;
      await new Promise((r) => setTimeout(r, 50));
    }
    throw Error(message);
  };
  let saved;
  window.ditashaDesktop = {
    saveExport: async ({ data }) => {
      saved = [...data];
      return { saved: true };
    },
  };
  document.querySelector('[data-page="editor"]').click();
  const transfer = new DataTransfer();
  transfer.items.add(new File([new Uint8Array(bytes)], 'large-vehicle.ytd'));
  $('fileInput').files = transfer.files;
  $('fileInput').dispatchEvent(new Event('change'));
  await wait(
    () => $('fileLoading').hidden && $('material').options.length === 3,
    '192 MB YTD failed to open',
  );
  await wait(
    () =>
      [...document.querySelectorAll('.texcard img')].every(
        (im) => im.complete && im.naturalWidth > 0,
      ),
    'Missing large YTD thumbnails',
  );
  assert(
    [...document.querySelectorAll('.texcard img')].every((im) => im.naturalWidth <= 96),
    'Thumbnails allocated full texture-sized images',
  );
  assert($('textureCanvas').width === 4096, 'Editor downscaled the source texture');
  $('material').value = '2';
  $('material').dispatchEvent(new Event('change'));
  assert($('textureTitle').textContent === 'vehicle_diff_2', 'Large texture switching failed');
  $('mirrorX').click();
  $('ytdExport').click();
  await wait(() => saved, 'Large YTD export failed');
  console.log('DITASHA_SNAPSHOT:large-ytd-editor');
  return {
    decodedMB: 192,
    sourceResolution: 4096,
    boundedThumbnails: true,
    switchAndEdit: true,
    data: saved,
  };
};
