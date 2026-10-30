module.exports = async function checkCompleteWorkspace() {
  const $ = (id) => document.getElementById(id);
  const pause = () => new Promise((resolve) => setTimeout(resolve, 100));
  const check = (ok, message) => {
    if (!ok) throw Error(message);
  };
  const pages = [
    ['photobooth', '.pb-assets', '.pb-settings'],
    ['compressor', '.ac-files', '.ac-settings'],
    ['fivemtools', '.ft-grid > aside'],
    ['files', '.fm-sidebar', '.fm-inspector'],
    ['modelviewer', '.asset-viewer.model-viewer > .tool-sidebar'],
    ['converter', '.tool-workspace > .tool-sidebar', '.tool-workspace > .tool-details'],
    ['pack', '.tool-workspace > .tool-sidebar', '.tool-workspace > .tool-details'],
    ['moddrop', '[data-tool=moddrop] .gt-panel'],
    ['weapons', '[data-tool=weapons] .gt-panel'],
  ];
  const report = [];
  for (const [page, ...selectors] of pages) {
    document.querySelector('.workspace-nav [data-page="' + page + '"]').click();
    await pause();
    if (
      page === 'files' &&
      getComputedStyle(document.querySelector('.fm-inspector')).display === 'none'
    )
      $('fmToggleDetails').click();
    const width = innerWidth;
    for (const selector of selectors) {
      const panel = document.querySelector(selector);
      const toggle = panel?.querySelector(':scope > .workspace-panel-toggle');
      check(toggle, 'Missing minimize control: ' + page + '/' + selector);
      if (panel.classList.contains('workspace-panel-collapsed')) toggle.click();
      toggle.click();
      await pause();
      check(toggle.getAttribute('aria-expanded') === 'false', 'Collapse state lost: ' + page);
      check(
        [...panel.children].filter((c) => c !== toggle).every((c) => !c.getClientRects().length),
        'Panel content remained visible: ' + page,
      );
      const rect = toggle.getBoundingClientRect();
      check(rect.width > 20 && rect.height > 20, 'Restore control inaccessible: ' + page);
      check(rect.left >= -1 && rect.right <= width + 1, 'Restore control outside window: ' + page);
      const stage = panel.parentElement.querySelector(
        '.pb-stage,.ac-center,.fm-browser,.viewer-content',
      );
      if (stage) {
        const bounds = stage.getBoundingClientRect();
        check(bounds.width > 120 && bounds.right <= width + 1, 'Minimize clipped content: ' + page);
      }
      toggle.click();
    }
    $('openWorkspacePanels').click();
    check($('workspacePanelsDialog').open, 'Panel dialog unavailable');
    const input = $('workspacePanelsDialog').querySelector('input');
    check(input, 'Current workspace has no panel controls: ' + page);
    input.click();
    $('workspacePanelsDialog').querySelector('.workspace-panels-restore').click();
    check(
      [...$('workspacePanelsDialog').querySelectorAll('input')].every((i) => i.checked),
      'Restore all did not restore panels',
    );
    $('workspacePanelsDialog').querySelector('.workspace-panel-menu-head button').click();
    report.push(page);
  }
  $('openNativeBuild').click();
  await pause();
  for (const panel of document.querySelectorAll('.native-build-layout > aside')) {
    const toggle = panel.querySelector(':scope > .workspace-panel-toggle');
    check(toggle, 'Native build panel has no minimize');
    toggle.click();
    await pause();
    const rect = toggle.getBoundingClientRect();
    check(rect.width > 20 && rect.right <= innerWidth + 1, 'Native restore outside window');
    toggle.click();
  }
  report.push('native-build');
  document.querySelector('[data-page=vehicles]').click();
  $('vehicleDebadge').click();
  await pause();
  for (const panel of document.querySelectorAll('.debadge-sidebar,.debadge-inspector')) {
    const toggle = panel.querySelector(':scope > .workspace-panel-toggle');
    check(toggle, 'Debadge panel has no minimize');
    toggle.click();
    await pause();
    check(toggle.getBoundingClientRect().width > 20, 'Debadge restore inaccessible');
    toggle.click();
  }
  $('dbBack').click();
  report.push('debadge');
  document.querySelector('[data-page=photobooth]').click();
  await pause();
  check(
    document.querySelectorAll('.pb-settings > .workspace-settings-section').length === 2,
    'Photo Booth sections not grouped',
  );
  const section = document.querySelector('.pb-settings > .workspace-settings-section');
  section.open = false;
  await pause();
  check(section.getBoundingClientRect().height < 75, 'Photo Booth section did not fold');
  section.open = true;
  const select = $('pbTransformMode'),
    buttons = select.nextElementSibling.querySelectorAll('button');
  let events = 0;
  select.addEventListener('change', () => events++);
  buttons[1].click();
  check(select.value === 'rotate' && events === 1, 'Choice buttons lost transform behavior');
  select.value = 'translate';
  select.dispatchEvent(new Event('change'));
  check(buttons[0].getAttribute('aria-pressed') === 'true', 'Native preset restore not reflected');
  const saved = select.disabled;
  select.disabled = true;
  await new Promise((r) => setTimeout(r, 400));
  check(
    [...select.nextElementSibling.children].every((b) => b.disabled),
    'Disabled choices remained active',
  );
  select.disabled = saved;
  select.dispatchEvent(new Event('change'));
  const group = document.createElement('optgroup');
  group.label = 'QA disabled';
  group.disabled = true;
  const option = document.createElement('option');
  option.value = 'qa-unavailable';
  option.text = 'Unavailable';
  group.append(option);
  select.append(group);
  select.dispatchEvent(new Event('change'));
  check(select.nextElementSibling.lastElementChild.disabled, 'Disabled optgroup remained active');
  group.remove();
  select.dispatchEvent(new Event('change'));
  const fieldset = document.createElement('fieldset'),
    label = select.closest('label');
  label.before(fieldset);
  fieldset.append(label);
  fieldset.disabled = true;
  select.dispatchEvent(new Event('change'));
  check(
    [...select.nextElementSibling.children].every((b) => b.disabled),
    'Disabled fieldset remained active',
  );
  fieldset.before(label);
  fieldset.remove();
  select.dispatchEvent(new Event('change'));
  const bounds = $('pbViewport').getBoundingClientRect();
  check(bounds.width > 220 && bounds.right <= innerWidth + 1, 'Photo Booth viewport clipped');
  document.querySelector('[data-page=editor]').click();
  return { pages: report, boothSections: true, choiceBehavior: true, panelMenu: true };
};
