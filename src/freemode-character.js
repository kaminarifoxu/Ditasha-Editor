export const FREEMODE_PARTS = [
  ['head', 'Kepala', 0, 'ped', 'ped'],
  ['hair', 'Rambut', 2, 'accessory', 'hair'],
  ['uppr', 'Torso / tangan', 3, 'clothing', 'torso'],
  ['lowr', 'Celana / kaki', 4, 'clothing', 'pants'],
  ['feet', 'Sepatu', 6, 'clothing', 'shoes'],
  ['accs', 'Kaos dalam', 8, 'clothing', 'undershirt'],
  ['jbib', 'Baju / jaket', 11, 'clothing', 'tops'],
  ['teef', 'Gigi / mata', 7, 'accessory', 'jewelry'],
];
export function freemodePart(file) {
  const path = file.webkitRelativePath || file.name;
  const match = file.name.match(
    /(?:\^|\/|^)(head|hair|uppr|lowr|feet|accs|jbib|teef)_(?:diff_)?(\d{3})_([^.]*)\.(ydd|ytd|glb)$/i,
  );
  if (!match) return null;
  return {
    file,
    part: match[1].toLowerCase(),
    drawable: Number(match[2]),
    texture: match[4].toLowerCase() === 'ytd',
    gender: /mp_f_freemode/i.test(path) ? 'female' : /mp_m_freemode/i.test(path) ? 'male' : null,
  };
}
export function validateAppearance(value) {
  const data = typeof value === 'string' ? JSON.parse(value) : value;
  if (
    !data ||
    typeof data !== 'object' ||
    !['mp_m_freemode_01', 'mp_f_freemode_01'].includes(data.model) ||
    !Array.isArray(data.components) ||
    data.components.length > 20
  )
    throw Error(
      'JSON appearance harus model freemode dan daftar components dari illenium/fivem-appearance.',
    );
  for (const component of data.components)
    if (
      !Number.isInteger(component.component_id) ||
      component.component_id < 0 ||
      component.component_id > 11 ||
      !Number.isInteger(component.drawable) ||
      component.drawable < 0 ||
      component.drawable > 999 ||
      !Number.isInteger(component.texture) ||
      component.texture < 0 ||
      component.texture > 255
    )
      throw Error('Nomor komponen appearance tidak valid.');
  return data;
}
export function mountFreemodeCharacter({ container, guard, importFiles, setStatus }) {
  const root = document.createElement('details');
  root.className = 'pb-freemode-character';
  root.innerHTML = `<summary>Karakter freemode · kepala & rambut</summary><p class="muted">Buat karakter tanpa add-on ped dari komponen freemode YDD + YTD lokal. Gunakan folder hasil ekspor GTA/FiveM, bukan arsip RPF terenkripsi.</p><label>Freemode<select data-gender><option value="male">Laki-laki</option><option value="female">Perempuan</option></select></label><button data-folder>+ Folder komponen freemode</button><input data-files type="file" webkitdirectory multiple hidden><button data-appearance>Impor appearance JSON</button><input data-json type="file" accept=".json" hidden><div data-parts></div><button data-add class="primary" disabled>Tambahkan karakter ke foto</button><p data-status class="muted" role="status">Pilih kepala, rambut, dan bagian tubuh. Skeleton freemode acuan sudah tersedia.</p><p class="muted">JSON memilih komponen yang tersedia. Head blend orang tua, slider wajah dan overlay game memerlukan data morph/tekstur GTA dan belum disimulasikan. UV asli dari YDD tetap dipakai. Simpan karakter jadi melalui Library scene & outfit.</p>`;
  container.append(root);
  const shortcut = document.createElement('button');
  shortcut.id = 'pbFreemode';
  shortcut.textContent = '+ Karakter freemode';
  container.querySelector('#pbPed').after(shortcut);
  shortcut.onclick = () => {
    root.open = true;
    root.scrollIntoView({ block: 'start', behavior: 'smooth' });
  };
  const $ = (selector) => root.querySelector(selector);
  let files = [],
    parts = [],
    appearance = null;
  function draw() {
    const gender = $('[data-gender]').value;
    $('[data-parts]').replaceChildren();
    for (const [part, label, id] of FREEMODE_PARTS) {
      const control = document.createElement('label');
      control.textContent = label;
      const select = document.createElement('select');
      select.dataset.freemodePart = part;
      const empty = document.createElement('option');
      empty.value = '';
      empty.textContent = part === 'head' ? 'Pilih kepala…' : 'Tidak dipakai';
      select.append(empty);
      for (const item of parts.filter(
        (p) => !p.texture && p.part === part && (!p.gender || p.gender === gender),
      )) {
        const option = document.createElement('option');
        option.value = String(files.indexOf(item.file));
        option.textContent = item.file.name;
        select.append(option);
        if (
          appearance?.components.some((c) => c.component_id === id && c.drawable === item.drawable)
        )
          select.value = option.value;
      }
      if (!appearance && select.options.length > 1) select.selectedIndex = 1;
      select.onchange = () => {
        $('[data-add]').disabled = !$('[data-freemode-part=head]').value;
      };
      control.append(select);
      $('[data-parts]').append(control);
    }
    $('[data-add]').disabled = !$('[data-freemode-part=head]').value;
    $('[data-status]').textContent =
      `${parts.filter((p) => !p.texture && (!p.gender || p.gender === gender)).length} komponen model tersedia. Kepala dan rambut dipilih terpisah.`;
  }
  $('[data-folder]').onclick = () => $('[data-files]').click();
  $('[data-files]').onchange = (e) => {
    files = [...e.target.files];
    e.target.value = '';
    if (files.length > 6000 || files.reduce((n, f) => n + f.size, 0) > 2 * 1024 ** 3) {
      files = [];
      parts = [];
      $('[data-status]').textContent = 'Folder maksimal 6000 file / 2 GB.';
      return;
    }
    parts = files.map(freemodePart).filter(Boolean);
    draw();
  };
  $('[data-gender]').onchange = () => {
    appearance = null;
    draw();
  };
  $('[data-appearance]').onclick = () => $('[data-json]').click();
  $('[data-json]').onchange = (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (file)
      guard(async () => {
        if (file.size > 2 * 1024 ** 2) throw Error('JSON appearance maksimal 2 MB.');
        appearance = validateAppearance(await file.text());
        $('[data-gender]').value = appearance.model.startsWith('mp_f') ? 'female' : 'male';
        draw();
        $('[data-status]').textContent =
          'Komponen dari JSON dipilih bila modelnya tersedia. Periksa kepala/rambut dan bagian yang belum ada sebelum menambahkan.';
      });
  };
  $('[data-add]').onclick = () =>
    guard(async () => {
      const selected = FREEMODE_PARTS.map(([part, , , , category]) => ({
        part,
        category,
        index: $(`[data-freemode-part=${part}]`).value,
      })).filter((p) => p.index !== '');
      if (!selected.some((p) => p.part === 'head'))
        throw Error('Pilih model kepala freemode terlebih dahulu.');
      const gender = $('[data-gender]').value,
        rigChoice = 'freemode-' + gender;
      const chosen = selected.map((p) => freemodePart(files[Number(p.index)]));
      const images = parts
        .filter(
          (p) =>
            p.texture &&
            (!p.gender || p.gender === gender) &&
            chosen.some((c) => c.part === p.part && c.drawable === p.drawable),
        )
        .map((p) => p.file);
      const skeleton = files.find((f) =>
        new RegExp('mp_' + (gender === 'female' ? 'f' : 'm') + '_freemode_01\\.yft$', 'i').test(
          f.name,
        ),
      );
      const head = selected.find((p) => p.part === 'head');
      await importFiles(
        [files[Number(head.index)], ...(skeleton ? [skeleton] : [])],
        'ped',
        'ped',
        { rigChoice },
      );
      for (const part of selected.filter((p) => p.part !== 'head'))
        await importFiles(
          [files[Number(part.index)]],
          part.part === 'hair' || part.part === 'teef' ? 'accessory' : 'clothing',
          part.category,
          { rigChoice },
        );
      if (images.length) await importFiles(images, 'texture');
      setStatus(
        'Karakter freemode ditambahkan. Atur emote per ped; simpan scene untuk memakai karakter ini lagi. Periksa tekstur yang belum tersedia.',
      );
    });
  draw();
  return root;
}
