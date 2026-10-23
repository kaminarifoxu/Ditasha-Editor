import {
  buildYmtDocuments,
  buildYmtResource,
  hashValues,
  resourceManifest,
  scanClothing,
  YMT_MAX_BYTES,
} from './ymt-creator.js';
import { zipFiles } from './asset-tools.js';
import { ICON_CODES } from './ui-icons.js';
export function mountFivemTools({ nav, activate, download, toast, confirmDiscard, getPack }) {
  const icon = (name) =>
    `<i class="di-icon" aria-hidden="true" data-icon="${name}" data-glyph="${String.fromCodePoint(parseInt(ICON_CODES[name], 16))}"></i>`;
  const button = document.createElement('button');
  button.dataset.page = 'fivemtools';
  button.innerHTML = icon('tshirt') + '<span>YMT & FiveM Tools</span>';
  button.onclick = () => activate('fivemtools');
  nav.append(button);
  const root = document.createElement('section');
  root.className = 'fivem-tools-workspace';
  root.hidden = true;
  root.setAttribute('aria-label', 'YMT Creator dan FiveM tools');
  root.innerHTML = `<div class="ft-heading"><div><span class="eyebrow">DITASHA / OFFLINE TOOLS</span><h1>YMT & FiveM Tools</h1><p class="muted">Siapkan clothing collection dan resource dari file lokal.</p></div><div class="ft-tabs" role="group" aria-label="Pilih alat"><button data-ft-tab="ymt" aria-pressed="true">YMT Creator</button><button data-ft-tab="hash" aria-pressed="false">Hash calculator</button><button data-ft-tab="manifest" aria-pressed="false">Manifest generator</button></div></div>
  <div data-ft-panel="ymt" class="ft-grid"><aside class="ft-card"><h2>Clothing collection</h2><label>Collection name<input id="ymtCollection" value="ditasha_clothes" maxlength="40"></label><label>Gender tanpa prefix<select id="ymtGender"><option value="m">Male</option><option value="f">Female</option></select></label><p class="muted">Prefix freemode dan folder male/female menentukan gender terlebih dahulu. Indeks per slot harus mulai 000 tanpa celah.</p><div class="ft-actions"><button id="ymtFiles">${icon('plus')} File</button><button id="ymtFolder">${icon('folder-open')} Folder</button><button id="ymtUsePack">Dari Clothing pack</button></div><input id="ymtFileInput" type="file" accept=".ydd,.ytd,.yld" multiple hidden><input id="ymtFolderInput" type="file" webkitdirectory multiple hidden><details><summary>Tempel nama file</summary><label>Satu nama/path per baris<textarea id="ymtNames" rows="5" placeholder="jbib_000_u.ydd&#10;jbib_diff_000_a_uni.ytd"></textarea></label><button id="ymtAddNames">Tambah nama</button><p class="muted">Nama saja mengekspor metadata. ZIP resource memerlukan file asli.</p></details><div class="ft-actions"><button id="ymtUndo" disabled>Undo</button><button id="ymtClear">Kosongkan</button></div><p id="ymtSummary" role="status">Belum ada file.</p><div id="ymtFindings" class="ft-findings" role="status"></div><details><summary>Konversi & batas fitur</summary><p>Hasil YMT adalah XML CodeWalker, bukan binary game. Import XML di CodeWalker RPF Explorer atau YMTEditor, simpan .ymt binary di stream/, lalu uji resource di server development. Mengganti ekstensi saja tidak cukup.</p><p>Freemode male/female, komponen, props, alternative dan YLD. Creature metadata untuk heels/hide-hair dan ped kustom belum dibuat. Data internal model/tekstur tidak diubah. ZIP maksimum 128 MB.</p></details></aside>
  <div class="ft-main"><section class="ft-card"><div class="ft-section-head"><h2>Drawable & texture slots</h2><span id="ymtCount"></span></div><div class="ft-table-scroll"><table><thead><tr><th>File sumber</th><th>Gender / slot</th><th>Output</th><th>Aksi</th></tr></thead><tbody id="ymtRows"></tbody></table></div></section><section class="ft-card"><h2>Export & preview</h2><p class="ft-notice">YMT XML perlu dikonversi ke binary .ymt sebelum digunakan di FiveM.</p><label>File hasil<select id="ymtDocument" aria-label="Preview dokumen hasil"></select></label><textarea id="ymtXml" class="ft-code" rows="11" readonly aria-label="Isi dokumen hasil" spellcheck="false"></textarea><div class="ft-actions"><button id="ymtSaveXml" disabled>Simpan dokumen</button><button id="ymtSaveMetadata" disabled>Metadata ZIP</button><button id="ymtSaveResource" class="primary" disabled>Resource ZIP + XML</button></div><p id="ymtStatus" role="status"></p></section></div></div>
  <section data-ft-panel="hash" class="ft-card ft-utility" hidden><h2>joaat / GetHashKey</h2><label>Model, texture atau collection<input id="ftHashName" value="adder" maxlength="4096" spellcheck="false"></label><p class="muted">Hash dihitung lokal tanpa membedakan huruf besar/kecil.</p><dl id="ftHashResults"></dl></section>
  <section data-ft-panel="manifest" class="ft-card ft-utility" hidden><h2>fxmanifest.lua generator</h2><p class="muted">Satu path per baris. Untuk collection clothing, gunakan metadata dan manifest dari YMT Creator.</p><div class="ft-manifest-fields"><label>Client scripts<textarea id="ftClient" rows="3" spellcheck="false">client.lua</textarea></label><label>Server scripts<textarea id="ftServer" rows="3" spellcheck="false">server.lua</textarea></label><label>Shared scripts<textarea id="ftShared" rows="3" spellcheck="false"></textarea></label><label>Dependencies<textarea id="ftDependencies" rows="3" spellcheck="false"></textarea></label></div><label>NUI page (opsional)<input id="ftNui" placeholder="html/index.html"></label><textarea id="ftManifest" class="ft-code" rows="12" readonly aria-label="Preview fxmanifest.lua"></textarea><button id="ftSaveManifest" class="primary">Simpan fxmanifest.lua</button><p id="ftManifestStatus" role="status"></p></section>`;
  nav.after(root);
  const $ = (id) => root.querySelector('#' + id);
  let entries = [],
    history = [],
    docs = [],
    plan = null,
    revision = 0,
    saved = 0,
    busy = false;
  const updateDocument = () => {
    $('ymtXml').value = docs[Number($('ymtDocument').value)]?.data || '';
  };
  const refresh = () => {
    docs = [];
    plan = null;
    $('ymtRows').replaceChildren();
    $('ymtFindings').replaceChildren();
    $('ymtDocument').replaceChildren();
    let messages = [];
    try {
      plan = scanClothing(entries, {
        collection: $('ymtCollection').value,
        gender: $('ymtGender').value,
      });
      messages = [...plan.errors, ...plan.warnings];
      if (!plan.errors.length) docs = buildYmtDocuments(plan);
      $('ymtSummary').textContent =
        `${plan.groups.length} drawable · ${plan.files.filter((f) => f.kind === 'texture').length} texture variant · ${plan.errors.length} masalah`;
    } catch (e) {
      messages = [e.message];
      $('ymtSummary').textContent = 'Tambahkan file atau perbaiki pengaturan.';
    }
    messages.slice(0, 100).forEach((text) => {
      const p = document.createElement('p');
      p.textContent = text;
      $('ymtFindings').append(p);
    });
    entries.forEach((entry, index) => {
      const item = plan?.files.find((f) => f.entry === entry),
        tr = document.createElement('tr');
      for (const text of [
        entry.path,
        item
          ? `${item.sex === 'f' ? 'Female' : 'Male'} / ${item.slot} ${String(item.index).padStart(3, '0')}`
          : 'Periksa nama',
        item?.output || '—',
      ]) {
        const td = document.createElement('td');
        td.textContent = text;
        td.title = text;
        tr.append(td);
      }
      const td = document.createElement('td'),
        remove = document.createElement('button');
      remove.textContent = '×';
      remove.title = 'Hapus ' + entry.path;
      remove.setAttribute('aria-label', remove.title);
      remove.disabled = busy;
      remove.onclick = () => {
        remember();
        entries.splice(index, 1);
        changed();
      };
      td.append(remove);
      tr.append(td);
      $('ymtRows').append(tr);
    });
    docs.forEach((doc, i) => {
      const option = document.createElement('option');
      option.value = String(i);
      option.textContent = doc.name;
      $('ymtDocument').append(option);
    });
    updateDocument();
    $('ymtCount').textContent = entries.length + ' file';
    for (const id of ['ymtSaveXml', 'ymtSaveMetadata']) $(id).disabled = busy || !docs.length;
    $('ymtSaveResource').disabled =
      busy || !docs.length || plan.files.some((f) => !f.entry.file && !f.entry.data);
    $('ymtUndo').disabled = busy || !history.length;
  };
  const remember = () => {
    history.push(entries.slice());
    if (history.length > 8) history.shift();
  };
  const changed = () => {
    revision++;
    $('ymtStatus').textContent = 'Perubahan metadata belum diekspor.';
    refresh();
  };
  const add = (items) => {
    if (busy) return;
    if (entries.length + items.length > 5000) return toast('Maksimum 5.000 file.');
    remember();
    entries.push(...items);
    changed();
  };
  const addFiles = (files) => {
    const items = Array.from(files)
      .filter((f) => /\.(ydd|ytd|yld)$/i.test(f.name))
      .map((file) => ({ path: file.webkitRelativePath || file.name, file }));
    if (!items.length) return toast('Pilih YDD/YTD/YLD.');
    add(items);
  };
  for (const [button, input] of [
    ['ymtFiles', 'ymtFileInput'],
    ['ymtFolder', 'ymtFolderInput'],
  ]) {
    $(button).onclick = () => $(input).click();
    $(input).onchange = () => {
      addFiles($(input).files);
      $(input).value = '';
    };
  }
  $('ymtUsePack').onclick = () => {
    const items = getPack();
    if (!items.length) return toast('Tambahkan file di Clothing pack dahulu.');
    add(
      items
        .filter((e) => /\.(ydd|ytd|yld)$/i.test(e.path))
        .map((e) => ({ path: e.path, data: e.data })),
    );
  };
  $('ymtAddNames').onclick = () => {
    const text = $('ymtNames').value;
    if (text.length > 1024 * 1024) return toast('Daftar nama maksimum 1 MB.');
    const names = text
      .split(/\r?\n/)
      .map((p) => p.trim())
      .filter(Boolean);
    if (names.length) {
      add(names.map((path) => ({ path })));
      $('ymtNames').value = '';
    }
  };
  $('ymtUndo').onclick = () => {
    if (busy || !history.length) return;
    entries = history.pop();
    changed();
  };
  $('ymtClear').onclick = async () => {
    if (busy) return;
    if (
      entries.length &&
      revision !== saved &&
      !(await confirmDiscard([{ name: 'YMT Creator · ' + $('ymtCollection').value }]))
    )
      return;
    remember();
    entries = [];
    changed();
  };
  $('ymtCollection').oninput = $('ymtGender').onchange = changed;
  $('ymtDocument').onchange = updateDocument;
  const save = async (kind) => {
    if (busy || !plan || !docs.length) return;
    busy = true;
    root.querySelectorAll('input,select,button,textarea').forEach((e) => (e.disabled = true));
    try {
      const doc = docs[Number($('ymtDocument').value)],
        collection = plan.collection;
      const data =
        kind === 'resource'
          ? await buildYmtResource(plan)
          : kind === 'metadata'
            ? zipFiles(
                docs.map((d) => ({ name: collection + '/' + d.name, data: d.data })),
                { maxBytes: YMT_MAX_BYTES },
              )
            : doc.data;
      const name =
        kind === 'document'
          ? doc.name.split('/').at(-1)
          : collection + (kind === 'resource' ? '-resource-XML.zip' : '-metadata-XML.zip');
      if (await download(data, name, kind === 'document' ? 'text/plain' : 'application/zip')) {
        if (kind !== 'document') saved = revision;
        $('ymtStatus').textContent =
          'Tersimpan: ' + name + ' · YMT XML tetap perlu konversi binary.';
      } else $('ymtStatus').textContent = 'Penyimpanan dibatalkan.';
    } catch (e) {
      $('ymtStatus').textContent = e.message;
      toast(e.message);
    } finally {
      busy = false;
      root.querySelectorAll('input,select,button,textarea').forEach((e) => (e.disabled = false));
      refresh();
      updateManifest();
    }
  };
  $('ymtSaveXml').onclick = () => save('document');
  $('ymtSaveMetadata').onclick = () => save('metadata');
  $('ymtSaveResource').onclick = () => save('resource');
  for (const button of root.querySelectorAll('[data-ft-tab]'))
    button.onclick = () => {
      if (busy) return;
      const tab = button.dataset.ftTab;
      root
        .querySelectorAll('[data-ft-tab]')
        .forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.ftTab === tab)));
      root
        .querySelectorAll('[data-ft-panel]')
        .forEach((p) => (p.hidden = p.dataset.ftPanel !== tab));
    };
  const updateHash = () => {
    const result = hashValues($('ftHashName').value);
    $('ftHashResults').replaceChildren();
    for (const [key, label] of [
      ['unsigned', 'Unsigned'],
      ['signed', 'Signed'],
      ['hex', 'Hex'],
    ]) {
      const dt = document.createElement('dt'),
        dd = document.createElement('dd');
      dt.textContent = label;
      dd.textContent = String(result[key]);
      $('ftHashResults').append(dt, dd);
    }
  };
  $('ftHashName').oninput = updateHash;
  updateHash();
  const updateManifest = () => {
    try {
      $('ftManifest').value = resourceManifest({
        client: $('ftClient').value,
        server: $('ftServer').value,
        shared: $('ftShared').value,
        dependencies: $('ftDependencies').value,
        nui: $('ftNui').value,
      });
      $('ftSaveManifest').disabled = false;
      $('ftManifestStatus').textContent = '';
    } catch (e) {
      $('ftManifest').value = '';
      $('ftSaveManifest').disabled = true;
      $('ftManifestStatus').textContent = e.message;
    }
  };
  for (const id of ['ftClient', 'ftServer', 'ftShared', 'ftDependencies', 'ftNui'])
    $(id).oninput = updateManifest;
  $('ftSaveManifest').onclick = async () => {
    try {
      const ok = await download($('ftManifest').value, 'fxmanifest.lua', 'text/plain');
      $('ftManifestStatus').textContent = ok ? 'Manifest tersimpan.' : 'Penyimpanan dibatalkan.';
    } catch (e) {
      toast(e.message);
    }
  };
  updateManifest();
  refresh();
  root.addEventListener('dragover', (e) => {
    if (e.dataTransfer?.types.includes('Files')) e.preventDefault();
  });
  root.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!busy) addFiles(e.dataTransfer.files);
  });
  return {
    root,
    unsavedItems: () =>
      entries.length && revision !== saved
        ? [{ name: 'YMT Creator · ' + $('ymtCollection').value }]
        : [],
  };
}
