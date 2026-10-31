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
  <div class="cl-pack-actions"><button data-save-outfit>Simpan Outfit</button><button data-show-outfits>Outfit Saya</button><button data-remove-outfit>Hapus Outfit</button><button data-to-booth>Kirim ke Photo Booth</button><button data-rename-pack>Ubah nama pack</button><button data-delete-pack>Hapus pack</button></div><div class="cl-cats" data-cats></div><p class="cl-count" data-count></p><div class="cl-grid" data-grid></div><p class="cl-feedback" data-feedback role="status"></p>`;
  document.body.append(root);
  const $ = s => root.querySelector(s);
  let items = [], gender = 'all', category = 'all';
  let selectedPack = 'all';
  const outfitSlots = new Map();
  let outfitGender = 'male';
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
      const add = document.createElement('button');
      add.textContent = outfitSlots.get(file.component)?.packId === id && outfitSlots.get(file.component)?.relativePath === file.relativePath ? '✓ Dipilih untuk Outfit' : '+ Ke Outfit';
      add.onclick = () => {
        if (file.gender === 'unknown') { $('[data-feedback]').textContent='Gender file tidak dikenali. Periksa nama file freemode.'; return; }
        if (outfitSlots.size && file.gender !== outfitGender) outfitSlots.clear();
        outfitGender = file.gender;
        outfitSlots.set(file.component, {packId:id,relativePath:file.relativePath,textureVariant:variants.length?picker.value:null});
        draw();
        $('[data-feedback]').textContent=outfitSlots.size+' komponen dipilih untuk outfit '+outfitGender;
      };
      card.append(add);
      const variants = [...new Set(textures.map(t => t.textureVariant).filter(Boolean))].sort();
      const picker = document.createElement('select');
      picker.setAttribute('aria-label', 'Pilih variasi tekstur');
      const storedSelection = outfitSlots.get(file.component);
      const isSelected = storedSelection?.packId === id && storedSelection?.relativePath === file.relativePath;
      if (variants.length) {
        for (const variant of variants) picker.add(new Option('Texture ' + variant.toUpperCase(), variant));
        if (isSelected && variants.includes(storedSelection.textureVariant)) picker.value = storedSelection.textureVariant;
        picker.onchange = () => {
          if (isSelected) {
            outfitSlots.set(file.component, { packId: id, relativePath: file.relativePath, textureVariant: picker.value });
            $('[data-feedback]').textContent = 'Variasi outfit diperbarui menjadi ' + picker.value.toUpperCase();
          }
        };
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
            await openPreview(modelFiles);
            root.hidden = true;
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
  $('[data-save-outfit]').onclick=async()=>{
    if(!outfitSlots.size){$('[data-feedback]').textContent='Pilih pakaian dengan + Ke Outfit terlebih dahulu.';return;}
    const name=window.prompt('Nama outfit:', 'My Outfit');
    if(name===null)return;
    try {
      const saved=await window.ditashaClothing.saveOutfit({name,gender:outfitGender,slots:[...outfitSlots.values()]});
      $('[data-feedback]').textContent='Outfit '+saved.name+' disimpan secara permanen.';
    }catch(e){$('[data-feedback]').textContent='Gagal menyimpan outfit: '+e.message;}
  };
  $('[data-show-outfits]').onclick=async()=>{
    try {
      const outfits=await window.ditashaClothing.listOutfits();
      if (!outfits.length) { $('[data-feedback]').textContent='Belum ada outfit tersimpan.'; return; }
      const selection=window.prompt('Pilih nomor outfit untuk dimuat:\\n'+outfits.map((o,i)=>(i+1)+'. '+o.name+' ('+o.gender+')').join('\\n'),'1');
      if(selection===null)return;
      const index=Number(selection)-1;
      if(!Number.isInteger(index)||!outfits[index])throw Error('Nomor outfit tidak tersedia.');
      const outfit=outfits[index];
      const packs=await window.ditashaClothing.list();
      for(const slot of outfit.slots) {
        if(!packs.some(p=>p.id===slot.packId&&p.files.some(f=>f.relativePath===slot.relativePath)))throw Error('Outfit menggunakan pakaian yang sudah dihapus.');
      }
      outfitSlots.clear();
      outfitGender=outfit.gender;
      for(const slot of outfit.slots)outfitSlots.set(slot.component,slot);
      gender=outfit.gender;
      root.querySelectorAll('[data-gender]').forEach(b=>b.classList.toggle('active',b.dataset.gender===gender));
      draw();
      $('[data-feedback]').textContent='Outfit '+outfit.name+' dimuat ('+outfit.slots.length+' komponen).';
    }catch(e){$('[data-feedback]').textContent='Gagal membaca outfit: '+e.message;}
  };
  $('[data-remove-outfit]').onclick=async()=>{
    try {
      const outfits=await window.ditashaClothing.listOutfits();
      if(!outfits.length){$('[data-feedback]').textContent='Belum ada outfit untuk dihapus.';return;}
      const answer=window.prompt('Nomor outfit yang akan dihapus:\n'+outfits.map((o,i)=>(i+1)+'. '+o.name).join('\n'),'1');
      if(answer===null)return;
      const index=Number(answer)-1;
      if(!Number.isInteger(index)||!outfits[index])throw Error('Nomor outfit tidak tersedia.');
      const selected=outfits[index];
      if(!window.confirm('Hapus preset outfit '+selected.name+'? File pakaian dalam pack tetap disimpan.'))return;
      await window.ditashaClothing.removeOutfit(selected.id);
      $('[data-feedback]').textContent='Outfit '+selected.name+' telah dihapus. Pack pakaian tetap tersedia.';
    }catch(e){$('[data-feedback]').textContent='Gagal menghapus outfit: '+e.message;}
  };
  async function outfitFiles(slots) {
    const packs = await window.ditashaClothing.list();
    const files = [];
    for (const slot of slots) {
      const pack = packs.find(p => p.id === slot.packId);
      const model = pack?.files.find(f => f.relativePath === slot.relativePath);
      if (!model) throw Error('File outfit tidak ditemukan di library.');
      const related = pack.files.filter(entry => /\\.ytd$/i.test(entry.name) &&
        entry.component === model.component && entry.drawable === model.drawable &&
        (!slot.textureVariant || entry.textureVariant === slot.textureVariant));
      for (const entry of [model, ...related]) {
        const loaded = await window.ditashaClothing.previewRead(pack.id, entry.relativePath);
        files.push(new File([loaded.bytes], loaded.name));
      }
    }
    return files;
  }
  $('[data-to-booth]').onclick=async()=>{
    const slots=[...outfitSlots.values()];
    if(!slots.length){$('[data-feedback]').textContent='Pilih item dari katalog atau muat outfit tersimpan terlebih dahulu.';return;}
    try {
      const files=await outfitFiles(slots);
      const result=await new Promise(resolve=>{
        window.dispatchEvent(new CustomEvent('ditasha:clothing-outfit-to-booth',{
          detail:{files,onComplete:resolve}
        }));
      });
      if(!result.success) throw Error(result.error);
      root.hidden=true;
    }catch(e){$('[data-feedback]').textContent='Photo Booth: '+e.message;}
  };
  $('[data-search]').oninput=draw;
  $('[data-pack]').onchange=e=>{selectedPack=e.target.value;draw();};
  root.querySelectorAll('[data-gender]').forEach(b=>b.onclick=()=>{
    gender=b.dataset.gender;root.querySelectorAll('[data-gender]').forEach(x=>x.classList.toggle('active',x===b));draw();
  });
}
