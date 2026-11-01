import { createFilePreview } from './file-preview.js';

// Optional Clothing Library tools for the original File Manager inspector.
// No existing nodes, navigation, editor listeners, or Creative Suite styles are replaced.
export function mountClothingLibraryBrowser({ root, toast, openFile }) {
  const service = () => window.ditashaClothing;
  const inspector = root.querySelector('.fm-inspector');
  if (!inspector) return { refresh: async () => {} };
  const panel = document.createElement('details');
  panel.className = 'fm-library-panel';
  panel.innerHTML = `<summary>Clothing Library</summary>
    <div class="fm-library-actions">
      <button type="button" data-library-import>Import file</button>
      <button type="button" data-library-folder>Import folder</button>
      <button type="button" data-library-refresh>Refresh</button>
    </div>
    <label>Paket <select data-library-pack aria-label="Paket Clothing Library"></select></label>
    <input data-library-search type="search" placeholder="Cari pakaian, YDD, YTD…" aria-label="Cari isi Clothing Library" />
    <div data-library-list role="list" style="max-height:230px;overflow:auto"></div>
    <div data-library-preview style="height:230px;min-height:160px"></div>
    <button type="button" data-library-open disabled>Buka di editor</button>
    <p data-library-status role="status"></p>`;
  inspector.append(panel);
  const $ = (selector) => panel.querySelector(selector);
  const preview = createFilePreview($('[data-library-preview]'));
  let packs = [], activePack = null, selected = null, revision = 0;
  const status = (message) => { $('[data-library-status]').textContent = message; };
  const assetId = (item) => item.relativePath;
  const assetRead = async (id) => {
    const entry = activePack?.files.find((file) => assetId(file) === id);
    if (!entry) throw Error('File tidak ditemukan di library.');
    const result = await service().previewRead(activePack.id, entry.relativePath);
    const companion = activePack.files.find((file) => file.gender === entry.gender &&
      file.component === entry.component && file.drawable === entry.drawable &&
      /\.ytd$/i.test(file.name) && (!file.textureVariant || file.textureVariant === 'a'));
    return {
      name: result.name, data: result.bytes,
      companion: companion && !/\.ytd$/i.test(entry.name)
        ? { id: companion.relativePath, name: companion.name } : null,
    };
  };
  const api = { read: assetRead };
  async function select(entry) {
    selected = entry;
    const ticket = ++revision;
    $('[data-library-open]').disabled = !/\.(ydd|ydr|yft|ytd)$/i.test(entry.name);
    status(entry.name + ' · ' + (entry.component || 'aset') + ' · ' + (entry.gender || 'unknown'));
    preview.clear();
    if (!/\.(ydd|ydr|yft|ytd)$/i.test(entry.name)) return;
    try {
      await preview.show({id: assetId(entry), name: entry.name}, api);
    } catch (error) {
      if (ticket === revision) status('Preview gagal: ' + error.message);
    }
  }
  function renderFiles() {
    const list = $('[data-library-list]');
    list.replaceChildren();
    const search = $('[data-library-search]').value.trim().toLowerCase();
    const entries = (activePack?.files || []).filter((item) =>
      !search || item.name.toLowerCase().includes(search) ||
      (item.component || '').toLowerCase().includes(search));
    for (const entry of entries.slice(0, 250)) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = entry.name;
      button.title = entry.relativePath;
      button.style.display = 'block';
      button.style.width = '100%';
      button.style.textAlign = 'left';
      button.onclick = () => select(entry).catch((error) => status(error.message));
      list.append(button);
    }
    if (entries.length > 250) status('Menampilkan 250 dari ' + entries.length + ' aset. Gunakan pencarian.');
    else if (!entries.length) status('Tidak ada aset yang cocok.');
  }
  async function refresh() {
    if (!service()?.list) { status('Clothing Library tersedia di aplikasi desktop.'); return; }
    packs = await service().list();
    const select = $('[data-library-pack]');
    const previous = activePack?.id;
    select.replaceChildren();
    for (const pack of packs) {
      const option = document.createElement('option');
      option.value = pack.id;
      option.textContent = (pack.pack || pack.name || 'Paket') + ' · ' + (pack.files?.length || 0) + ' file';
      select.append(option);
    }
    activePack = packs.find((pack) => pack.id === previous) || packs[0] || null;
    if (activePack) select.value = activePack.id;
    selected = null;
    preview.clear();
    $('[data-library-open]').disabled = true;
    renderFiles();
    if (!packs.length) status('Belum ada paket. Import file atau folder pakaian FiveM.');
  }
  $('[data-library-pack]').onchange = () => {
    activePack = packs.find((pack) => pack.id === $('[data-library-pack]').value) || null;
    selected = null;
    preview.clear();
    $('[data-library-open]').disabled = true;
    renderFiles();
  };
  $('[data-library-search]').oninput = renderFiles;
  $('[data-library-refresh]').onclick = () => refresh().catch((error) => status(error.message));
  for (const [selector, action] of [
    ['[data-library-import]', 'import'],
    ['[data-library-folder]', 'importFolder'],
  ]) {
    $(selector).onclick = async () => {
      try {
        const result = await service()?.[action]?.('Imported FiveM clothing');
        if (result) { await refresh(); toast('Pakaian berhasil diimpor ke Clothing Library.'); }
      } catch (error) { status(error.message); }
    };
  }
  $('[data-library-open]').onclick = async () => {
    if (!selected || !activePack) return;
    try {
      const primary = await assetRead(assetId(selected));
      const files = [new File([primary.data], primary.name)];
      if (primary.companion) {
        const companion = await assetRead(primary.companion.id);
        files.push(new File([companion.data], companion.name));
      }
      await openFile(files);
    } catch (error) { status(error.message); }
  };
  panel.addEventListener('toggle', () => {
    if (panel.open) refresh().catch((error) => status(error.message));
    else { preview.clear(); revision++; }
  });
  return { refresh };
}
