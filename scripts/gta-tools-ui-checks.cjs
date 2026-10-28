module.exports = async function checkGtaTools() {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const assert = (ok, label) => {
    if (!ok) throw Error(label);
  };
  let ran = null,
    opened = null;
  const listeners = [];
  const state = {
    supported: true,
    busy: false,
    message: 'Siap.',
    log: '',
    result: null,
    tool: null,
    tools: ['moddrop', 'weapons'].map((id) => ({ id, installed: true })),
  };
  window.ditashaGtaTools = {
    state: async () => state,
    subscribe: (fn) => {
      listeners.push(fn);
      return () => {};
    },
    choose: async (kind) => (kind === 'source' ? 'C:\\Source Models' : 'C:\\Output DLC'),
    install: async () => ({ cancelled: true }),
    gui: async (id) => {
      opened = id;
    },
    output: async (id) => {
      opened = id;
    },
    cancel: async () => {},
    run: async (request) => {
      ran = request;
      Object.assign(state, {
        tool: request.id,
        result: { success: true, output: 'C:\\Output DLC\\test' },
        log: 'Build selesai. dlc.rpf',
        message: 'Selesai.',
      });
      listeners.forEach((fn) => fn({ ...state, busy: true }));
      listeners.forEach((fn) => fn({ ...state, busy: false }));
      return state.result;
    },
  };
  assert(!document.querySelector('[data-page=gtatools]'), 'Combined toolchain still exists');
  assert(!document.querySelector('[data-gui=trium]'), 'TRIUM still exposed');
  document.querySelector('[data-page=weapons]').click();
  await sleep(120);
  let $ = (id) => document.getElementById('weapons-' + id);
  assert(
    document.querySelector('[data-tool=weapons]').querySelectorAll('.gt-tool-card').length === 1,
    'Weapons card not isolated',
  );
  assert($('gtRun').disabled, 'Empty source should block run');
  $('gtSource').click();
  await sleep(70);
  $('gtOutput').click();
  await sleep(70);
  $('gtOperation').value = 'build';
  $('gtOperation').dispatchEvent(new Event('change'));
  $('gtModel').value = 'ditasha_pistol';
  $('gtRun').click();
  await sleep(100);
  assert(
    ran.id === 'weapons' && ran.action === 'build' && ran.values.model === 'ditasha_pistol',
    'Weapon fields changed',
  );
  assert(
    $('gtLog').textContent.includes('dlc.rpf') && !$('gtReveal').disabled,
    'Weapon result missing',
  );
  $('gtReveal').click();
  await sleep(30);
  assert(opened === 'weapons', 'Wrong output tool');
  document.querySelector('[data-page=moddrop]').click();
  await sleep(100);
  $ = (id) => document.getElementById('moddrop-' + id);
  assert($('gtRun').disabled, 'Separate source state leaked');
  assert($('gtTool').closest('label').hidden, 'Engine dropdown still exposed');
  assert($('gtOperation').options.length === 4, 'ModDrop operations missing');
  $('gtOperation').value = 'clothing';
  $('gtOperation').dispatchEvent(new Event('change'));
  assert(!$('gtFemaleField').hidden, 'Female fallback unavailable');
  $('gtSource').click();
  await sleep(50);
  $('gtOutput').click();
  await sleep(50);
  $('gtFemale').checked = true;
  $('gtRun').click();
  await sleep(100);
  assert(
    ran.id === 'moddrop' && ran.action === 'clothing' && ran.values.female,
    'ModDrop request routed to wrong engine',
  );
  document.querySelector('[data-page=weapons]').click();
  await sleep(80);
  assert(
    document.getElementById('weapons-gtModel').value === 'ditasha_pistol',
    'Weapons settings lost',
  );
  const panel = document.querySelector('[data-tool=weapons]');
  assert(panel.scrollWidth <= panel.clientWidth + 1, 'Page overflow');
  console.log('DITASHA_SNAPSHOT:weapons-builder');
  await sleep(150);
  return {
    separatePages: 2,
    moddropBuilders: 4,
    independentInputs: true,
    weaponBuild: true,
    moddropBuild: true,
    triumRemoved: true,
  };
};
