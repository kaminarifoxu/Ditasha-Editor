export const craftWorkspaces = [
  ['photocraft', 'Photo Studio', 'Ps', 'Layers, masks, retouching and PSD documents', 'DESIGN'],
  [
    'vectorcraft',
    'Vector Studio',
    'Ve',
    'Paths, typography, illustration and SVG artwork',
    'DESIGN',
  ],
  [
    'lightcraft',
    'Photo Develop',
    'Ld',
    'Photo organization and manual color development',
    'DESIGN',
  ],
  [
    'filmcraft',
    'Video Studio',
    'Vi',
    'Timeline editing, audio, grading and video export',
    'MOTION',
  ],
  ['opencut', 'OpenCut', 'Oc', 'Local video projects, timeline, text, audio and export', 'MOTION'],
  ['effectcraft', 'Motion Studio', 'Fx', 'Compositions, keyframes and visual effects', 'MOTION'],
  ['pdfcraft', 'PDF Studio', 'Pd', 'Read, organize, merge and split PDF documents', 'OFFICE'],
  ['wordcraft', 'Documents', 'Do', 'Write and format documents with DOCX interchange', 'OFFICE'],
  ['gridcraft', 'Spreadsheets', 'Gr', 'Sheets, formulas, tables and XLSX interchange', 'OFFICE'],
  ['deckcraft', 'Presentations', 'De', 'Slides, layouts and PPTX interchange', 'OFFICE'],
];
export function mountCraft({ nav, activate, toast, preview }) {
  const root = document.createElement('section');
  root.className = 'craft-workspace';
  root.hidden = true;
  root.innerHTML = `<div class="craft-toolbar"><div><span class="eyebrow">CREATIVE WORKSPACE</span><strong data-craft="title">Photo Studio</strong><span data-craft="engine"></span></div><button data-craft="texture">Texture & Model</button><button data-craft="import">Import edited image</button><button data-craft="close">Close engine</button></div><div class="craft-host"><div class="craft-welcome"><span class="craft-monogram">Ps</span><h1>Photo Studio</h1><p data-craft="description"></p><button class="primary" data-craft="start">Open workspace</button><p role="status">Checking local engine…</p><div class="craft-guide"><strong>Your files, your workflow</strong><p>Use File → Open inside the editor to open a document. Use its Save / Export command to keep a file on your computer. Switching workspaces keeps the editor open.</p><p>For GTA textures: export PNG from Texture & Model, edit it here, then choose Import edited image to open the result in Texture & Model. YTD and 3D model operations stay in the texture workspace.</p><p>Engines run locally. External services and network requests are disabled. Format support follows each embedded web engine.</p></div></div></div><input data-craft="file" type="file" accept=".png,.jpg,.jpeg,.webp" hidden>`;
  nav.after(root);
  for (const [id, title, mark, , group] of craftWorkspaces) {
    const b = document.createElement('button');
    b.dataset.page = 'craft-' + id;
    b.dataset.navGroup = group;
    b.innerHTML = `<span class="suite-mark">${mark}</span><span class="nav-label">${title}</span>`;
    b.onclick = () => activate(b.dataset.page);
    nav.append(b);
  }
  const api = window.ditashaCraft,
    host = root.querySelector('.craft-host');
  const $ = (name) => root.querySelector(`[data-craft="${name}"]`);
  const defaultGuide = root.querySelector('.craft-guide').innerHTML;
  let id = 'photocraft',
    records = [],
    busy = false,
    frame = 0,
    last = '';
  function layout() {
    frame = 0;
    if (!api) return;
    const record = records.find((r) => r.id === id),
      r = host.getBoundingClientRect();
    const value =
      !root.hidden &&
      record?.running &&
      !record.error &&
      !document.querySelector('dialog[open]') &&
      r.width > 0 &&
      r.height > 0
        ? { id, x: r.x, y: r.y, width: r.width, height: r.height }
        : null;
    const key = JSON.stringify(value);
    if (last === key) return;
    last = key;
    api.layout(value).catch((e) => toast(e.message));
  }
  function schedule() {
    if (!frame) frame = requestAnimationFrame(layout);
  }
  function draw() {
    const item = craftWorkspaces.find((s) => s[0] === id),
      record = records.find((r) => r.id === id);
    $('title').textContent = item[1];
    $('import').hidden = id === 'opencut';
    root.querySelector('.craft-guide').innerHTML =
      id === 'opencut'
        ? '<strong>Local video editing</strong><p>Open workspace → New project. Import local video, audio or images in Media, then add clips to the timeline. Use Text, Effects and Settings to edit; use Export to save a finished video.</p><p>Projects and imported media are stored locally in DITASHA. Switching workspaces keeps the editor open. Export finished work before clearing application data.</p><p>OpenCut Classic local edition. Online catalogs, AI transcription and remote fonts are excluded. Video codecs and GPU effects depend on this computer.</p>'
        : defaultGuide;
    root.querySelector('h1').textContent = item[1];
    root.querySelector('.craft-monogram').textContent = item[2];
    $('description').textContent = item[3];
    $('engine').textContent = record ? `${id} ${record.version} · local engine` : id;
    root.querySelector('.craft-welcome').hidden = !!record?.running && !record.error;
    $('start').disabled = busy || !record?.installed || !!record?.running;
    $('close').disabled = busy || !record?.running;
    root.querySelector('[role=status]').textContent =
      record?.error ||
      (busy
        ? 'Starting local editor…'
        : record?.installed
          ? 'Ready on this computer.'
          : api
            ? 'Engine is missing from this build. Install the complete Windows preview.'
            : 'Creative engines are available in DITASHA desktop.');
    last = '';
    schedule();
  }
  async function refresh() {
    try {
      records = api ? await api.state() : [];
      draw();
    } catch (e) {
      root.querySelector('[role=status]').textContent = e.message;
    }
  }
  async function start() {
    if (!api || busy) return;
    busy = true;
    draw();
    try {
      records = await api.start(id);
    } catch (e) {
      toast(e.message);
    } finally {
      busy = false;
      draw();
    }
  }
  $('start').onclick = start;
  $('texture').onclick = () => activate('editor');
  $('import').onclick = () => $('file').click();
  $('file').onchange = async () => {
    const files = [...$('file').files];
    $('file').value = '';
    if (files.length) {
      activate('editor');
      await preview(files);
    }
  };
  $('close').onclick = async () => {
    if (!api || busy) return;
    try {
      await api.close(id);
      await refresh();
    } catch (e) {
      toast(e.message);
    }
  };
  new ResizeObserver(schedule).observe(host);
  new MutationObserver(schedule).observe(root, { attributes: true, attributeFilter: ['hidden'] });
  new MutationObserver(schedule).observe(document.body, {
    subtree: true,
    attributes: true,
    attributeFilter: ['open'],
  });
  window.addEventListener('resize', schedule);
  const timer = setInterval(() => {
    if (!root.hidden && !busy) refresh();
  }, 4000);
  window.addEventListener('beforeunload', () => clearInterval(timer));
  return {
    root,
    activate: async (page) => {
      id = page.replace(/^craft-/, '');
      await refresh();
      if (records.find((r) => r.id === id)?.installed && !records.find((r) => r.id === id)?.running)
        await start();
      schedule();
    },
  };
}
