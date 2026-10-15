module.exports = async function checkExplorerPreview(fixtures) {
  const $ = (id) => document.getElementById(id);
  const assert = (ok, message) => {
    if (!ok) throw Error(message);
  };
  async function wait(test, message) {
    const deadline = Date.now() + 20000;
    while (Date.now() < deadline) {
      if (test()) return;
      await new Promise((r) => setTimeout(r, 25));
    }
    throw Error(message + ' · ' + $('archiveStatus').textContent);
  }
  const saves = [];
  document.querySelector('[data-page=editor]').click();
  await new Promise((r) => setTimeout(r, 100));
  const modeBar = document.querySelector('.documentbar');
  const modeRect = modeBar.getBoundingClientRect();
  assert(modeRect.width > 300 && modeRect.height > 0, 'Editor toolbar is not visible');
  const commandbar = document.querySelector('.editor-commandbar');
  const commandRect = commandbar.getBoundingClientRect();
  assert(
    commandbar.contains($('brush')) && commandbar.contains($('snapshot')),
    'Texture and model tools are not together',
  );
  assert($('eyedropper') && $('fillLayer') && $('centerLayer'), 'Photoshop-style tools missing');
  console.log('DITASHA_SNAPSHOT:editor-fixed-bar-2d');
  await new Promise((r) => setTimeout(r, 300));
  $('editTexture3d').click();
  await new Promise((r) => setTimeout(r, 60));
  assert(
    modeBar.parentElement === document.querySelector('main'),
    'Mode bar moved into a side panel',
  );
  assert(
    Math.abs(modeBar.getBoundingClientRect().top - modeRect.top) < 1,
    'Mode bar moved vertically in 3D mode',
  );
  assert(
    Math.abs(modeBar.getBoundingClientRect().left - modeRect.left) < 1,
    'Mode bar moved horizontally in 3D mode',
  );
  const afterTools = commandbar.getBoundingClientRect();
  assert(
    Math.abs(afterTools.top - commandRect.top) < 1 &&
      Math.abs(afterTools.left - commandRect.left) < 1,
    'Shared editor tools moved in 3D',
  );
  console.log('DITASHA_SNAPSHOT:editor-fixed-bar-3d');
  await new Promise((r) => setTimeout(r, 300));
  $('editTexture2d').click();
  // Real layer editing: color fill is undoable; sampling ignores the UV overlay.
  if ($('fillLayer') && document.getElementById('fileInput')) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 8;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#336699';
    ctx.fillRect(0, 0, 8, 8);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve));
    const transfer = new DataTransfer();
    transfer.items.add(new File([blob], 'toolbar-color.png', { type: 'image/png' }));
    $('fileInput').files = transfer.files;
    $('fileInput').dispatchEvent(new Event('change'));
    await wait(
      () => $('textureTitle').textContent.includes('toolbar-color'),
      'Tool fixture not loaded',
    );
    $('color').value = '#ff0000';
    $('fillLayer').click();
    $('undo').click();
    const target = $('canvasarea').querySelector('canvas');
    $('eyedropper').click();
    const r = target.getBoundingClientRect();
    target.dispatchEvent(
      new PointerEvent('pointerdown', {
        clientX: r.x + r.width / 2,
        clientY: r.y + r.height / 2,
        button: 0,
        bubbles: true,
      }),
    );
    assert(
      $('color').value === '#336699',
      'Eyedropper or undoable fill changed the original color',
    );
    $('move').click();
  }
  window.ditashaDesktop ||= {};
  window.ditashaDesktop.saveExport = async ({ name, data }) => {
    saves.push({ name, data: [...data] });
    return { saved: true };
  };
  const select = (name) => {
    const button = [...$('archiveEntries').querySelectorAll('button')].find(
      (b) => b.textContent === name,
    );
    assert(button, 'Missing file ' + name);
    button.click();
  };
  async function input(id, files) {
    const dt = new DataTransfer();
    files.forEach((f) => dt.items.add(f));
    $(id).files = dt.files;
    $(id).dispatchEvent(new Event('change'));
    await wait(() => !$('archiveOpen').disabled, 'Archive operation stuck');
  }
  document.querySelector('[data-page=archives]').click();
  await input('archiveInput', [new File([new Uint8Array(fixtures.archive)], 'inline.rpf')]);
  select('car.ydd');
  await wait(
    () => !$('archiveOpen').disabled && $('mvTitle').textContent.includes('car'),
    'Single-click inline model did not load',
  );
  assert(
    $('workspaceLabel').textContent === 'GTA V Explorer',
    'Preview navigated away from Explorer',
  );
  assert(
    !document.querySelector('.archive-workspace').hidden &&
      !document.querySelector('.explorer-preview').hidden,
    'Explorer or preview hidden',
  );
  assert(
    document.querySelector('.explorer-preview-host').contains($('mvViewport')),
    '3D viewport is not inline',
  );
  assert($('archiveEntries').children.length === 4, 'Preview removed the file browser');
  const rect = $('mvViewport').getBoundingClientRect();
  assert(rect.width > 100 && rect.height > 100, 'Inline viewport too small');
  assert(
    [...$('archivePreviewTextures').options].some((o) => o.value === 'alternate.ytd'),
    'Manual YTD pairing missing',
  );
  const fileRect = document.querySelector('.archive-center').getBoundingClientRect();
  const previewRect = document.querySelector('.explorer-preview').getBoundingClientRect();
  assert(
    previewRect.left >= fileRect.right - 1 && Math.abs(previewRect.top - fileRect.top) < 2,
    'Explorer preview is not on the right',
  );
  console.log('DITASHA_SNAPSHOT:explorer-inline-preview');
  await new Promise((r) => setTimeout(r, 300));
  $('archivePreviewTextures').value = 'alternate.ytd';
  $('archivePreviewReload').click();
  await wait(() => !$('archiveOpen').disabled, 'Manual texture reload stuck');
  assert(
    [...$('mvMaterialTexture').options].some((o) => o.textContent.includes('alternate.ytd')),
    'Selected YTD was not loaded',
  );
  assert($('workspaceLabel').textContent === 'GTA V Explorer', 'Reload moved away from Explorer');
  $('archivePreviewClose').click();
  assert(document.querySelector('.explorer-preview').hidden, 'Preview did not close');
  select('fxmanifest.lua');
  $('archiveCodeEditor').click();
  await wait(
    () => document.querySelector('.code-dialog').open && !$('archiveOpen').disabled,
    'Monaco did not open',
  );
  const monaco = window.ditashaCode,
    model = monaco.editor.getModels().at(-1);
  assert(model.getLanguageId() === 'lua', 'Lua syntax mode missing');
  model.setValue('-- edited offline\r\nfx_version "cerulean"\r\n');
  assert(
    window.ditashaWorkspace.unsavedItems().some((i) => i.name.startsWith('Code ·')),
    'Code buffer not tracked as unsaved',
  );
  const dialog = document.querySelector('.code-dialog');
  dialog.querySelector('[data-action=close]').click();
  await wait(() => $('unsavedDialog').open, 'Closing dirty code skipped confirmation');
  $('unsavedBack').click();
  await wait(() => !$('unsavedDialog').open, 'Cancel did not close confirmation');
  assert(dialog.open, 'Cancel discarded editor');
  dialog.querySelector('[data-action=apply]').click();
  await wait(
    () => !window.ditashaWorkspace.unsavedItems().some((i) => i.name.startsWith('Code ·')),
    'Code did not apply',
  );
  assert(
    window.ditashaWorkspace.unsavedItems().some((i) => i.name.startsWith('Archive ·')),
    'Applied code not tracked as archive edit',
  );
  console.log('DITASHA_SNAPSHOT:explorer-code-editor');
  await new Promise((r) => setTimeout(r, 300));
  dialog.querySelector('[data-action=close]').click();
  $('archiveExtract').click();
  await wait(() => saves.length === 1, 'Edited code extraction failed');
  assert(
    new TextDecoder().decode(new Uint8Array(saves[0].data)).includes('-- edited offline'),
    'Editor buffer did not reach archive bytes',
  );
  $('archiveExport').click();
  await wait(
    () => saves.length === 2 && !$('archiveOpen').disabled,
    'Edited archive export failed',
  );
  assert(
    !window.ditashaWorkspace.unsavedItems().some((i) => /^(Code|Archive) ·/.test(i.name)),
    'Saved archive remains dirty',
  );
  const file = new File(['original source'], 'note.txt');
  Object.defineProperty(file, 'webkitRelativePath', { value: 'source/note.txt' });
  await input('archiveFolderInput', [file]);
  select('note.txt');
  $('archiveCodeEditor').click();
  await wait(() => dialog.open && !$('archiveOpen').disabled, 'Folder text did not open');
  monaco.editor.getModels().at(-1).setValue('copy only');
  assert(dialog.querySelector('[data-action=apply]').disabled, 'Folder source became writable');
  dialog.querySelector('[data-action=copy]').click();
  await wait(
    () => saves.length === 3 && !dialog.querySelector('[data-action=close]').disabled,
    'Folder copy did not export',
  );
  assert((await file.text()) === 'original source', 'Folder source was overwritten');
  dialog.querySelector('[data-action=close]').click();
  await wait(() => !dialog.open, 'Saved file copy still triggered discard confirmation');
  $('openCodeEditor').click();
  await wait(
    () => dialog.open && dialog.querySelector('h2').textContent === 'untitled.lua',
    'Standalone Code editor entry failed',
  );
  monaco.editor.getModels().at(-1).setValue('-- standalone');
  dialog.querySelector('[data-action=new]').click();
  await wait(() => $('unsavedDialog').open, 'New file discarded dirty buffer without confirmation');
  $('unsavedBack').click();
  await wait(() => !$('unsavedDialog').open, 'Cancel did not preserve standalone file');
  assert(
    monaco.editor.getModels().at(-1).getValue() === '-- standalone',
    'Standalone draft lost after cancel',
  );
  dialog.querySelector('[data-action=close]').click();
  await wait(() => $('unsavedDialog').open, 'Dirty standalone buffer skipped confirmation');
  $('unsavedDiscard').click();
  await wait(() => !dialog.open, 'Discard did not close code editor');
  $('openCodeEditor').click();
  await wait(() => dialog.open, 'Standalone editor did not reopen');
  const localInput = dialog.querySelector('[data-action=input]'),
    transfer = new DataTransfer();
  transfer.items.add(new File(['{"name":"DITASHA"}'], 'config.json'));
  localInput.files = transfer.files;
  localInput.dispatchEvent(new Event('change'));
  await wait(
    () => dialog.querySelector('h2').textContent === 'config.json',
    'Standalone local file did not load',
  );
  assert(
    monaco.editor.getModels().at(-1).getLanguageId() === 'json',
    'Standalone JSON syntax mode missing',
  );
  assert(
    dialog.querySelector('[data-action=apply]').disabled,
    'Local file incorrectly targets archive',
  );
  dialog.querySelector('[data-action=close]').click();
  return { inlinePreview: true, offlineMonaco: true, saves };
};
