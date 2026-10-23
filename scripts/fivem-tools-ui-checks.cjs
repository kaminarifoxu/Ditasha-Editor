module.exports = async function checkFivemTools() {
  const $ = (id) => document.getElementById(id),
    assert = (v, m) => {
      if (!v) throw Error(m);
    },
    sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const wait = async (fn) => {
    for (let i = 0; i < 150; i++) {
      if (fn()) return;
      await sleep(30);
    }
    throw Error('FiveM tools timed out: ' + $('ymtStatus').textContent);
  };
  const saves = [];
  let cancel = false;
  window.ditashaDesktop = {
    saveExport: async (payload) => {
      if (cancel) return { saved: false };
      saves.push({ name: payload.name, data: [...payload.data] });
      return { saved: true };
    },
  };
  document.querySelector('[data-page=fivemtools]').click();
  const root = document.querySelector('.fivem-tools-workspace');
  assert(
    !root.hidden && $('workspaceLabel').textContent === 'YMT & FiveM Tools',
    'FiveM tools did not activate',
  );
  assert(
    root.getBoundingClientRect().left > 100 && root.getBoundingClientRect().width > 500,
    'Workspace overlaps navigation or is too narrow',
  );
  const add = (names) => {
    $('ymtNames').value = names.join('\n');
    $('ymtAddNames').click();
  };
  add([
    'jbib_000_u.ydd',
    'jbib_diff_000_a_uni.ytd',
    'female/p_head_000.ydd',
    'female/p_head_diff_000_a.ytd',
  ]);
  assert(
    !$('ymtSaveMetadata').disabled && $('ymtSaveResource').disabled,
    'Names-only metadata/resource gates are wrong',
  );
  const xml = new DOMParser().parseFromString($('ymtXml').value, 'text/xml');
  assert(
    !xml.querySelector('parsererror') && xml.documentElement.tagName === 'CPedVariationInfo',
    'Malformed YMT XML',
  );
  assert(
    xml.querySelector('availComp').textContent.split(' ').length === 12,
    'YMT must have 12 component indices',
  );
  assert(
    xml.querySelector('aTexData > Item > distribution').getAttribute('value') === '255',
    'YMT texture distribution missing',
  );
  const female = [...$('ymtDocument').options].find((o) =>
    o.textContent.endsWith('mp_f_freemode_01_ditasha_clothes.ymt.xml'),
  );
  assert(female, 'Female YMT was not generated');
  $('ymtDocument').value = female.value;
  $('ymtDocument').dispatchEvent(new Event('change'));
  const props = new DOMParser().parseFromString($('ymtXml').value, 'text/xml');
  assert(
    props.querySelector('aAnchors > Item > anchor').textContent === 'ANCHOR_HEAD',
    'Prop anchor does not match hat slot',
  );
  cancel = true;
  $('ymtSaveMetadata').click();
  await wait(() => !$('ymtSaveMetadata').disabled);
  assert($('ymtStatus').textContent.includes('dibatalkan'), 'Canceled save was shown as saved');
  cancel = false;
  $('ymtSaveMetadata').click();
  await wait(() => saves.length === 1);
  await wait(() => !$('ymtSaveMetadata').disabled);
  assert(
    saves[0].name.endsWith('-metadata-XML.zip') && saves[0].data[0] === 80,
    'Metadata ZIP missing',
  );
  add(['jbib_diff_000_c_uni.ytd']);
  assert($('ymtSaveMetadata').disabled, 'Texture gap was not blocked');
  $('ymtUndo').click();
  assert(!$('ymtSaveMetadata').disabled, 'Undo did not restore valid inputs');
  const rows = $('ymtRows').children.length;
  document.querySelector('[data-page=editor]').click();
  document.querySelector('[data-page=fivemtools]').click();
  assert($('ymtRows').children.length === rows, 'Switching workspace lost YMT inputs');
  $('ymtCollection').value = 'resource_test';
  $('ymtCollection').dispatchEvent(new Event('input'));
  // Undo the two additions to test actual file-byte export in the same session.
  $('ymtUndo').click();
  assert($('ymtRows').children.length === 0, 'Undo did not return to empty list');
  const dt = new DataTransfer();
  dt.items.add(new File([new Uint8Array([82, 83, 67, 55, 1])], 'jbib_000_u.ydd'));
  dt.items.add(new File([new Uint8Array([82, 83, 67, 55, 2])], 'jbib_diff_000_a_uni.ytd'));
  $('ymtFileInput').files = dt.files;
  $('ymtFileInput').dispatchEvent(new Event('change'));
  assert(!$('ymtSaveResource').disabled, 'Original files cannot export resource ZIP');
  $('ymtSaveResource').click();
  await wait(() => saves.length === 2);
  await wait(() => !$('ymtSaveResource').disabled);
  assert(saves[1].name === 'resource_test-resource-XML.zip', 'Wrong resource ZIP name');
  document.querySelector('[data-ft-tab=hash]').click();
  $('ftHashName').value = 'ADDER';
  $('ftHashName').dispatchEvent(new Event('input'));
  assert($('ftHashResults').textContent.includes('0xB779A091'), 'Wrong joaat output');
  document.querySelector('[data-ft-tab=manifest]').click();
  $('ftClient').value = "bad.lua'\n";
  $('ftClient').dispatchEvent(new Event('input'));
  assert($('ftSaveManifest').disabled, 'Unsafe manifest path was accepted');
  $('ftClient').value = 'client/*.lua';
  $('ftClient').dispatchEvent(new Event('input'));
  assert(!$('ftSaveManifest').disabled, 'Valid manifest glob rejected');
  $('ftSaveManifest').click();
  await wait(() => saves.length === 3);
  assert(saves[2].name === 'fxmanifest.lua', 'Manifest not saved');
  document.querySelector('[data-ft-tab=ymt]').click();
  assert(
    document.documentElement.scrollWidth <= innerWidth + 1,
    'FiveM tools causes horizontal window overflow',
  );
  return {
    saves,
    checks:
      'XML structure, components/props, missing texture gate, Undo, workspace persistence, canceled save, original-file ZIP, hash and manifest validation',
  };
};
