module.exports = async function checkGtaTools() {
  const $ = (id) => document.getElementById(id),
    sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const assert = (ok, label) => {
    if (!ok) throw Error(label);
  };
  let listener = null,
    ran = null,
    opened = null;
  const state = {
    supported: true,
    busy: false,
    message: 'Siap.',
    log: '',
    result: null,
    tools: ['moddrop', 'weapons', 'trium'].map((id) => ({ id, installed: true })),
  };
  window.ditashaGtaTools = {
    state: async () => state,
    subscribe: (fn) => {
      listener = fn;
      return () => {};
    },
    choose: async (kind) => (kind === 'source' ? 'C:\\Source Models' : 'C:\\Output DLC'),
    install: async () => ({ cancelled: true }),
    exe: async () => ({ cancelled: true }),
    gui: async (id) => {
      opened = id;
    },
    output: async () => {
      opened = 'output';
    },
    cancel: async () => {},
    run: async (request) => {
      ran = request;
      state.result = { success: true, output: 'C:\\Output DLC\\DITASHA-test' };
      state.log = 'Build selesai. dlc.rpf';
      state.message = 'Selesai.';
      listener({ ...state, busy: true, message: 'Build…' });
      listener({ ...state, busy: false, message: 'Selesai.' });
      return state.result;
    },
  };
  document.querySelector('[data-page="gtatools"]').click();
  await sleep(120);
  assert(document.querySelectorAll('.gt-tool-card').length === 3, 'Three native tools missing');
  assert($('gtRun').disabled, 'Empty source should block run');
  $('gtSource').click();
  await sleep(80);
  $('gtOutput').click();
  await sleep(80);
  $('gtOperation').value = 'build';
  $('gtOperation').dispatchEvent(new Event('change'));
  $('gtName').value = 'Ditasha Test';
  $('gtModel').value = 'ditasha_pistol';
  assert(!$('gtRun').disabled, 'Selected source and output did not enable build');
  $('gtRun').click();
  await sleep(100);
  assert(
    ran.id === 'weapons' && ran.action === 'build' && ran.values.model === 'ditasha_pistol',
    'Weapon request fields changed',
  );
  assert(
    $('gtLog').textContent.includes('dlc.rpf') && !$('gtReveal').disabled,
    'Native log/output not exposed',
  );
  $('gtReveal').click();
  await sleep(50);
  assert(opened === 'output', 'Output action failed');
  $('gtTool').value = 'moddrop';
  $('gtTool').dispatchEvent(new Event('change'));
  assert($('gtOperation').options.length === 4, 'ModDrop DLC builder types missing');
  $('gtOperation').value = 'clothing';
  $('gtOperation').dispatchEvent(new Event('change'));
  assert(!$('gtFemaleField').hidden, 'Female fallback field unavailable');
  document.querySelector('[data-gui="trium"]').click();
  await sleep(50);
  assert(opened === 'trium', 'TRIUM native launcher not wired');
  document.querySelector('[data-install="trium"]').click();
  await sleep(80);
  assert($('gtStatus').textContent === 'Selesai.', 'Cancelled package dialog broke current state');
  const panel = document.querySelector('.gta-tools-workspace');
  assert(panel.scrollWidth <= panel.clientWidth + 1, 'Toolchain overflow');
  console.log('DITASHA_SNAPSHOT:gta-toolchain');
  await sleep(200);
  return {
    cards: 3,
    cliInputs: true,
    moddropBuilders: 4,
    liveLog: true,
    output: true,
    triumLauncher: true,
    cancelledInstall: true,
  };
};
