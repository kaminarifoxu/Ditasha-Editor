import { folderArchive, sortEntries, hexPage } from './explorer.js';
import { openArchive, writeRpf } from './archives.js';
import { safePath, zipFiles, MAX_EXPORT } from './asset-tools.js';
export function mountArchives({
  nav,
  download,
  toast,
  preview,
  confirmDiscard,
  activate,
  viewers,
}) {
  const $ = (id) => document.getElementById(id),
    button = document.createElement('button');
  button.dataset.page = 'archives';
  button.innerHTML =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h7l2 2h9v12H3Z"/><path d="M12 11v6m-3-3h6"/></svg>GTA V Explorer';
  nav.append(button);
  const root = document.createElement('section');
  root.className = 'archive-workspace';
  root.hidden = true;
  nav.after(root);
  root.innerHTML = `
 <aside class="tool-sidebar"><span class="eyebrow">ARCHIVE EXPLORER</span><h2>GTA V Explorer</h2><p class="muted">Browse, extract and edit GTA V archives locally.</p><button id="archiveOpen" class="primary">Open archive</button><div class="viewer-button-row"><button id="archiveOpenFolder">Open folder</button><button id="archiveNew">New RPF</button></div><input id="archiveFolderInput" type="file" webkitdirectory multiple hidden><label class="check"><input id="archiveEdit" type="checkbox" checked>Edit archive</label><input id="archiveInput" type="file" accept=".rpf,.oiv,.zip" hidden><input id="archiveReplacement" type="file" hidden><input id="archiveAddInput" type="file" multiple hidden><input id="archiveSearch" class="search" placeholder="Search paths…" aria-label="Search archive"><label>Sort by<select id="archiveSort"><option value="name">Name</option><option value="type">Type</option><option value="size">Size</option></select></label><label class="check"><input id="archiveDescending" type="checkbox">Descending</label><div id="archiveFolders"></div><div class="tool-bottom"><p class="muted">RPF7: OPEN / unencrypted. OIV & ZIP: Stored / Deflate. Extraction and rebuilt archives: up to 128 MB.</p></div></aside>
 <section class="archive-center"><div class="archive-toolbar"><div><span class="eyebrow" id="archiveKind">DITASHA WORKSHOP</span><h2 id="archiveTitle">Open an archive</h2></div><button id="archiveBack" disabled>← Parent archive</button></div><p id="archiveCount" class="muted">Drop an RPF, OIV or ZIP here.</p><div id="archiveEmpty" class="empty"><div class="empty-symbol"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h7l2 2h9v12H3Z"/><path d="M12 11v6m-3-3h6"/></svg></div><h3>Your game assets, in one place</h3><p>Explore folders, open nested RPF files, preview textures and models, or export edited archives.</p></div><div class="archive-table-wrap"><table id="archiveTable" hidden><thead><tr><th scope="col">Path</th><th scope="col">Type</th><th scope="col">Size</th></tr></thead><tbody id="archiveEntries"></tbody></table></div></section>
 <aside class="tool-details"><span class="eyebrow">SELECTION</span><h2 id="archiveSelected">No file selected</h2><p id="archiveDetail" class="muted">Select a file to extract, preview or replace it.</p><div class="archive-actions"><button id="archivePreview" disabled>Open in editor</button><button id="archiveTextureViewer" disabled>Texture viewer</button><button id="archiveModelViewer" disabled>Model viewer</button><button id="archiveInspect" disabled>View text / hex</button><button id="archiveCopyName" disabled>Copy name</button><button id="archiveCopyPath" disabled>Copy path</button><button id="archiveNested" disabled>Browse nested RPF</button><button id="archiveExtract" disabled>Extract file</button><button id="archiveReplace" disabled>Replace file…</button><button id="archiveRemove" disabled>Remove file</button><button id="archiveAdd" disabled>Add files…</button></div><section id="archivePackage" hidden><h3>OIV package</h3><p id="archiveMetadata"></p><pre id="archiveManifest"></pre><p class="muted">Installation instructions are displayed for inspection. Exporting preserves assembly.xml; update its paths when changing package contents.</p></section><div class="tool-bottom"><p id="archiveStatus" role="status">Ready.</p><button id="archiveExport" class="primary" disabled>Save archive copy</button><button id="archiveExtractAll" disabled>Extract all (ZIP)</button></div></aside>`;
  const inspector = document.createElement('dialog');
  inspector.id = 'archiveInspector';
  inspector.innerHTML =
    '<span class="eyebrow">FILE INSPECTOR</span><h2 id="inspectorTitle"></h2><div class="viewer-button-row"><button id="inspectorText">Text</button><button id="inspectorHex">Hex</button><button id="inspectorPrevious">← Previous</button><button id="inspectorNext">Next →</button></div><p id="inspectorInfo" class="muted"></p><pre id="inspectorContent"></pre><button id="inspectorClose">Close</button>';
  document.body.append(inspector);
  let inspectData = new Uint8Array(),
    inspectOffset = 0,
    inspectMode = 'hex';
  let state = null,
    stack = [],
    selection = null,
    busy = false,
    folder = '',
    revision = 0,
    saved = 0;
  const dirty = () => revision !== saved,
    items = () => [
      ...(dirty() ? [{ name: 'Archive · ' + state.archive.name }] : []),
      ...stack
        .filter((s) => s.revision !== s.saved)
        .map((s) => ({ name: 'Archive · ' + s.state.archive.name })),
    ];
  const list = () =>
    state?.archive.entries.filter((e) => !e.directory && !state.removed.has(e.name)) || [];
  const extract = async (e) => state.replacements.get(e.name) || (await state.archive.extract(e));
  function lock(on) {
    busy = on;
    root.querySelectorAll('button,input').forEach((e) => (e.disabled = on));
    nav.querySelectorAll('button').forEach((e) => (e.disabled = on));
    if (!on) render();
  }
  async function run(task) {
    if (busy) return;
    lock(true);
    try {
      await task();
    } catch (e) {
      $('archiveStatus').textContent = e.message;
      toast(e.message);
    } finally {
      lock(false);
    }
  }
  function render() {
    const files = list(),
      q = $('archiveSearch').value.toLowerCase();
    $('archiveTitle').textContent = state?.archive.name || 'Open an archive';
    $('archiveKind').textContent = state?.archive.kind || 'DITASHA WORKSHOP';
    $('archiveCount').textContent = state
      ? files.length + ' files · ' + (dirty() ? 'Changes not exported' : 'Archive ready')
      : 'Drop an RPF, OIV or ZIP here.';
    $('archiveEmpty').hidden = !!state;
    $('archiveTable').hidden = !state;
    $('archiveBack').disabled = !stack.length;
    $('archiveExport').disabled = $('archiveExtractAll').disabled = !files.length;
    $('archiveAdd').disabled =
      !state || state.archive.kind === 'Folder' || !$('archiveEdit').checked;
    $('archiveEdit').disabled = !state || state.archive.kind === 'Folder';
    $('archiveExport').disabled =
      !state || state.archive.kind === 'Folder' || (!files.length && state.archive.kind !== 'RPF7');
    $('archiveFolders').replaceChildren();
    const paths = new Set(['']);
    for (const e of files) {
      const parts = e.name.split('/');
      parts.pop();
      while (parts.length) {
        paths.add(parts.join('/') + '/');
        parts.pop();
      }
    }
    for (const path of [...paths].sort()) {
      const b = document.createElement('button');
      b.className = 'archive-folder' + (folder === path ? ' selected' : '');
      b.textContent = path || 'All files';
      b.onclick = () => {
        folder = path;
        render();
      };
      $('archiveFolders').append(b);
    }
    $('archiveEntries').replaceChildren();
    for (const e of sortEntries(
      files.filter((e) => e.name.startsWith(folder) && e.name.toLowerCase().includes(q)),
      $('archiveSort').value,
      $('archiveDescending').checked,
    )) {
      const row = document.createElement('tr');
      row.classList.toggle('selected', selection === e);
      const cell = document.createElement('td'),
        b = document.createElement('button');
      b.textContent = e.name;
      b.title = e.name;
      b.onclick = () => {
        selection = e;
        render();
      };
      b.ondblclick = () => {
        selection = e;
        if (/\.rpf$/i.test(e.name)) $('archiveNested').click();
        else if (/\.(yft|ydd|ydr)$/i.test(e.name)) $('archiveModelViewer').click();
        else if (/\.(ytd|dds|png|jpg|jpeg|webp)$/i.test(e.name)) $('archiveTextureViewer').click();
        else $('archiveInspect').click();
      };
      cell.append(b);
      const type = document.createElement('td');
      type.textContent = e.encrypted ? 'Encrypted' : e.name.split('.').at(-1).toUpperCase();
      const size = document.createElement('td');
      size.textContent =
        ((state.replacements.get(e.name)?.length || e.size) / 1024).toFixed(1) + ' KB';
      row.append(cell, type, size);
      $('archiveEntries').append(row);
    }
    const e = selection,
      editable = e && !e.encrypted;
    $('archiveSelected').textContent = e?.name.split('/').at(-1) || 'No file selected';
    $('archiveDetail').textContent = e
      ? e.name + (state.replacements.has(e.name) ? ' · Modified' : '')
      : 'Select a file to extract, preview or replace it.';
    $('archiveExtract').disabled = !editable;
    for (const id of ['archiveReplace', 'archiveRemove'])
      $(id).disabled = !editable || state.archive.kind === 'Folder' || !$('archiveEdit').checked;
    for (const id of ['archiveInspect', 'archiveCopyName', 'archiveCopyPath'])
      $(id).disabled = !editable;
    $('archiveTextureViewer').disabled =
      !editable || !/\.(ytd|dds|png|jpg|jpeg|webp)$/i.test(e.name);
    $('archiveModelViewer').disabled = !editable || !/\.(yft|ydd|ydr)$/i.test(e.name);
    $('archivePreview').disabled =
      !editable || !/\.(ytd|ydd|ydr|yft|dds|png|jpg|jpeg|webp|glb)$/i.test(e.name);
    $('archiveNested').disabled = !editable || !/\.rpf$/i.test(e.name);
  }
  async function packageInfo() {
    const manifest =
      state.archive.kind === 'OIV'
        ? list().find((e) => e.name.toLowerCase() === 'assembly.xml')
        : null;
    $('archivePackage').hidden = !manifest;
    $('archiveMetadata').textContent = '';
    $('archiveManifest').textContent = '';
    if (!manifest) {
      if (state.archive.kind === 'OIV')
        $('archiveStatus').textContent =
          'OIV has no assembly.xml; package cannot be installed by OpenIV.';
      return;
    }
    if ((state.replacements.get(manifest.name)?.length ?? manifest.size) > 1048576) {
      $('archiveMetadata').textContent = 'Manifest is too large to display (limit: 1 MB).';
      return;
    }
    const source = new TextDecoder().decode(await extract(manifest));
    const xml = new DOMParser().parseFromString(source, 'application/xml');
    if (xml.querySelector('parsererror') || xml.documentElement.tagName !== 'package') {
      $('archiveMetadata').textContent = 'Invalid assembly.xml.';
      return;
    }
    $('archiveMetadata').textContent = [
      xml.querySelector('metadata > name')?.textContent,
      xml.querySelector('author > displayName')?.textContent,
      'Target: ' + xml.documentElement.getAttribute('target'),
      'Format: ' + xml.documentElement.getAttribute('version'),
    ]
      .filter(Boolean)
      .join(' · ');
    $('archiveManifest').textContent =
      xml.querySelector('content')?.outerHTML || 'No installation instructions.';
  }
  async function load(file, nested = false) {
    if (!nested && items().length && (await confirmDiscard('archive', items())) !== 'discard')
      return;
    const archive = Array.isArray(file) ? folderArchive(file) : await openArchive(file, file.name);
    if (nested) {
      stack.push({ state, revision, saved, folder });
    } else stack = [];
    state = { archive, replacements: new Map(), removed: new Set() };
    selection = null;
    folder = '';
    revision = saved = 0;
    $('archiveSearch').value = '';
    $('archiveStatus').textContent = nested
      ? 'Nested archive opened. Export edits separately, then replace the RPF in its parent.'
      : 'Archive opened.';
    render();
    await packageInfo();
  }
  document.getElementById('open').addEventListener(
    'click',
    (e) => {
      if (root.hidden) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      $('archiveInput').click();
    },
    true,
  );
  button.onclick = () => activate('archives');
  $('archiveOpen').onclick = () => $('archiveInput').click();
  $('archiveInput').onchange = (e) => {
    const f = e.target.files[0];
    if (f) run(() => load(f));
    e.target.value = '';
  };
  $('archiveSearch').oninput =
    $('archiveSort').onchange =
    $('archiveDescending').onchange =
    $('archiveEdit').onchange =
      render;
  $('archiveOpenFolder').onclick = () => $('archiveFolderInput').click();
  $('archiveFolderInput').onchange = (e) => {
    const files = [...e.target.files];
    if (files.length) run(() => load(files));
    e.target.value = '';
  };
  $('archiveNew').onclick = () =>
    run(async () => {
      if (items().length && (await confirmDiscard('archive', items())) !== 'discard') return;
      state = {
        archive: {
          name: 'untitled.rpf',
          kind: 'RPF7',
          entries: [],
          extract: async () => {
            throw Error('Add files first.');
          },
        },
        replacements: new Map(),
        removed: new Set(),
      };
      stack = [];
      selection = null;
      folder = '';
      revision = 1;
      saved = 0;
      $('archiveEdit').checked = true;
      $('archiveStatus').textContent = 'New OPEN RPF7. Add files, then save your archive.';
      await packageInfo();
    });
  $('archiveBack').onclick = () =>
    run(async () => {
      if (dirty() && (await confirmDiscard('archive', items())) !== 'discard') return;
      const previous = stack.pop();
      ({ state, revision, saved, folder } = previous);
      selection = null;
      $('archiveStatus').textContent = 'Parent archive restored.';
      await packageInfo();
    });
  $('archiveExtract').onclick = () =>
    run(async () => {
      $('archiveStatus').textContent = (await download(
        await extract(selection),
        selection.name.split('/').at(-1),
        'application/octet-stream',
      ))
        ? 'File extracted.'
        : 'Save canceled.';
    });
  $('archivePreview').onclick = () =>
    run(async () => {
      const chosen = selection,
        pair = /\.(ydd|ydr|yft)$/i.test(chosen.name)
          ? list().find(
              (e) => e.name.toLowerCase() === chosen.name.replace(/\.[^.]+$/, '.ytd').toLowerCase(),
            )
          : null;
      const files = [];
      for (const e of [chosen, ...(pair ? [pair] : [])]) {
        const data = await extract(e);
        if (data.length > 64 * 1024 * 1024) throw Error('Editor file limit is 64 MB.');
        files.push(new File([data], e.name.split('/').at(-1)));
      }
      await preview(files);
      lock(false);
      activate('editor');
      toast(
        'Asset opened in Texture & Model. Export edits there, then use Replace file in Archive.',
      );
    });
  $('archiveNested').onclick = () =>
    run(async () => {
      const source = selection.file || selection.source;
      if (source) await load(new File([source], selection.name.split('/').at(-1)), true);
      else {
        const data = await extract(selection);
        await load(new File([data], selection.name.split('/').at(-1)), true);
      }
    });
  async function viewerFiles() {
    const selected = selection;
    const paired = /\.(ydd|ydr|yft)$/i.test(selected.name)
      ? list().find(
          (e) => e.name.toLowerCase() === selected.name.replace(/\.[^.]+$/, '.ytd').toLowerCase(),
        )
      : null;
    const files = [];
    for (const e of [selected, ...(paired ? [paired] : [])]) {
      if (e.size > 64 * 1024 * 1024) throw Error('Viewer file limit: 64 MB.');
      files.push(new File([await extract(e)], e.name.split('/').at(-1)));
    }
    return files;
  }
  $('archiveTextureViewer').onclick = () =>
    run(async () => {
      const files = await viewerFiles();
      lock(false);
      await viewers.openTextures(files);
    });
  $('archiveModelViewer').onclick = () =>
    run(async () => {
      const files = await viewerFiles();
      lock(false);
      await viewers.openModels(files);
    });
  function inspect() {
    if (inspectMode === 'text') {
      try {
        $('inspectorContent').textContent = new TextDecoder('utf-8', { fatal: true }).decode(
          inspectData.subarray(0, 262144),
        );
        $('inspectorInfo').textContent =
          'UTF-8 preview · first ' + Math.min(inspectData.length, 262144) + ' bytes.';
      } catch {
        $('inspectorContent').textContent =
          'This file is not UTF-8 text. Choose Hex to inspect binary data.';
      }
    } else {
      $('inspectorContent').textContent = hexPage(inspectData, inspectOffset);
      $('inspectorInfo').textContent =
        'Hex bytes ' +
        inspectOffset +
        '–' +
        Math.min(inspectOffset + 4096, inspectData.length) +
        ' of ' +
        inspectData.length +
        ' preview bytes.';
    }
    $('inspectorPrevious').disabled = inspectMode !== 'hex' || inspectOffset === 0;
    $('inspectorNext').disabled =
      inspectMode !== 'hex' || inspectOffset + 4096 >= inspectData.length;
  }
  $('archiveInspect').onclick = () =>
    run(async () => {
      if (selection.file)
        inspectData = new Uint8Array(await selection.file.slice(0, 1048576).arrayBuffer());
      else {
        if (selection.size > 64 * 1024 * 1024)
          throw Error('Archive inspection limit: 64 MB. Extract this file separately.');
        inspectData = (await extract(selection)).subarray(0, 1048576);
      }
      inspectOffset = 0;
      inspectMode = /\.(xml|meta|txt|json|lua|cfg|ini|csv)$/i.test(selection.name) ? 'text' : 'hex';
      $('inspectorTitle').textContent = selection.name;
      inspect();
      inspector.showModal();
    });
  $('inspectorText').onclick = () => {
    inspectMode = 'text';
    inspect();
  };
  $('inspectorHex').onclick = () => {
    inspectMode = 'hex';
    inspect();
  };
  $('inspectorPrevious').onclick = () => {
    inspectOffset = Math.max(0, inspectOffset - 4096);
    inspect();
  };
  $('inspectorNext').onclick = () => {
    inspectOffset += 4096;
    inspect();
  };
  $('inspectorClose').onclick = () => inspector.close();
  for (const [id, path] of [
    ['archiveCopyName', false],
    ['archiveCopyPath', true],
  ])
    $(id).onclick = () =>
      run(async () => {
        await navigator.clipboard.writeText(
          path ? selection.name : selection.name.split('/').at(-1),
        );
        $('archiveStatus').textContent = 'Copied to clipboard.';
      });
  $('archiveReplace').onclick = () => $('archiveReplacement').click();
  $('archiveReplacement').onchange = (e) => {
    const file = e.target.files[0];
    if (file)
      run(async () => {
        if (file.size > 64 * 1024 * 1024) throw Error('Replacement limit: 64 MB.');
        const previous = selection.name.split('.').at(-1).toLowerCase();
        if (file.name.split('.').at(-1).toLowerCase() !== previous)
          throw Error('Replacement must have the same extension.');
        if (
          [...state.replacements].reduce(
            (n, [path, data]) => n + (path === selection.name ? 0 : data.length),
            0,
          ) +
            file.size >
          MAX_EXPORT
        )
          throw Error('Edited file data limit: 128 MB.');
        state.replacements.set(selection.name, new Uint8Array(await file.arrayBuffer()));
        revision++;
        $('archiveStatus').textContent = 'File replaced in workspace. Export to save.';
        await packageInfo();
      });
    e.target.value = '';
  };
  $('archiveRemove').onclick = () =>
    run(async () => {
      if (!selection) return;
      state.removed.add(selection.name);
      state.replacements.delete(selection.name);
      selection = null;
      revision++;
      $('archiveStatus').textContent = 'File removed from workspace. Export to save.';
      await packageInfo();
    });
  $('archiveAdd').onclick = () => $('archiveAddInput').click();
  $('archiveAddInput').onchange = (e) => {
    const files = [...e.target.files];
    run(async () => {
      for (const file of files) {
        if (state.archive.entries.length >= 65534) throw Error('Archive entry limit reached.');
        if (
          [...state.replacements.values()].reduce((n, data) => n + data.length, 0) + file.size >
          MAX_EXPORT
        )
          throw Error('Edited file data limit: 128 MB.');
        const path = safePath(folder + file.name);
        if (list().some((e) => e.name.toLowerCase() === path.toLowerCase()))
          throw Error('Existing path: ' + path + '; use Replace file.');
        if (file.size > 64 * 1024 * 1024) throw Error('Added file limit: 64 MB.');
        const data = new Uint8Array(await file.arrayBuffer());
        state.archive.entries.push({ name: path, size: data.length, encrypted: false });
        state.replacements.set(path, data);
        state.removed.delete(path);
        revision++;
      }
      $('archiveStatus').textContent = 'Files added. Export to save.';
      await packageInfo();
    });
    e.target.value = '';
  };
  async function gather() {
    const out = [];
    let total = 0;
    for (const e of list()) {
      const declared = state.replacements.get(e.name)?.length ?? e.size;
      total += declared;
      if (total > MAX_EXPORT - 1048576)
        throw Error('Export limit: 128 MB. Extract individual files instead.');
      $('archiveStatus').textContent = 'Reading ' + (out.length + 1) + ' / ' + list().length + '…';
      await new Promise((r) => setTimeout(r, 0));
      out.push({ name: e.name, data: await extract(e) });
    }
    return out;
  }
  $('archiveExport').onclick = () =>
    run(async () => {
      const entries = await gather(),
        rpf = state.archive.kind === 'RPF7',
        data = rpf ? writeRpf(entries) : zipFiles(entries),
        name =
          state.archive.name.replace(/\.[^.]+$/, '') +
          '-edited.' +
          (rpf ? 'rpf' : state.archive.kind === 'OIV' ? 'oiv' : 'zip');
      const success = await download(data, name, 'application/octet-stream');
      if (success) saved = revision;
      $('archiveStatus').textContent = success
        ? 'Archive copy saved.'
        : 'Save canceled; changes remain unsaved.';
    });
  $('archiveExtractAll').onclick = () =>
    run(async () => {
      const data = zipFiles(await gather());
      $('archiveStatus').textContent = (await download(
        data,
        state.archive.name.replace(/\.[^.]+$/, '') + '-extracted.zip',
        'application/zip',
      ))
        ? 'Extracted ZIP saved.'
        : 'Save canceled.';
    });
  document.addEventListener(
    'drop',
    (e) => {
      if (root.hidden) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      $('drop').classList.remove('drag');
      const files = [...e.dataTransfer.files];
      if (files.length !== 1) {
        toast('Drop one RPF, OIV or ZIP archive.');
        return;
      }
      run(() => load(files[0]));
    },
    true,
  );
  return { root, unsavedItems: items };
}
