import { openArchive } from './archives.js';
const native = /\.(ymap|ytyp|ydr|ydd|ytd)$/i;
export function mountGtaSettings(dialog) {
  const section = document.createElement('section');
  section.className = 'settings-section';
  section.innerHTML =
    '<h3>Instalasi GTA V</h3><p class="muted">Hubungkan folder game lokal sebagai sumber aset baca saja.</p><input id="gtaInstallPath" readonly aria-label="Folder instalasi GTA V" placeholder="Belum dipilih"><div class="settings-actions"><button id="gtaInstallChoose">Pilih folder</button><button id="gtaInstallReveal">Buka folder</button><button id="gtaInstallScan">Pindai aset</button></div><p id="gtaInstallStatus" role="status"></p><p class="muted">Photo Booth dapat menambahkan resource lepas atau RPF terbuka dari folder ini. RPF terenkripsi dan full-world streaming belum didukung. File game tidak diubah.</p>';
  const layout = dialog.querySelector('.settings-layout');
  layout.insertBefore(section, layout.children[1] || null);
  const $ = (id) => section.querySelector('#' + id);
  async function act(method) {
    const api = window.ditashaGtaInstall;
    if (!api) {
      $('gtaInstallStatus').textContent = 'Tersedia pada aplikasi desktop.';
      return;
    }
    section.querySelectorAll('button').forEach((b) => (b.disabled = true));
    try {
      const state = await api[method]();
      if (state) {
        $('gtaInstallPath').value = state.root || '';
        $('gtaInstallStatus').textContent =
          (state.edition ? state.edition + ' · ' : '') +
          state.message +
          (state.scanned ? ' ' + state.archives + ' RPF · ' + state.maps + ' YMAP lepas.' : '');
      }
    } catch (e) {
      $('gtaInstallStatus').textContent = e.message;
    } finally {
      section.querySelectorAll('button').forEach((b) => (b.disabled = false));
    }
  }
  for (const [id, method] of [
    ['gtaInstallChoose', 'choose'],
    ['gtaInstallScan', 'scan'],
    ['gtaInstallReveal', 'reveal'],
  ])
    $(id).onclick = () => act(method);
  act('state');
}
async function readEntry(api, entry, start = 0, length = entry.size) {
  const chunks = [];
  for (let at = start; at < start + length; at += 1024 ** 2)
    chunks.push(
      new Uint8Array(await api.read(entry.id, at, Math.min(1024 ** 2, start + length - at))),
    );
  return new Blob(chunks).arrayBuffer();
}
export async function installedStudioFiles() {
  const api = window.ditashaGtaInstall;
  if (!api) throw Error('Folder GTA V tersedia pada aplikasi desktop.');
  const catalog = await api.scan();
  const choices = catalog.files.filter((f) => f.kind === 'ymap' || f.kind === 'rpf');
  if (!choices.length) throw Error('Tidak ada YMAP lepas atau RPF dalam instalasi.');
  const dialog = document.createElement('dialog');
  dialog.className = 'studio-dialog';
  dialog.innerHTML =
    '<h2>Studio dari instalasi GTA V</h2><p>Resource lepas atau RPF terbuka. Arsip terenkripsi belum didukung.</p><input type="search" aria-label="Cari map atau arsip" placeholder="Cari lokasi / arsip…"><select size="12" aria-label="Map atau arsip GTA"></select><div class="settings-actions"><button data-open>Tambahkan studio</button><button data-cancel>Batal</button></div>';
  const search = dialog.querySelector('input'),
    select = dialog.querySelector('select');
  function draw() {
    select.replaceChildren(
      ...choices
        .filter((e) => e.path.toLowerCase().includes(search.value.toLowerCase()))
        .map((e) => {
          const o = document.createElement('option');
          o.value = e.id;
          o.textContent = e.path;
          return o;
        }),
    );
    dialog.querySelector('[data-open]').disabled = !select.options.length;
  }
  search.oninput = draw;
  draw();
  document.body.append(dialog);
  const id = await new Promise((resolve) => {
    dialog.oncancel = () => resolve(null);
    dialog.querySelector('[data-cancel]').onclick = () => {
      dialog.close();
      resolve(null);
    };
    dialog.querySelector('[data-open]').onclick = () => {
      const id = select.value;
      dialog.close();
      resolve(id);
    };
    dialog.showModal();
  });
  dialog.remove();
  if (!id) return null;
  const chosen = choices.find((e) => e.id === id);
  let files;
  if (chosen.kind === 'rpf') {
    const remote = {
      name: chosen.path,
      size: chosen.size,
      slice: (start, end) => ({ arrayBuffer: () => readEntry(api, chosen, start, end - start) }),
    };
    const archive = await openArchive(remote),
      entries = archive.entries.filter((e) => !e.directory && native.test(e.name));
    checkBudget(entries);
    files = [];
    for (const e of entries) files.push(new File([await archive.extract(e)], e.name));
  } else {
    const folder = chosen.path.slice(0, chosen.path.lastIndexOf('/') + 1);
    const entries = catalog.files.filter((e) => native.test(e.path) && e.path.startsWith(folder));
    checkBudget(entries);
    files = [];
    for (const e of entries) files.push(new File([await readEntry(api, e)], e.path));
  }
  return files;
}
function checkBudget(entries) {
  if (!entries.some((e) => /\.ymap$/i.test(e.name || e.path)))
    throw Error(
      'Arsip ini tidak memiliki YMAP langsung. Gunakan resource studio atau ekspor lokasi beserta dependensinya.',
    );
  if (
    entries.length > 2000 ||
    entries.reduce((n, e) => n + e.size, 0) > 512 * 1024 ** 2 ||
    entries.some((e) => e.size > (/\.ytd$/i.test(e.name || e.path) ? 256 : 64) * 1024 ** 2)
  )
    throw Error('Lokasi terlalu besar. Ekspor area foto yang lebih kecil (maksimal 512 MB).');
}
