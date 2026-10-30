import { mountWeaponStudio } from './weapon-studio.js';
import { ICON_CODES } from './ui-icons.js';
export function mountGtaTool({ nav, activate, viewers, toast, tool, download, confirmDiscard }) {
  const icon = (name) =>
    `<i class="di-icon" aria-hidden="true" data-icon="${name}" data-glyph="${String.fromCodePoint(parseInt(ICON_CODES[name] || ICON_CODES.cube, 16))}"></i>`;
  const button = document.createElement('button');
  const title = tool === 'moddrop' ? 'ModDropV' : 'AddonWeaponsBuilder';
  button.dataset.page = tool;
  button.onclick = () => activate(tool);
  button.innerHTML = icon('cube') + '<span>' + title + '</span>';
  nav.append(button);
  const root = document.createElement('section');
  root.className = 'gta-tools-workspace';
  root.hidden = true;
  root.innerHTML = `<div class="gt-heading"><div><span class="eyebrow">DITASHA / DESKTOP ENGINES</span><h1>${title}</h1><p class="muted">${tool === 'moddrop' ? 'Builder DLC kendaraan, ped, prop dan pakaian.' : 'Analisis, rencana nama dan build DLC senjata.'}</p></div><button id="gtRefresh">Periksa tools</button></div>
  <div class="gt-cards" id="gtCards"></div>
  <div class="gt-layout"><section class="gt-panel"><span class="eyebrow">BUILD WORKSPACE</span><h2>Siapkan add-on DLC</h2><div class="gt-fields"><label hidden>Engine<select id="gtTool"><option value="weapons">AddonWeaponsBuilder</option><option value="moddrop">ModDropV</option></select></label><label>Proses<select id="gtOperation"></select></label></div>
  <div class="gt-path"><button id="gtSource">Pilih folder sumber</button><span id="gtSourcePath">Belum dipilih</span></div><p class="muted">Pilih folder mod yang sudah diekstrak. Gunakan aplikasi asli untuk instalasi dan pengelolaan mod di GTA V.</p>
  <div class="gt-path"><button id="gtOutput">Pilih folder hasil</button><span id="gtOutputPath">Belum dipilih</span></div>
  <div class="gt-fields"><label>Nama proyek<input id="gtName" maxlength="100" placeholder="Ditasha addon"></label><label>Nama model baru<input id="gtModel" maxlength="64" placeholder="ditasha_model"></label><label id="gtBaseField">Base kendaraan / ped<input id="gtBase" maxlength="64" placeholder="adder"></label><label id="gtPriceField">Harga senjata<input id="gtPrice" type="number" min="0" max="2147483647" value="5000"></label><label>Edisi<select id="gtEdition"><option value="legacy">GTA V Legacy</option><option value="enhanced">GTA V Enhanced</option></select></label><label id="gtFemaleField" class="check"><input id="gtFemale" type="checkbox">Fallback pakaian female</label></div>
  <p class="gt-note">Hasil berupa DLC GTA V. Untuk FiveM, susunan resource dan metadata tetap perlu disesuaikan. Build disimpan ke subfolder baru pada folder hasil.</p><div class="gt-actions"><button id="gtRun" class="primary">Jalankan</button><button id="gtCancel" disabled>Hentikan</button><button id="gtReveal" disabled>Buka hasil</button><button id="gtPreview">Preview 3D</button></div><input id="gtPreviewInput" type="file" accept=".ydd,.ydr,.yft,.ytd" multiple hidden></section>
  <section class="gt-panel gt-log-panel"><div class="gt-heading"><h2>Proses & hasil</h2><span id="gtStatus" role="status">Pilih tool dan folder sumber.</span></div><pre id="gtLog" tabindex="0" aria-label="Log tool"></pre><details><summary>Cara menggunakan</summary><ol><li>Pasang paket tool pada kartu di atas. Pilih ZIP asli untuk aplikasi ini.</li><li>Pilih folder sumber. Untuk senjata, mulai dari Analisis lalu Rencana nama.</li><li>Pilih folder hasil di luar sumber, lengkapi pengaturan dan jalankan build.</li><li>Periksa log, buka hasil, atau pilih model + YTD lewat Preview 3D.</li></ol></details></section></div>`;
  root.dataset.tool = tool;
  root.querySelectorAll('[id]').forEach((el) => (el.id = tool + '-' + el.id));
  nav.after(root);
  const weaponStudio =
    tool === 'weapons' ? mountWeaponStudio({ root, download, toast, confirmDiscard }) : null;
  const $ = (id) => root.querySelector('#' + tool + '-' + id),
    api = () => window.ditashaGtaTools;
  let records = [],
    supported = false,
    busy = false,
    activeTool = null,
    source = null,
    output = null,
    lastResult = null,
    unsubscribe = null;
  const ids = [
    [
      'moddrop',
      'ModDropV',
      '2.0.1',
      'Builder DLC kendaraan, ped, prop dan pakaian. Instalasi & mod library tersedia di aplikasi asli.',
    ],
    [
      'weapons',
      'AddonWeaponsBuilder',
      '2.0.0',
      'Analisis model, rencana nama dan build senjata add-on lewat engine aslinya.',
    ],
  ];
  function controls() {
    const ready = records.find((r) => r.id === $('gtTool').value)?.installed;
    const analysis = ['scan', 'plan'].includes($('gtOperation').value);
    $('gtRun').disabled = busy || !supported || !ready || !source || (!analysis && !output);
    $('gtCancel').disabled = !busy || activeTool !== tool;
    $('gtReveal').disabled = busy || !lastResult?.output;
    for (const id of [
      'gtTool',
      'gtOperation',
      'gtSource',
      'gtOutput',
      'gtName',
      'gtModel',
      'gtBase',
      'gtPrice',
      'gtEdition',
      'gtFemale',
    ])
      $(id).disabled = busy;
    root
      .querySelectorAll('[data-install],[data-download],[data-gui],[data-exe]')
      .forEach(
        (b) =>
          (b.disabled =
            busy ||
            !supported ||
            (b.dataset.gui && !records.find((r) => r.id === b.dataset.gui)?.installed)),
      );
  }
  function progress(s) {
    busy = !!s.busy;
    activeTool = s.activeTool ?? s.tool;
    if (s.tool && s.tool !== tool) {
      controls();
      return;
    }
    $('gtStatus').textContent = s.message || '';
    $('gtLog').textContent = s.log || '';
    lastResult = s.result || null;
    $('gtLog').scrollTop = $('gtLog').scrollHeight;
    controls();
  }
  function cards() {
    $('gtCards').replaceChildren();
    for (const [id, name, version, description] of ids.filter(([id]) => id === tool)) {
      const record = records.find((r) => r.id === id),
        card = document.createElement('article');
      card.className = 'gt-tool-card';
      const title = document.createElement('h2');
      title.textContent = name;
      const badge = document.createElement('span');
      badge.className = 'gt-badge';
      badge.textContent = record?.installed ? 'Terpasang · ' + version : version;
      const p = document.createElement('p');
      p.textContent = description;
      const actions = document.createElement('div');
      actions.className = 'gt-actions';
      const install = document.createElement('button');
      install.dataset.install = id;
      install.textContent = 'Pasang ZIP';
      install.onclick = () => act(() => api().install(id, false), true);
      actions.append(install);
      if (id === 'weapons') {
        const dl = document.createElement('button');
        dl.dataset.download = id;
        dl.textContent = 'Unduh resmi';
        dl.onclick = () => act(() => api().install(id, true), true);
        actions.append(dl);
      }
      const open = document.createElement('button');
      open.dataset.gui = id;
      open.textContent = 'Buka aplikasi asli';
      open.onclick = () => act(() => api().gui(id));
      actions.append(open);
      card.append(badge, title, p, actions);
      $('gtCards').append(card);
    }
    controls();
  }
  async function act(fn, refreshAfter = false) {
    try {
      if (!api()) throw Error('Buka melalui DITASHA Editor desktop Windows.');
      await fn();
      if (refreshAfter) await refresh();
    } catch (e) {
      toast(e.message);
      $('gtStatus').textContent = e.message;
      await refresh(false);
    }
  }
  async function refresh(updateStatus = true) {
    if (!api()) {
      supported = false;
      cards();
      if (updateStatus)
        $('gtStatus').textContent = 'Tools ini tersedia di aplikasi desktop Windows.';
      return;
    }
    try {
      const state = await api().state();
      records = state.tools;
      supported = state.supported;
      if (!unsubscribe && api().subscribe) unsubscribe = api().subscribe(progress);
      cards();
      if (updateStatus)
        progress({
          ...state,
          ...(state.sessions?.[tool] || {}),
          tool: state.sessions?.[tool] ? tool : state.tool,
          activeTool: state.tool,
        });
      else controls();
    } catch (e) {
      toast(e.message);
    }
  }
  function operations() {
    const weapon = $('gtTool').value === 'weapons';
    $('gtOperation').replaceChildren(
      ...(weapon
        ? [
            ['scan', 'Analisis senjata'],
            ['plan', 'Rencana nama'],
            ['build', 'Build DLC senjata'],
          ]
        : [
            ['vehicle', 'Build DLC kendaraan'],
            ['ped', 'Build DLC ped'],
            ['prop', 'Build DLC prop'],
            ['clothing', 'Build DLC pakaian'],
          ]
      ).map(([value, label]) => {
        const o = document.createElement('option');
        o.value = value;
        o.textContent = label;
        return o;
      }),
    );
    fields();
  }
  function fields() {
    const weapon = $('gtTool').value === 'weapons',
      op = $('gtOperation').value;
    $('gtBaseField').hidden = weapon || !['vehicle', 'ped'].includes(op);
    $('gtPriceField').hidden = !weapon;
    $('gtFemaleField').hidden = weapon || op !== 'clothing';
    $('gtModel').closest('label').hidden = weapon
      ? op !== 'build'
      : !['vehicle', 'ped'].includes(op);
    $('gtBase').placeholder =
      op === 'ped' ? 'opsional · contoh a_m_m_business_01' : 'wajib · contoh adder';
    controls();
  }
  $('gtTool').onchange = operations;
  $('gtOperation').onchange = fields;
  $('gtRefresh').onclick = () => refresh();
  for (const [kind, id] of [
    ['source', 'gtSource'],
    ['output', 'gtOutput'],
  ])
    $(id).onclick = () =>
      act(async () => {
        const p = await api().choose(kind);
        if (p) {
          if (kind === 'source') source = p;
          else output = p;
          $(id + 'Path').textContent = p;
          controls();
        }
      });
  $('gtRun').onclick = () =>
    act(async () => {
      await api().run({
        id: $('gtTool').value,
        action: $('gtOperation').value,
        source,
        output,
        values: {
          name: $('gtName').value,
          model: $('gtModel').value,
          base: $('gtBase').value,
          price: $('gtPrice').value,
          edition: $('gtEdition').value,
          female: $('gtFemale').checked,
        },
      });
      await refresh();
    });
  $('gtCancel').onclick = () => act(() => api().cancel());
  $('gtReveal').onclick = () => act(() => api().output(tool));
  $('gtPreview').onclick = () => $('gtPreviewInput').click();
  $('gtPreviewInput').onchange = async (e) => {
    const files = [...e.target.files];
    if (files.length) {
      activate('modelviewer');
      await viewers.openModels(files);
    }
    e.target.value = '';
  };
  $('gtTool').value = tool;
  operations();
  cards();
  return {
    root,
    refresh,
    setActive: (value) => weaponStudio?.setActive(value),
    unsavedItems: () => weaponStudio?.unsavedItems() || [],
  };
}
