import { planPedFiles, packagePedFiles } from './ped-files.js';
export function mountPedFiles({ container, openModels, download, toast }) {
  const root = document.createElement('details');
  root.className = 'ped-files';
  root.innerHTML = `<summary>Ped files · YDD / YFT / YTD / YMT</summary><div class="viewer-button-row"><button data-import>Import ped files</button><button data-export disabled>Save source bundle</button></div><input data-input type="file" accept=".ydd,.yft,.ytd,.ymt" multiple hidden><ul data-files></ul><p class="muted" data-status role="status">Import komponen ped bersama tekstur dan metadata. YMT dan skeleton YFT pendamping dipertahankan utuh; preview komponen YDD bersifat statis. Bundle berisi file yang diimpor, bukan hasil auto-rig atau perubahan tekstur.</p>`;
  container.prepend(root);
  const input = root.querySelector('[data-input]'),
    save = root.querySelector('[data-export]'),
    list = root.querySelector('[data-files]'),
    status = root.querySelector('[data-status]');
  let plan = null,
    busy = false;
  root.querySelector('[data-import]').onclick = () => input.click();
  input.onchange = async () => {
    const files = [...input.files];
    input.value = '';
    if (!files.length || busy) return;
    busy = true;
    try {
      const next = planPedFiles(files);
      if (!(await openModels(next.preview, { ped: true }))) return;
      plan = next;
      list.replaceChildren();
      for (const entry of plan.entries) {
        const item = document.createElement('li');
        item.textContent =
          entry.name +
          (entry.extension === 'ymt'
            ? ' · metadata asli'
            : entry.extension === 'yft' && plan.entries.some((e) => e.extension === 'ydd')
              ? ' · skeleton asli'
              : '');
        list.append(item);
      }
      root.open = true;
      save.disabled = false;
      status.textContent = `${plan.entries.length} file · ${(plan.total / 1048576).toFixed(1)} MB · komponen model ditampilkan bersama. YMT/skeleton pendamping disimpan utuh, belum diedit.`;
    } catch (error) {
      toast(error.message);
      status.textContent = error.message;
    } finally {
      busy = false;
    }
  };
  save.onclick = async () => {
    if (!plan || busy) return;
    busy = true;
    save.disabled = true;
    try {
      await download(await packagePedFiles(plan), 'ditasha-ped-sources.zip', 'application/zip');
    } catch (error) {
      toast(error.message);
    } finally {
      busy = false;
      save.disabled = !plan;
    }
  };
  return { root };
}
