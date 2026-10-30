export function mountClothingCatalog({ openPreview } = {}) {
  if (!window.ditashaClothing) return;
  const tab = document.createElement('button');
  tab.type = 'button'; tab.className = 'clothing-launch';
  tab.textContent = 'Clothing Catalog';
  tab.title = 'Custom clothing library (saved locally)';
  document.body.append(tab);
  const root = document.createElement('section');
  root.className = 'clothing-catalog'; root.hidden = true;
  root.setAttribute('aria-label','DITASHA Clothing Catalog');
  root.innerHTML = `<header class="cl-head"><strong>◈ DITASHA <span>Clothing</span></strong><div class="cl-actions"><button data-import>+ Import file</button><button data-import-folder>+ Import folder</button><button data-close aria-label="Tutup katalog">✕</button></div></header>
  <div class="cl-toolbar"><div class="cl-genders"><button class="active" data-gender="all">Semua</button><button data-gender="male">Cowok</button><button data-gender="female">Cewek</button></div><input data-search placeholder="Cari pakaian, nama file atau pack..." aria-label="Cari pakaian"/><select data-pack aria-label="Pilih pack"><option value="all">Semua pack</option></select></div>
  <div class="cl-pack-actions"><button data-rename-pack>Ubah nama pack</button><button data-delete-pack>Hapus pack</button></div><div class="cl-cats" data-cats></div><p class="cl-count" data-count></p><div class="cl-grid" data-grid></div><p class="cl-feedback" data-feedback role="status"></p>`;
  document.body.append(root);
  const $ = s => root.querySelector(s);
  let items = [], gender = 'all', category = 'all';
  let selectedPack = 'all';
  const categories = ['all','jbib','accs','lowr','feet','teef','task','berd','hand','decl','p_head','p_eyes','p_ears','hair','head','uppr'];
  function draw() {
    $('[data-cats]').replaceChildren();
    for (const c of categories) {
      const button = document.createElement('button');
      button.textContent = c.toUpperCase(); button.classList.toggle('active',c===category);
      button.onclick=()=>{category=c;draw();}; $('[data-cats]').append(button);
    }
    const search = $('[data-search]').value.trim().toLowerCase();
    const rows = items.flatMap(pack => pack.files.filter(file => /\.ydd$/i.test(file.name)).map(file => ({pack,file,id:pack.id})))
      .filter(x => (gender==='all'||x.file.gender===gender) &&
         (category==='all'||x.file.component===category) &&
         (selectedPack==='all'||x.id===selectedPack) &&
         (!search||[x.pack.pack,x.file.name,x.file.component].join(' ').toLowerCase().includes(search)));
    $('[data-count]').textContent = rows.length+' clothing models · Saved locally (3D thumbnail pending)';
    const grid = $('[data-grid]');grid.replaceChildren();
    for (const {pack,file,id} of rows) {
      const card=document.createElement('article');card.className='cl-card';
      const preview=document.createElement('div');preview.className='cl-placeholder';
      const icon=document.createElement('span');icon.textContent='♙';
      preview.append(icon);
      const name=document.createElement('strong');name.textContent=file.component.toUpperCase()+' #'+(file.drawable??'?');
      const desc=document.createElement('small');desc.textContent=file.name;
      const textures=pack.files.filter(entry => /\.ytd$/i.test(entry.name) && entry.component===file.component && entry.drawable===file.drawable);
      const foot=document.createElement('small');foot.textContent=pack.pack+' · '+file.gender+' · '+textures.length+' texture files';
      card.append(preview,name,desc,foot);
      const variants = [...new Set(textures.map(t => t.textureVariant).filter(Boolean))].sort();
      const picker = document.createElement('select');
      picker.setAttribute('aria-label', 'Pilih variasi tekstur');
      if (variants.length) {
        for (const variant of variants) picker.add(new Option('Texture ' + variant.toUpperCase(), variant));
        card.append(picker);
      }
      if (typeof openPreview === 'function') {
        const button = document.createElement('button');
        button.textContent = 'Buka di 3D Editor';
        button.onclick = async () => {
          button.disabled = true;
          try {
            const matching = pack.files.filter(entry => entry.component === file.component &&
              entry.drawable === file.drawable && /\.ytd$/i.test(entry.name));
            const selected = [file, ...matching.filter(entry => !variants.length || entry.textureVariant === picker.value)];
            const modelFiles = [];
            for (const entry of selected) {
              const data = await window.ditashaClothing.previewRead(id, entry.relativePath);
              modelFiles.push(new File([data.bytes], data.name));
            }
            root.hidden = true;
            await openPreview(modelFiles);
          } catch (error) {
            $('[data-feedback]').textContent = 'Gagal membuka preview: ' + error.message;
          } finally { button.disabled = false; }
        };
        card.append(button);
      }
      grid.append(card);
    }
    if (!rows.length) {
      const empty=document.createElement('p');empty.className='cl-empty';
      empty.textContent = items.length ? 'Tidak ada item untuk filter ini.' : 'Library kosong. Klik Import pakaian untuk menyimpan file YDD/YTD.';
      grid.append(empty);
    }
  }
  async function refresh() {
    try {
      items=await window.ditashaClothing.list();
      const select=$('[data-pack]');select.replaceChildren(new Option('Semua pack','all'));
      for(const pack of items) select.add(new Option(pack.pack+' ('+pack.files.length+')',pack.id));
      if(!items.some(x=>x.id===selectedPack))selectedPack='all';
      select.value=selectedPack;
      draw();
    }catch(e){$('[data-feedback]').textContent='Gagal memuat library: '+e.message;}
  }
  tab.onclick=()=>{root.hidden=false;refresh();};
  $('[data-close]').onclick=()=>{root.hidden=true;};
  $('[data-import]').onclick=async()=>{
    const name=window.prompt('Nama pack pakaian:', 'My Custom Pack');
    if(name===null)return;
    try{
      const result=await window.ditashaClothing.import(name);
      if(result){$('[data-feedback]').textContent='Berhasil menyimpan '+result.files.length+' file ke '+result.pack;await refresh();}
    }catch(e){$('[data-feedback]').textContent='Import gagal: '+e.message;}
  };
  $('[data-import-folder]').onclick=async()=>{
    const name=window.prompt('Nama pack dari folder:', 'My Custom Pack');
    if(name===null)return;
    try{
      const result=await window.ditashaClothing.importFolder(name);
      if(result){await refresh();$('[data-feedback]').textContent='Folder disimpan: '+result.files.length+' file';}
    }catch(e){$('[data-feedback]').textContent='Import folder gagal: '+e.message;}
  };
  $('[data-rename-pack]').onclick=async()=>{
    if(selectedPack==='all'){ $('[data-feedback]').textContent='Pilih satu pack terlebih dahulu.'; return; }
    const current=items.find(x=>x.id===selectedPack);
    const label=window.prompt('Nama pack baru:',current?.pack||'');
    if(label===null)return;
    try{await window.ditashaClothing.rename(selectedPack,label);await refresh();$('[data-feedback]').textContent='Nama pack diperbarui.';}
    catch(e){$('[data-feedback]').textContent='Gagal mengubah nama: '+e.message;}
  };
  $('[data-delete-pack]').onclick=async()=>{
    if(selectedPack==='all'){ $('[data-feedback]').textContent='Pilih satu pack terlebih dahulu.'; return; }
    const current=items.find(x=>x.id===selectedPack);
    if(!window.confirm('Hapus pack '+(current?.pack||'')+' beserta semua file yang tersimpan?'))return;
    try{await window.ditashaClothing.remove(selectedPack);selectedPack='all';await refresh();$('[data-feedback]').textContent='Pack telah dihapus.';}
    catch(e){$('[data-feedback]').textContent='Gagal menghapus pack: '+e.message;}
  };
  $('[data-search]').oninput=draw;
  $('[data-pack]').onchange=e=>{selectedPack=e.target.value;draw();};
  root.querySelectorAll('[data-gender]').forEach(b=>b.onclick=()=>{
    gender=b.dataset.gender;root.querySelectorAll('[data-gender]').forEach(x=>x.classList.toggle('active',x===b));draw();
  });
}
