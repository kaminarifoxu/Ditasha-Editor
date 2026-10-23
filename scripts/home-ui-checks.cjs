module.exports = async function checkHome({ ytd, size, interactions }) {
  const assert = (value, message) => {
    if (!value) throw Error(message);
  };
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const wait = async (check, message) => {
    const end = Date.now() + 15000;
    while (Date.now() < end) {
      if (check()) return;
      await sleep(50);
    }
    throw Error(message);
  };
  const home = document.querySelector('.home-workspace');
  document.getElementById('openHome').click();
  await sleep(500);
  document.getElementById('toast').style.display = 'none';
  assert(
    !home.hidden && document.querySelector('main').hidden,
    'Homepage does not replace the editor',
  );
  assert(
    document.querySelectorAll('.home-workspace-card').length === 9 &&
      home.querySelector('[data-home-page=fivemtools]'),
    'Homepage tool cards missing',
  );
  assert(
    document.body.dataset.workspace === 'home',
    'Homepage did not become the active workspace',
  );
  assert(home.scrollWidth <= home.clientWidth + 1, 'Homepage overflows horizontally at ' + size);
  for (const card of home.querySelectorAll('.home-workspace-card')) {
    const box = card.getBoundingClientRect();
    assert(box.width > 150 && box.right <= innerWidth, 'Workspace card does not fit at ' + size);
  }
  console.log('DITASHA_SNAPSHOT:home-' + size);
  document.querySelector('.workspace-nav [data-page="editor"]').click();
  const shelf = document.querySelector('.editor-commandbar');
  assert(
    shelf.scrollWidth <= shelf.clientWidth + 2,
    'Workshop toolbar overflows horizontally at ' + size,
  );
  const controls = [...shelf.querySelectorAll('button,input[type=color],input[type=range]')].filter(
    (el) => el.getClientRects().length && !el.hidden,
  );
  for (let a = 0; a < controls.length; a++) {
    const x = controls[a].getBoundingClientRect();
    for (let b = a + 1; b < controls.length; b++) {
      const y = controls[b].getBoundingClientRect();
      assert(
        Math.min(x.right, y.right) - Math.max(x.left, y.left) < 1 ||
          Math.min(x.bottom, y.bottom) - Math.max(x.top, y.top) < 1,
        'Workshop controls overlap at ' + size + ': ' + controls[a].id + ' / ' + controls[b].id,
      );
    }
  }
  if (size >= 1500)
    assert(
      shelf.getBoundingClientRect().height < 140,
      'Toolbar cards consume too much canvas height',
    );
  console.log('DITASHA_SNAPSHOT:workshop-toolbar-' + size);
  await sleep(200);
  for (const page of ['modelviewer', 'archives', 'converter', 'pack']) {
    document.querySelector('.workspace-nav [data-page="' + page + '"]').click();
    await sleep(100);
    console.log('DITASHA_SNAPSHOT:workshop-' + page + '-' + size);
    await sleep(100);
  }
  document.getElementById('openHome').click();
  if (!interactions) return { size, fits: true, workshopToolbar: true };
  assert(home.querySelectorAll('.home-suite-card').length === 10, 'Creative workspaces missing');
  for (const [group, count] of [
    ['DESIGN', 3],
    ['MOTION', 3],
    ['OFFICE', 4],
    ['ALL', 10],
  ]) {
    const filter = home.querySelector(`[data-studio-filter="${group}"]`);
    filter.click();
    assert(
      home.querySelectorAll('.home-suite-card:not([hidden])').length === count &&
        filter.getAttribute('aria-pressed') === 'true',
      'Studio filter failed: ' + group,
    );
  }
  document.getElementById('openSettings').click();
  const motion = document.getElementById('appearanceMotion');
  motion.value = 'reduced';
  motion.dispatchEvent(new Event('change'));
  assert(
    localStorage.getItem('ditasha.motion') === 'reduced' &&
      getComputedStyle(home.querySelector('.studio-shape')).animationName === 'none',
    'Reduced-motion preference did not disable decorative animation',
  );
  motion.value = 'system';
  motion.dispatchEvent(new Event('change'));
  document.getElementById('settingsClose').click();
  const title = document.title;
  document.querySelector('header .brand').click();
  assert(document.title === title && !home.hidden, 'Brand does not safely return home');
  document.getElementById('openWorkspaceSearch').click();
  const command = document.getElementById('workspaceCommand');
  assert(command.open, 'Workspace search did not open');
  const input = command.querySelector('input');
  input.value = 'vehicle';
  input.dispatchEvent(new Event('input'));
  const visible = [...command.querySelectorAll('.workspace-command-results button')].filter(
    (button) => !button.hidden,
  );
  assert(visible.length === 1, 'Workspace search did not filter the available tools');
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  assert(
    !command.open && document.body.dataset.workspace === 'vehicles',
    'Search did not navigate to the selected workspace',
  );
  document.getElementById('openHome').click();
  for (const page of ['files', 'editor', 'archives', 'vehicles', 'converter', 'pack']) {
    home.querySelector(`[data-home-page="${page}"]`).click();
    assert(
      document.body.dataset.workspace === page && home.hidden,
      'Homepage navigation failed: ' + page,
    );
    document.getElementById('openHome').click();
  }
  input.value = 'no-matching-workspace';
  input.dispatchEvent(new Event('input'));
  assert(!command.querySelector('p').hidden, 'Search has no empty state');
  const dt = new DataTransfer();
  dt.items.add(new File([new Uint8Array(ytd)], 'home-session.ytd'));
  const fileInput = document.getElementById('fileInput');
  fileInput.files = dt.files;
  fileInput.dispatchEvent(new Event('change'));
  await wait(
    () => home.querySelector('.home-session-file'),
    'Loaded file did not appear on homepage',
  );
  assert(
    home.querySelector('[data-home=session-count]').textContent === '1 FILE',
    'Session counter is not based on loaded files',
  );
  home.querySelector('.home-session-file').click();
  assert(document.body.dataset.workspace === 'editor', 'Session file did not open the editor');
  assert(
    document.querySelector('#fileList .file.selected strong')?.textContent === 'home-session.ytd',
    'Session navigation selected the wrong document',
  );
  document.getElementById('openHome').click();
  assert(
    home.querySelectorAll('.home-session-file').length === 1,
    'Changing workspace discarded the loaded file',
  );
  document.body.dataset.theme = 'light';
  await sleep(200);
  assert(
    getComputedStyle(home).backgroundColor === 'rgb(241, 242, 237)',
    'Homepage light theme did not apply',
  );
  document.getElementById('toast').style.display = 'none';
  console.log('DITASHA_SNAPSHOT:home-light');
  await sleep(200);
  document.body.dataset.theme = 'midnight';
  home.querySelector('.home-workspace-grid').scrollIntoView({ block: 'start' });
  await sleep(200);
  console.log('DITASHA_SNAPSHOT:home-tools-session');
  await sleep(200);
  home.scrollTop = 0;
  return { size, fits: true, search: true, navigation: true, sessionFiles: true };
};
