// Pick a coherent starter freemode body from the same imported pack as the selected face.
// The caller reads binary bytes; this module only resolves validated library records.
const required=['head','uppr','hand','lowr','feet'];
export function resolveCharacterBodyEntries(packs, baseModel, gender) {
  if(!['male','female'].includes(gender) || !baseModel) return [];
  const pack=packs.find(p=>p.id===baseModel.packId);
  const original=pack?.files.find(f=>f.relativePath===baseModel.relativePath && /\.ydd$/i.test(f.name));
  if(!original || original.gender!==gender)throw Error('Model dasar freemode tidak ditemukan atau salah gender.');
  const models=pack.files.filter(f=>/\.ydd$/i.test(f.name) && f.gender===gender);
  const picked=[];
  const selectedComponents=new Set();
  for(const component of required){
    const available=models.filter(f=>f.component===component);
    const chosen=original.component===component?original:
      available.find(f=>f.drawable===0)||
      available.sort((a,b)=>(a.drawable??999)-(b.drawable??999))[0];
    if(chosen && !selectedComponents.has(component)){
      picked.push(chosen);selectedComponents.add(component);
    }
  }
  if(!picked.includes(original))picked.push(original);
  const result=[];
  const seen=new Set();
  for(const model of picked){
    const related=pack.files.filter(f=>/\.ytd$/i.test(f.name) && f.component===model.component &&
      f.drawable===model.drawable && (!f.textureVariant || f.textureVariant==='a'));
    for(const entry of [model,...related]){
      if(!seen.has(entry.relativePath)){seen.add(entry.relativePath);result.push({packId:pack.id,entry});}
    }
  }
  // The matching freemode YFT supplies the original GTA skeleton when available.
  const skeleton=pack.files.find(f=>/\.yft$/i.test(f.name) && f.gender===gender);
  if(skeleton && !seen.has(skeleton.relativePath))result.push({packId:pack.id,entry:skeleton});
  return result;
}
