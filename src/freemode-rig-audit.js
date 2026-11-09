// Freemode source/rigger audit. Never invent native bone weights from GLB
// vertex positions or assume GTA skin indices map to another YFT's palette.
export const FREEMODE_COMPONENTS=Object.freeze(['head','hair','uppr','hand','lowr','feet']);
export const DEFAULT_PED_SETTINGS=Object.freeze({
  skeletonMode:'auto',headUv:[0,0,1,1],hairUv:[0,0,1,1],
});
export function validatePedSettings(value) {
  if(value==null)return {skeletonMode:'auto',headUv:[0,0,1,1],hairUv:[0,0,1,1]};
  if(!value||typeof value!=='object'||Array.isArray(value)||
     Object.keys(value).some(k=>!['skeletonMode','headUv','hairUv'].includes(k)))
    throw Error('Invalid freemode rig settings');
  if(!['auto','strict'].includes(value.skeletonMode))throw Error('Invalid skeleton selection mode');
  const validateUv=(v,label)=>{
    if(!Array.isArray(v)||v.length!==4||v.some(n=>typeof n!=='number'||!Number.isFinite(n)))
      throw Error(label+' requires four finite numbers');
    if(v.slice(0,2).some(n=>Math.abs(n)>1)||v.slice(2).some(n=>n<0.1||n>4))
      throw Error(label+' UV offset or scale outside supported range');
    return [...v];
  };
  return {skeletonMode:value.skeletonMode,headUv:validateUv(value.headUv,'Head'),
    hairUv:validateUv(value.hairUv,'Hair')};
}
export function inspectFreemodeSources(packs,baseModel,gender) {
  const issues=[];
  if(!['male','female'].includes(gender))throw Error('Unknown freemode gender');
  const pack=packs.find(p=>p.id===baseModel?.packId);
  const selected=pack?.files?.find(f=>f.relativePath===baseModel?.relativePath&&/\.ydd$/i.test(f.name));
  if(!selected||selected.gender!==gender)
    return {ready:false,skeleton:'missing',uvStatus:'unchecked',components:[],issues:['Select an imported freemode YDD of matching gender.'],reference:null};
  const entries=pack.files.filter(f=>f.gender===gender);
  const skeletons=entries.filter(f=>/\.yft$/i.test(f.name));
  // Do not use an unrelated file from another freemode pack or another sex.
  const named=skeletons.filter(f=>new RegExp('mp_'+(gender==='male'?'m':'f')+'_freemode','i').test(f.name+' '+f.relativePath));
  const skeleton=named[0]||skeletons[0]||null;
  if(!skeleton)issues.push('Native freemode YFT skeleton is missing. Import the matching original YFT before attempting animation or rigging.');
  else if(!named.length)issues.push('YFT belongs to the same pack/gender but lacks an explicit freemode filename. Verify its native bone hierarchy.');
  const components=[];
  for(const component of FREEMODE_COMPONENTS){
    const candidates=entries.filter(f=>f.component===component&&/\.ydd$/i.test(f.name));
    if(!candidates.length){
      if(component!=='hair')issues.push('Missing '+component.toUpperCase()+' body YDD.');
      continue;
    }
    const model=selected.component===component?selected:
      candidates.find(f=>f.drawable===0)||candidates[0];
    const textures=entries.filter(f=>f.component===component&&f.drawable===model.drawable&&/\.ytd$/i.test(f.name));
    if(!textures.length)issues.push('Missing '+component.toUpperCase()+' matching YTD; diffuse UV appearance cannot be certified.');
    components.push({component,model:model.relativePath,textureCount:textures.length,
      textures:textures.map(f=>f.relativePath)});
  }
  return {ready:!!skeleton&&!issues.some(i=>/Missing .*YDD|Native freemode YFT/.test(i)),
    skeleton:skeleton?'source-yft':'missing',
    reference:skeleton?.relativePath||null,components,issues,uvStatus:'requires-geometry-inspection'};
}
export function inspectFreemodeUv(drawables,component) {
  if(!['head','hair'].includes(component))throw Error('UV inspection expects head or hair');
  const geometries=[];
  const scan=value=>{
    if(Array.isArray(value)){value.forEach(scan);return}
    if(!value||typeof value!=='object')return;
    if(Array.isArray(value.geometries))geometries.push(...value.geometries);
    if(Array.isArray(value.lods))value.lods.forEach(scan);
    if(Array.isArray(value.drawables))value.drawables.forEach(scan);
  };
  scan(drawables);
  let good=0,vertices=0,missing=0,bad=0;
  for(const g of geometries){
    const pos=g.positions,uv=g.uvs;
    if(!pos?.length)continue;
    const count=pos.length/3;vertices+=count;
    if(!uv||uv.length!==count*2){missing++;continue}
    if(Array.from(uv).some(v=>!Number.isFinite(v))){bad++;continue}
    good++;
  }
  return {component,geometries:geometries.length,vertices,uvMeshes:good,missingUv:missing,
    nonfiniteUv:bad,ready:good>0&&missing===0&&bad===0,
    warning:bad?'UV contains non-finite coordinates':missing?'Missing matching vertex UV coordinates':!good?'No readable UV geometry':'UV coordinates present; matching the texture atlas still requires visual checking'};
}
