module.exports = async function checkFileManager() {
  const $ = (id) => document.getElementById(id);
  const assert = (condition, message) => {
    if (!condition) throw Error(message);
  };
  async function wait(check, message) {
    const end = Date.now() + 20000;
    while (Date.now() < end) {
      if (check()) return;
      await new Promise((resolve) => setTimeout(resolve, 40));
    }
    throw Error(message + ': ' + $('fmStatus').textContent);
  }
  document.querySelector('[data-page=files]').click();
  assert(
    document.body.dataset.workspace === 'files' && !document.querySelector('.file-manager').hidden,
    'File Manager navigation failed',
  );
  $('fmChoose').click();
  await wait(
    () => !$('fmChoose').disabled && $('fmList').querySelectorAll('[data-file-id]').length === 6,
    'Real folder scan failed',
  );
  assert($('fmRoot').textContent.includes('source'), 'Source path missing');
  assert($('fmPage').textContent.includes('6'), 'File count missing');
  const image = [...$('fmList').querySelectorAll('button')].find((row) =>
    row.textContent.includes('logo.png'),
  );
  image.click();
  await wait(
    () => $('fmImage').querySelector('img')?.naturalWidth === 1,
    'Local PNG preview failed',
  );
  assert(
    $('fmDetails').textContent.includes('Gambar/PNG'),
    'Destination missing from file details',
  );
  $('fmOpen').click();
  await wait(
    () =>
      document.body.dataset.workspace === 'editor' &&
      $('textureTitle').textContent.includes('logo'),
    'PNG did not open in editor',
  );
  document.querySelector('[data-page=files]').click();
  $('fmCategory').value = 'images';
  $('fmCategory').dispatchEvent(new Event('change'));
  await wait(
    () => !$('fmChoose').disabled && $('fmList').querySelectorAll('[data-file-id]').length === 2,
    'Image filter failed',
  );
  $('fmPlan').click();
  await wait(() => !$('fmPlanPanel').hidden && !$('fmCopy').disabled, 'Sorting plan failed');
  assert($('fmPlanTitle').textContent.includes('2 file'), 'Plan ignores active filter');
  assert(
    $('fmPlanEntries').textContent.includes('Gambar/PNG'),
    'Planned image destinations missing',
  );
  $('fmCopy').click();
  await wait(
    () => !$('fmShowOutput').hidden && !$('fmChoose').disabled,
    'Actual copy from UI failed',
  );
  assert(
    $('fmStatus').textContent.includes('2 tersalin') &&
      $('fmStatus').textContent.includes('0 gagal'),
    'Copy result missing',
  );
  $('fmCategory').value = '';
  $('fmCategory').dispatchEvent(new Event('change'));
  await wait(
    () => !$('fmChoose').disabled && $('fmList').querySelectorAll('[data-file-id]').length === 6,
    'Category reset failed',
  );
  $('fmSearch').value = 'buffalo';
  $('fmSearch').dispatchEvent(new Event('input'));
  await wait(
    () => !$('fmChoose').disabled && $('fmList').querySelectorAll('[data-file-id]').length === 2,
    'Recursive search failed',
  );
  $('fmSearch').value = '';
  $('fmSearch').dispatchEvent(new Event('input'));
  await wait(
    () => !$('fmChoose').disabled && $('fmList').querySelectorAll('[data-file-id]').length === 6,
    'Search reset failed',
  );
  $('fmRecursive').checked = false;
  $('fmRecursive').dispatchEvent(new Event('change'));
  await wait(
    () => !$('fmChoose').disabled && $('fmList').querySelector('.fm-directory'),
    'Directory navigation unavailable',
  );
  const folder = [...$('fmList').querySelectorAll('.fm-directory')].find(
    (row) => row.textContent === 'images',
  );
  folder.click();
  await wait(
    () => !$('fmChoose').disabled && $('fmBreadcrumb').textContent.endsWith('/ images'),
    'Directory open failed',
  );
  $('fmUp').click();
  await wait(() => !$('fmChoose').disabled && $('fmUp').disabled, 'Parent navigation failed');
  $('fmRecursive').checked = true;
  $('fmRecursive').dispatchEvent(new Event('change'));
  await wait(
    () => !$('fmChoose').disabled && $('fmList').querySelectorAll('[data-file-id]').length === 6,
    'Recursive restore failed',
  );
  $('fmPlan').click();
  await wait(() => !$('fmPlanPanel').hidden && !$('fmCopy').disabled, 'Full sorting plan missing');
  assert($('fmPlanTitle').textContent.includes('6 file'), 'Full plan incomplete');
  assert(
    $('fmPlanEntries').textContent.includes('Pakaian/Female') &&
      $('fmPlanEntries').textContent.includes('Kendaraan/buffalo'),
    'GTA classification not reflected in UI',
  );
  $('fmPlanClose').click();
  await wait(() => $('fmPlanPanel').hidden, 'Sorting plan did not close');
  $('fmOrder').value = 'name';
  $('fmOrder').dispatchEvent(new Event('change'));
  await wait(() => !$('fmChoose').disabled, 'Name sort failed');
  const firstName = $('fmList').querySelector('[data-file-id]').textContent;
  $('fmDescending').click();
  await wait(() => !$('fmChoose').disabled, 'Descending sort failed');
  assert(
    $('fmList').querySelector('[data-file-id]').textContent !== firstName,
    'Ordering did not change',
  );
  $('fmGridView').click();
  await wait(
    () => !$('fmChoose').disabled && $('fmList').classList.contains('fm-grid'),
    'Grid mode failed',
  );
  await wait(
    () => $('fmList').querySelectorAll('.fm-thumbnail').length === 2,
    'PNG grid thumbnails failed',
  );
  assert($('fmTree').querySelectorAll('button').length >= 4, 'Folder tree missing');
  $('fmNewTab').click();
  await wait(
    () => !$('fmChoose').disabled && $('fmTabs').querySelectorAll('[role=tab]').length === 2,
    'Folder tabs failed',
  );
  $('fmCategory').value = 'vehicles';
  $('fmCategory').dispatchEvent(new Event('change'));
  await wait(
    () => !$('fmChoose').disabled && $('fmList').querySelectorAll('[data-file-id]').length === 2,
    'New tab filter failed',
  );
  $('fmTabs').querySelector('[role=tab]').click();
  await wait(
    () => !$('fmChoose').disabled && $('fmList').querySelectorAll('[data-file-id]').length === 6,
    'Tab state was not restored',
  );
  assert($('fmCategory').value === '', 'Tab lost its category');
  $('fmListView').click();
  await wait(() => !$('fmChoose').disabled, 'List restore failed');
  $('fmNative').click();
  await wait(
    () => !$('fmChoose').disabled && $('fmStatus').textContent.includes('dibuka di aplikasi Files'),
    'Native Files connection failed',
  );
  const box = document.querySelector('.file-manager').getBoundingClientRect();
  const nav = document.querySelector('.workspace-nav').getBoundingClientRect();
  assert(
    box.width > 500 && box.left >= nav.right - 1 && box.bottom <= innerHeight + 2,
    'File Manager does not fit the workspace: ' +
      JSON.stringify({
        left: box.left,
        width: box.width,
        bottom: box.bottom,
        height: innerHeight,
        navRight: nav.right,
      }),
  );
  assert(
    document.querySelector('.file-manager').scrollWidth <= box.width + 1,
    'File Manager overflows horizontally',
  );
  return {
    pngPreview: true,
    editorOpen: true,
    realNativeCopy: true,
    filters: true,
    navigation: true,
    gtaPlan: true,
    nativeFilesProtocol: true,
    tabs: true,
    gridThumbnails: true,
    ordering: true,
  };
};
