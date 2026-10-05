module.exports = async function checkArchives(fixtures) {
  const $ = (id) => document.getElementById(id),
    assert = (ok, message) => {
      if (!ok) throw Error(message);
    },
    sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const wait = async (test, message) => {
    const until = Date.now() + 15000;
    while (Date.now() < until) {
      if (test()) return;
      await sleep(25);
    }
    throw Error(message + ' · ' + $('archiveStatus')?.textContent);
  };
  let cancel = false;
  const saves = [];
  window.ditashaDesktop.saveExport = async ({ name, data }) => {
    saves.push({ name, data: [...data] });
    return { saved: !cancel };
  };
  async function input(id, files) {
    const transfer = new DataTransfer();
    files.forEach((f) => transfer.items.add(f));
    $(id).files = transfer.files;
    $(id).dispatchEvent(new Event('change'));
    await wait(() => !$('archiveOpen').disabled, 'Archive operation did not finish');
  }
  const dirty = () =>
    window.ditashaWorkspace.unsavedItems().some((e) => e.name.startsWith('Archive ·'));
  const select = (name) => {
    const b = [...$('archiveEntries').querySelectorAll('button')].find(
      (b) => b.textContent === name,
    );
    assert(b, 'Missing archive entry: ' + name);
    b.click();
  };
  document.querySelector('[data-page="archives"]').click();
  await input('archiveInput', [new File([new Uint8Array(fixtures.rpf)], 'fixture.rpf')]);
  assert($('archiveKind').textContent === 'RPF7', 'RPF did not open');
  assert($('archiveEntries').children.length === 3, 'Archive files missing');
  console.log('DITASHA_SNAPSHOT:archive-rpf');
  select('textures/test.ytd');
  $('archiveExtract').click();
  await wait(() => !$('archiveOpen').disabled, 'Extraction did not finish');
  assert(
    saves.at(-1).name === 'test.ytd' && saves.at(-1).data.slice(0, 4).join(',') === '82,83,67,55',
    'Resource extraction lost RSC7 header',
  );
  await input('archiveReplacement', [new File([new Uint8Array(fixtures.ytd)], 'replacement.ytd')]);
  assert(dirty(), 'Replacement not marked unsaved');
  select('nested.rpf');
  $('archiveNested').click();
  await wait(() => !$('archiveOpen').disabled, 'Nested archive did not open');
  assert(
    $('archiveTitle').textContent === 'nested.rpf' && dirty(),
    'Parent edits lost on nested navigation',
  );
  $('archiveBack').click();
  await wait(() => !$('archiveOpen').disabled, 'Parent did not restore');
  assert(
    $('archiveTitle').textContent === 'fixture.rpf' && dirty(),
    'Parent unsaved state not restored',
  );
  cancel = true;
  $('archiveExport').click();
  await wait(() => !$('archiveOpen').disabled, 'Canceled archive export did not finish');
  assert(dirty(), 'Canceled export cleared unsaved changes');
  cancel = false;
  $('archiveExport').click();
  await wait(() => !$('archiveOpen').disabled, 'Archive export did not finish');
  assert(!dirty() && saves.at(-1).name === 'fixture-edited.rpf', 'Saved archive remains unsaved');
  await input('archiveAddInput', [new File(['new contents'], 'added.txt')]);
  assert(dirty() && $('archiveEntries').children.length === 4, 'Add file failed');
  select('added.txt');
  $('archiveRemove').click();
  await wait(() => !$('archiveOpen').disabled, 'Remove did not finish');
  assert($('archiveEntries').children.length === 3, 'Remove file failed');
  const transfer = new DataTransfer();
  transfer.items.add(new File([new Uint8Array(fixtures.oiv)], 'mod.oiv'));
  $('archiveInput').files = transfer.files;
  $('archiveInput').dispatchEvent(new Event('change'));
  await wait(() => $('unsavedDialog').open, 'Archive replacement bypassed unsaved prompt');
  $('unsavedBack').click();
  await wait(() => !$('archiveOpen').disabled, 'Archive cancel did not finish');
  assert($('archiveTitle').textContent === 'fixture.rpf', 'Canceled archive switch lost workspace');
  $('archiveExport').click();
  await wait(() => !$('archiveOpen').disabled, 'Second RPF export did not finish');
  await input('archiveInput', [new File([new Uint8Array(fixtures.oiv)], 'mod.oiv')]);
  assert(
    $('archiveKind').textContent === 'OIV' &&
      !$('archivePackage').hidden &&
      $('archiveMetadata').textContent.includes('Test package'),
    'OIV manifest metadata missing',
  );
  assert(
    $('archiveManifest').textContent.includes('content/test.ytd'),
    'OIV installation instructions missing',
  );
  console.log('DITASHA_SNAPSHOT:archive-oiv');
  $('archiveExtractAll').click();
  await wait(() => !$('archiveOpen').disabled, 'Extract all failed');
  assert(saves.at(-1).name === 'mod-extracted.zip', 'Extract all export missing');
  select('content/test.ytd');
  $('archivePreview').click();
  await wait(() => !document.querySelector('main').hidden, 'Asset did not open editor');
  assert(document.querySelector('main .right'), 'Viewer not restored after archive preview');
  document.querySelector('[data-page="archives"]').click();
  await input('archiveInput', [new File(['invalid'], 'bad.rpf')]);
  assert($('archiveTitle').textContent === 'mod.oiv', 'Invalid archive replaced valid workspace');
  return {
    saves,
    checks:
      'RPF and OIV browsing, RSC7 extraction, replacement, nested parent unsaved state, canceled and successful save, add/remove, unsaved switch guard, OIV manifest, extract all and editor preview',
  };
};
