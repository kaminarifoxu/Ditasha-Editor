import { resolveCharacterBodyEntries } from './freemode-character-source.js';
import { toIlleniumAppearance, fromIlleniumAppearance, faceFeatureNames, overlayNames } from './character-appearance.js';
import { createFilePreview } from './file-preview.js';
import { resolveOutfitEntries, freemodeImportName } from './clothing-outfit-files.js';
export function mountCharacterMaker() {
  if (!window.ditashaCharacters || !window.ditashaClothing) return;
  const host = document.createElement('section');
  host.className = 'ditasha-character-maker';
  host.hidden = true;
  host.innerHTML = `<div class="cm-card">
    <header><strong>DITASHA · Freemode Character Maker</strong><button data-close aria-label="Tutup Character Maker">✕</button></header>
    <div class="cm-layout">
      <aside>
        <label>Karakter tersimpan<select data-presets><option value="">Karakter baru</option></select></label>
        <label>Nama karakter<input data-name maxlength="80" value="New Character"></label>
        <label>Gender<select data-gender><option value="male">Cowok · mp_m_freemode_01</option><option value="female">Cewek · mp_f_freemode_01</option></select></label>
        <button data-import-freemode type="button">+ Impor folder mp_freemode</button>
        <label>Model dasar freemode (YDD)<select data-base><option value="">Pilih model dasar</option></select></label>
        <label>Outfit dari Clothing Library<select data-outfit><option value="">Tanpa outfit</option></select></label>
        <div class="cm-actions"><button data-new>Baru</button><button data-save>Simpan</button><button data-remove>Hapus</button><button data-export>Ekspor JSON FiveM</button><button data-import-json>Impor JSON FiveM</button><input data-json-file type="file" accept=".json,application/json" hidden></div>
      </aside>
      <main>
        <div class="cm-preview-head"><strong>Preview model freemode</strong><span>Putar / zoom model dengan mouse</span></div>
        <div class="cm-actions"><button data-load-morph type="button">Muat morph target offline</button><button data-clear-morph type="button" hidden>Hapus morph target</button><input data-morph-file type="file" accept=".json,application/json" hidden></div><div data-preview class="cm-model-preview" role="img" aria-label="Pratinjau 3D freemode">Pilih model dasar freemode untuk menampilkan preview 3D.</div>
        <label class="cm-face-preview-toggle"><input data-live-face type="checkbox" checked> Tampilkan perkiraan deformasi wajah langsung</label><small data-face-state>Preview wajah menunggu model YDD kepala.</small>
        <p class="cm-notice">Preview desktop menggunakan pendekatan deformasi geometri non-destruktif, bukan head blend native GTA V. Hasil wajah yang akurat tersedia melalui ekspor JSON ke FiveM. Model YDD asli tidak diubah.</p>
        <div class="cm-sliders"></div>
        <div class="cm-actions"><button data-send>Kirim ke Photo Booth</button></div>
      </main>
    </div>
    <p data-status role="status"></p>
  </div>`;
  document.body.append(host);
  const $ = selector => host.querySelector(selector);
  let id=null;
  let desiredOutfit=null;
  let desiredBase=null;
  let baseRefs=new Map();
  const modelPreview=createFilePreview($('[data-preview]'));
  let previewSerial=0;
  let activeMorphPack=null;
  let faceController=null;
  let livePreviewEnabled=true;
  const updateFace=()=>{
    if(!livePreviewEnabled||!faceController)return;
    const applied=faceController.applyFace(read().appearance);
    $('[data-face-state]').textContent=applied ? (activeMorphPack ? 'Morph targets diterapkan; perlu kalibrasi terhadap GTA V.' : 'Preview perkiraan deformasi wajah (bukan GTA native)') : (activeMorphPack ? 'Morph pack tidak sesuai topologi model kepala.' : 'Tidak ditemukan geometri wajah pada model ini.');
  };
  async function updatePreview() {
    const version=++previewSerial;
    modelPreview.clear();
    faceController=null;
    const selected=baseRefs.get($('[data-base]').value);
    if(!selected){$('[data-preview]').textContent='Pilih model YDD dasar dari Clothing Library.';return;}
    const packs=await window.ditashaClothing.list();
    const pack=packs.find(p=>p.id===selected.packId);
    const entry=pack?.files.find(f=>f.relativePath===selected.relativePath);
    if(!entry)throw Error('Model dasar tidak ada dalam Library.');
    const data=await window.ditashaClothing.previewRead(pack.id,entry.relativePath);
    if(version!==previewSerial)return;
    const related=pack.files.find(f=>/\.ytd$/i.test(f.name) && f.component===entry.component && f.drawable===entry.drawable);
    const model={id:'base',name:data.name};
    const companion=related?{id:'texture',name:related.name}:null;
    const api={read:async id => id==='base'?{data:data.bytes,companion}: {
      data:(await window.ditashaClothing.previewRead(pack.id,related.relativePath)).bytes
    }};
    const controller=await modelPreview.show(model,api,{facePreview:true,morphPack:activeMorphPack});
    if(version!==previewSerial)return;
    faceController=controller?.applyFace?controller:null;
    updateFace();
  }
  $('[data-base]').onchange=()=>updatePreview().catch(e=>{$('[data-preview]').textContent='Preview gagal: '+e.message;});
  $('[data-load-morph]').onclick=()=>$('[data-morph-file]').click();
  $('[data-clear-morph]').onclick=()=>{
    activeMorphPack=null;
    $('[data-clear-morph]').hidden=true;
    updatePreview().catch(e=>{$('[data-preview]').textContent=e.message;});
  };
  $('[data-morph-file]').onchange=async event=>{
    const file=event.target.files?.[0];
    if(!file)return;
    try{
      if(file.size>16*1024*1024)throw Error('Morph pack maksimum 16 MB.');
      const pack=JSON.parse(await file.text());
      if(pack?.version!==1||!Array.isArray(pack.targets)||pack.targets.length>128||
        !Number.isInteger(pack.vertexCount)||pack.vertexCount<=0)throw Error('Format morph pack tidak valid.');
      // Full per-vertex delta and finite-value validation is performed at render time.
      activeMorphPack=pack;
      $('[data-clear-morph]').hidden=false;
      await updatePreview();
      $('[data-status]').textContent='Morph target pack dimuat. Pastikan topologi model sama dengan pack.';
    }catch(error){$('[data-status]').textContent='Gagal memuat morph target: '+error.message;}
    finally{event.target.value='';}
  };

  const features=[
    ['shapeFirst','Wajah ayah',0,45,1,0],['shapeSecond','Wajah ibu',0,45,1,0],
    ['skinFirst','Kulit ayah',0,45,1,0],['skinSecond','Kulit ibu',0,45,1,0],
    ['shapeMix','Campuran bentuk wajah',0,1,.01,.5],
    ['skinMix','Campuran warna kulit',0,1,.01,.5],
    ['eyeColor','Warna mata',0,31,1,0],['hairColor','Warna rambut',0,63,1,0],
    ...Array.from({length:20},(_,i)=>['feature'+i,faceFeatureNames[i],-1,1,.01,0]),
    ...Array.from({length:13},(_,i)=>['overlay'+i,overlayNames[i]||'Overlay 13',0,255,1,0])
  ];
  const sliders = new Map();
  for (const [key,label,min,max,step,initial] of features){
    const wrapper=document.createElement('label');
    const name=document.createElement('span'); name.textContent=label;
    const value=document.createElement('output'); value.textContent=String(initial);
    const input=document.createElement('input'); input.type='range';
    Object.assign(input,{min:String(min),max:String(max),step:String(step),value:String(initial)});
    input.oninput=()=>{value.textContent=input.value;updateFace();};
    wrapper.append(name,value,input); $('.cm-sliders').append(wrapper);sliders.set(key,input);
  }
  $('[data-live-face]').onchange=()=>{livePreviewEnabled=$('[data-live-face]').checked;updatePreview().catch(e=>{$('[data-preview]').textContent=e.message;});};
  const read=()=>{
    const appearance={features:[],overlays:[]};
    for(const [key,input] of sliders) {
      if(key.startsWith('feature'))appearance.features[Number(key.slice(7))]=Number(input.value);
      else if(key.startsWith('overlay'))appearance.overlays[Number(key.slice(7))]=Number(input.value);
      else appearance[key]=Number(input.value);
    }
    return {id,name:$('[data-name]').value,gender:$('[data-gender]').value,
      outfitId:$('[data-outfit]').value||null,
      baseModel:baseRefs.get($('[data-base]').value)||null,appearance};
  };
  const fill=preset=>{
    id=preset?.id||null;
    $('[data-name]').value=preset?.name||'New Character';
    $('[data-gender]').value=preset?.gender||'male';
    desiredOutfit=preset?.outfitId||null;
    desiredBase=preset?.baseModel||null;
    for(const [key,,min,max,step,initial] of features) {
      const value=key.startsWith('feature')?preset?.appearance?.features?.[Number(key.slice(7))]
        :key.startsWith('overlay')?preset?.appearance?.overlays?.[Number(key.slice(7))]
        :preset?.appearance?.[key];
      const input=sliders.get(key);input.value=String(value??initial);
      input.dispatchEvent(new Event('input'));
    }
  };
  async function refresh(){
    const presets=await window.ditashaCharacters.list();
    const list=$('[data-presets]');
    list.replaceChildren(new Option('Karakter baru',''));
    for(const preset of presets)list.add(new Option(preset.name+' · '+preset.gender,preset.id));
    list.value=id||'';
    const packs=await window.ditashaClothing.list();
    const bundled=packs.some(p=>p.pack==='DITASHA Built-in Freemode');
    $('[data-import-freemode]').hidden=bundled;
    if(bundled) $('[data-status]').textContent='Referensi freemode bawaan cowok dan cewek siap dipakai. Tidak perlu impor folder.';
    const baseSelect=$('[data-base]');
    const previousBase=desiredBase || baseRefs.get(baseSelect.value);
    baseRefs=new Map();
    baseSelect.replaceChildren(new Option('Pilih model kepala/tubuh YDD',''));
    for(const pack of packs) for(const file of pack.files) {
      if(file.gender!==$('[data-gender]').value || !/\.ydd$/i.test(file.name))continue;
      if(!['head','uppr','jbib'].includes(file.component))continue;
      const key=pack.id+'|'+file.relativePath;
      baseRefs.set(key,{packId:pack.id,relativePath:file.relativePath});
      baseSelect.add(new Option(pack.pack+' · '+file.name,key));
    }
    const match=[...baseRefs].find(([,v])=>v.packId===previousBase?.packId && v.relativePath===previousBase?.relativePath);
    baseSelect.value=match?.[0]||'';
    desiredBase=null;
    updatePreview().catch(e=>{$('[data-preview]').textContent='Preview gagal: '+e.message;});
    const outfits=await window.ditashaClothing.listOutfits();
    const outfit=$('[data-outfit]'), old=desiredOutfit??outfit.value;
    outfit.replaceChildren(new Option('Tanpa outfit',''));
    for(const item of outfits.filter(x=>x.gender===$('[data-gender]').value))
      outfit.add(new Option(item.name,item.id));
    outfit.value=outfits.some(x=>x.id===old && x.gender===$('[data-gender]').value)?old:'';
    desiredOutfit=null;
  }
  async function show(){
    host.hidden=false;
    await refresh();
    const presets=await window.ditashaCharacters.list();
    fill(presets.find(p=>p.id===id));
    await refresh();
  }
  $('[data-import-freemode]').onclick=async()=>{
    const button=$('[data-import-freemode]');
    button.disabled=true;
    try {
      const result=await window.ditashaClothing.importFolder('Freemode Character References');
      if(result){
        await refresh();
        $('[data-status]').textContent='Impor '+result.files.length+' file freemode berhasil. Pilih gender dan model dasar.';
      }
    }catch(error){$('[data-status]').textContent='Impor freemode gagal: '+error.message;}
    finally{button.disabled=false;}
  };
  $('[data-close]').onclick=()=>{host.hidden=true;modelPreview.clear();};
  $('[data-new]').onclick=async()=>{fill(null);await refresh();};
  $('[data-presets]').onchange=async()=>{
    const presets=await window.ditashaCharacters.list();
    fill(presets.find(p=>p.id===$('[data-presets]').value));await refresh();
  };
  $('[data-gender]').onchange=refresh;
  $('[data-save]').onclick=async()=>{
    try {const saved=await window.ditashaCharacters.save(read());id=saved.id;
      await refresh();$('[data-status]').textContent='Karakter '+saved.name+' tersimpan.';
    }catch(e){$('[data-status]').textContent=e.message;}
  };
  $('[data-remove]').onclick=async()=>{
    if(!id||!window.confirm('Hapus karakter ini?'))return;
    try {await window.ditashaCharacters.remove(id);fill(null);await refresh();
      $('[data-status]').textContent='Karakter dihapus. Asset pakaian tetap ada.';
    }catch(e){$('[data-status]').textContent=e.message;}
  };
  $('[data-export]').onclick=()=>{
    try {
      const payload=toIlleniumAppearance(read());
      const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
      const url=URL.createObjectURL(blob);
      const link=document.createElement('a');link.href=url;
      link.download='ditasha-'+$('[data-name]').value.replace(/[^a-z0-9_-]/gi,'_').slice(0,50)+'-illenium.json';
      document.body.append(link);link.click();link.remove();
      setTimeout(()=>URL.revokeObjectURL(url),1000);
      $('[data-status]').textContent='Appearance JSON FiveM diekspor. Skinning/mesh YDD tidak disertakan.';
    } catch(error){$('[data-status]').textContent='Ekspor gagal: '+error.message;}
  };
  $('[data-import-json]').onclick=()=>$('[data-json-file]').click();
  $('[data-json-file]').onchange=async(event)=>{
    const file=event.target.files?.[0];
    if(!file)return;
    try {
      if(file.size>1024*1024)throw Error('JSON lebih besar dari 1 MB.');
      const parsed=fromIlleniumAppearance(JSON.parse(await file.text()));
      fill({name:file.name.replace(/\.json$/i,''),...parsed});
      await refresh();
      $('[data-status]').textContent='Data appearance diimpor. Simpan untuk mempertahankan karakter.';
    } catch(error){$('[data-status]').textContent='Impor gagal: '+error.message;}
    finally {event.target.value='';}
  };
  $('[data-send]').onclick=async()=>{
    try {
      const preset=await window.ditashaCharacters.save(read());id=preset.id;
      const outfits=await window.ditashaClothing.listOutfits();
      const outfit=outfits.find(x=>x.id===preset.outfitId);
      const packs=await window.ditashaClothing.list();
      const files=[];
      const baseFiles=[];
      if(preset.baseModel)for(const {packId,entry} of resolveCharacterBodyEntries(packs,preset.baseModel,preset.gender)){
        const data=await window.ditashaClothing.previewRead(packId,entry.relativePath);
        baseFiles.push(new File([data.bytes],freemodeImportName(entry)));
      }
      if(outfit){
        for(const {packId,entry} of resolveOutfitEntries(packs,outfit.slots)){
          const data=await window.ditashaClothing.previewRead(packId,entry.relativePath);
          files.push(new File([data.bytes],freemodeImportName(entry)));
        }
      }
      const result=await new Promise(resolve=>{
        window.dispatchEvent(new CustomEvent('ditasha:character-to-booth',
          {detail:{preset,files,baseFiles,onComplete:resolve}}));
      });
      if(!result?.success)throw Error(result?.error||'Photo Booth tidak tersedia.');
      host.hidden=true;
    }catch(e){$('[data-status]').textContent='Photo Booth: '+e.message;}
  };
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!host.hidden){host.hidden=true;modelPreview.clear();}});
  const nav=document.querySelector('.workspace-nav .workshop-nav');
  const button=document.createElement('button');
  button.type='button';button.className='cm-launch';
  button.textContent='Character Maker';
  button.onclick=()=>show().catch(e=>{$('[data-status]').textContent=e.message;});
  if(nav)nav.append(button);
  else document.querySelector('.workspace-nav')?.append(button);
}
