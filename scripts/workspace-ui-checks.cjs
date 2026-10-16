module.exports = async function checkWorkspaceShell() {
  const $ = (id) => document.getElementById(id),
    assert = (ok, message) => {
      if (!ok) throw Error(message);
    };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  assert(document.body.classList.contains('workspace-shell'), 'Workspace shell did not mount');
  const nav = document.querySelector('.workspace-nav').getBoundingClientRect();
  assert(
    nav.left === 0 && nav.height > 400 && nav.width < 220,
    'Workspace navigation is not a vertical rail',
  );
  assert(
    document.querySelector('[data-page="archives"]').nextElementSibling.dataset.page === 'vehicles',
    'Vehicle placement changed',
  );
  const original = window.ditashaDiscord,
    calls = [];
  window.ditashaDiscord = {
    state: async () => ({
      enabled: true,
      shareWorkspace: true,
      applicationId: '',
      status: 'setup',
      message: 'Isi Application ID.',
    }),
    workspace: async (p) => calls.push({ page: p }),
    project: async (name) => calls.push({ project: name }),
    configure: async (value) => {
      calls.push(value);
      return {
        ...value,
        status: value.enabled ? 'connecting' : 'disabled',
        message: value.enabled ? 'Menghubungkan' : 'Dimatikan',
      };
    },
    docs: async () => true,
  };
  $('openSettings').click();
  await sleep(50);
  assert($('settingsDialog').open && $('discordAppId'), 'Settings are unavailable');
  $('appearanceTheme').value = 'light';
  $('appearanceTheme').dispatchEvent(new Event('change'));
  await sleep(30);
  assert(
    document.body.dataset.theme === 'light' && localStorage.getItem('ditasha.theme') === 'light',
    'Theme preference not applied',
  );
  $('appearanceDensity').value = 'compact';
  $('appearanceDensity').dispatchEvent(new Event('change'));
  assert(document.body.dataset.density === 'compact', 'Density preference not applied');
  $('discordAppId').value = '123456789012345678';
  $('discordSave').click();
  await sleep(50);
  assert(
    calls.some((c) => c.applicationId === '123456789012345678' && c.enabled),
    'Discord preferences were not saved',
  );
  $('discordProjectName').value = 'GANOMABI Ped';
  $('discordProjectName').dispatchEvent(new Event('change'));
  await sleep(30);
  assert(
    calls.some((c) => c.project === 'GANOMABI Ped'),
    'Project name not sent to Discord',
  );
  $('discordProjectName').value = '';
  $('discordProjectName').dispatchEvent(new Event('change'));
  $('discordEnabled').checked = false;
  $('discordSave').click();
  await sleep(50);
  assert(
    calls.some((c) => c.enabled === false),
    'Discord cannot be disabled',
  );
  $('settingsClose').click();
  document.querySelector('[data-page="vehicles"]').click();
  await sleep(30);
  assert(
    calls.some((c) => c.page === 'vehicles'),
    'Discord did not follow workspace',
  );
  $('openSettings').click();
  $('appearanceTheme').value = 'midnight';
  $('appearanceTheme').dispatchEvent(new Event('change'));
  $('appearanceDensity').value = 'comfortable';
  $('appearanceDensity').dispatchEvent(new Event('change'));
  $('settingsClose').click();
  document.querySelector('[data-page="editor"]').click();
  window.ditashaDiscord = original;
  console.log('DITASHA_SNAPSHOT:workspace-redesign');
  return { navigation: 'vertical', themes: 2, discordSettings: true };
};
