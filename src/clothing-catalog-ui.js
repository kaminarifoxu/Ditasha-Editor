export function mountClothingCatalog() {
  if (!window.ditashaClothing) return;
  const tab = document.createElement('button');
  tab.type = 'button'; tab.className = 'clothing-launch';
  tab.textContent = 'Clothing Catalog';
  tab.title = 'Custom clothing library (saved locally)';
  document.body.append(tab);
  const root = document.createElement('section');
  root.className = 'clothing-catalog'; root.hidden = true;
  root.setAttribute('aria-label','DITASHA Clothing Catalog');
  root.innerHTML = `<header class="cl-head"><strong>◈ DITASHA <span>Clothing</span></strong><div class="cl-actions"><button data-import>+ Import pakaian</button><button data-close aria-label="Tutup katalog">✕</button></div></header>
  <div class="cl-toolbar"><div class="cl-genders"><button class="active" data-gender="all">Semua</button><button data-gender="male">Cowok</button><button data-gender="female">Cewek</button></div><input data-search placeholder="Cari pakaian, nama file atau pack..." aria-label="Cari pakaian"/><select data-pack aria-label="Pilih pack"><option value="all">Semua pack</option></select></div>
  <div class="cl-cats" data-cats></div><p class="cl-count" data-count></p><div class="cl-grid" data-grid></div><p class="cl-feedback" data-feedback role="status"></p>`;
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
    const rows = items.flatMap(pack => pack.files.map(file => ({pack,file,id:pack.id})))
      .filter(x => (gender==='all'||x.file.gender===gender) &&
         (category==='all'||x.file.component===category) &&
         (selectedPack==='all'||x.id===selectedPack) &&
         (!search||[x.pack.pack,x.file.name,x.file.component].join(' ').toLowerCase().includes(search)));
    $('[data-count]').textContent = rows.length+' imported files · Files are stored on this computer';
    const grid = $('[data-grid]');grid.replaceChildren();
    for (const {pack,file,id} of rows) {
      const card=document.createElement('article');card.className='cl-card';
      const preview=document.createElement('div');preview.className='cl-placeholder';
      const icon=document.createElement('span');icon.textContent=/\.ytd$/i.test(file.name)?'▧':'♙';
      preview.append(icon);
      const name=document.createElement('strong');name.textContent=file.component.toUpperCase()+' #'+(file.drawable??'?');
      const desc=document.createElement('small');desc.textContent=file.name;
      const foot=document.createElement('small');foot.textContent=pack.pack+' · '+file.gender;
      card.append(preview,name,desc,foot);grid.append(card);
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
  $('[data-search]').oninput=draw;
  $('[data-pack]').onchange=e=>{selectedPack=e.target.value;draw();};
  root.querySelectorAll('[data-gender]').forEach(b=>b.onclick=()=>{
    gender=b.dataset.gender;root.querySelectorAll('[data-gender]').forEach(x=>x.classList.toggle('active',x===b));draw();
  });
}
