import { freemodeIdentity, selectFreemodeTexture } from './freemode-texture-pairing.js';
// Pick a coherent starter freemode body from the same imported pack as the selected face.
// The caller reads binary bytes; this module only resolves validated library records.
const required=['head','hair','uppr','hand','lowr','feet'];
export function resolveCharacterBodyEntries(packs, baseModel, gender) {
  if(!['male','female'].includes(gender) || !baseModel) return [];
  const pack=packs.find(p=>p.id===baseModel.packId);
  const original=pack?.files.find(f=>f.relativePath===baseModel.relativePath && /\.ydd$/i.test(f.name));
  if(!original || original.gender!==gender)throw Error('Model dasar freemode tidak ditemukan atau salah gender.');
  const models=pack.files.filter(f=>/\.ydd$/i.test(f.name) && f.gender===gender);
  const primaryCollection=freemodeIdentity(original)?.collection || null;
  const vanilla=gender==='female'?'mp_f_freemode_01':'mp_m_freemode_01';
  const picked=[];
  const selectedComponents=new Set();
  for(const component of required){
    const available=models.filter(f=>f.component===component);
    // Prefer the selected head's collection; only fall back to unqualified or
    // original freemode pieces, never a random unrelated addon collection.
    const related=available.filter(f=>{
      const collection=freemodeIdentity(f)?.collection || null;
      return collection===primaryCollection;
    });
    const base=available.filter(f=>{
      const collection=freemodeIdentity(f)?.collection || null;
      return collection===vanilla || collection===null;
    });
    const safe=related.length?related:base;
    const chosen=original.component===component?original:
      safe.find(f=>f.drawable===0)||
      [...safe].sort((a,b)=>(a.drawable??999)-(b.drawable??999))[0];
    if(chosen && !selectedComponents.has(component)){
      picked.push(chosen);selectedComponents.add(component);
    }
  }
  if(!picked.includes(original))picked.push(original);
  const result=[];
  const seen=new Set();
  for(const model of picked){
    // Choose variant A only when an unambiguous same-gender/collection YTD exists.
    // Never attach another collection's hair/head diffuse by drawable number alone.
    const matching=pack.files.filter(f=>/\.ytd$/i.test(f.name) &&
      f.component===model.component && f.drawable===model.drawable && f.gender===gender);
    const resolved=selectFreemodeTexture(model,matching,'a',gender);
    const related=resolved.status==='matched'?[resolved.file]:[];
    for(const entry of [model,...related]){
      if(!seen.has(entry.relativePath)){seen.add(entry.relativePath);result.push({packId:pack.id,entry});}
    }
  }
  // The matching freemode YFT supplies the original GTA skeleton when available.
  const native=pack.files.filter(f=>/\.yft$/i.test(f.name) && f.gender===gender);
  const expected=gender==='male'?'mp_m_freemode':'mp_f_freemode';
  const skeleton=native.find(f=>(f.name+' '+f.relativePath).toLowerCase().includes(expected))||native[0];
  if(skeleton && !seen.has(skeleton.relativePath))result.push({packId:pack.id,entry:skeleton});
  return result;
}
