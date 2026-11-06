'use strict';
const path = require('node:path');

// Require the same folder and matching drawable/collection. Only a recognized
// freemode slot can use the *_diff_###_variant naming convention.
function textureFamily(file) {
  const name = path.posix.basename(file.name || file.relative || '').toLowerCase();
  const stem = name.replace(/\.(ydd|ydr|yft|ytd)$/i, '');
  const component = stem.match(/^(.*\^)?((?:p_)?[a-z]+)_(diff_)?(\d{3,4})_([a-z0-9_]+)$/i);
  if (!component) return null;
  const [, prefix = '', slot, diffuse = '', number] = component;
  const valid = /^(?:head|hair|berd|uppr|lowr|hand|feet|teef|accs|task|decl|jbib|p_head|p_eyes|p_ears|p_lwrist|p_rwrist)$/i;
  if (!valid.test(slot)) return null;
  const ytd = /\.ytd$/i.test(name);
  if (ytd !== !!diffuse) return null;
  return prefix + slot + '_' + number;
}
function pairedTextureNames(model, texture) {
  if (path.posix.dirname(model.relative) !== path.posix.dirname(texture.relative))
    return false;
  const modelStem = model.name.toLowerCase().replace(/(?:_hi)?\.[^.]+$/, '');
  const textureStem = texture.name.toLowerCase().replace(/\.ytd$/, '');
  if (modelStem === textureStem) return true;
  const a = textureFamily(model), b = textureFamily(texture);
  if (!a || !b || a !== b) return false;
  // Classified freemode items already have gender and collection scope. Keep
  // these boundaries so male/female heads and addon packs never cross-pair.
  if (model.group && texture.group && model.group !== texture.group) return false;
  if (model.category && texture.category && model.category !== texture.category) return false;
  return true;
}
function pairTextureGroups(files) {
  const models=files.filter(f=>/\.(ydd|ydr|yft)$/i.test(f.name));
  const groups=new Map();
  const hidden=new Set();
  for (const model of models) groups.set(model.id,[]);
  for (const texture of files.filter(f=>/\.ytd$/i.test(f.name))) {
    const candidates=models.filter(model=>pairedTextureNames(model,texture));
    if (!candidates.length) continue;
    for (const model of candidates) groups.get(model.id).push({id:texture.id,name:texture.name});
    hidden.add(texture.id);
  }
  for (const items of groups.values()) items.sort((a,b)=>
    a.name.localeCompare(b.name,undefined,{numeric:true}));
  return {visible:files.filter(f=>!hidden.has(f.id)),groups,hidden};
}
module.exports={pairTextureGroups,pairedTextureNames,textureFamily};
