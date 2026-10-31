'use strict';
const path=require('node:path');
function pairTextureGroups(files) {
  const models=files.filter(f=>/\.(ydd|ydr|yft)$/i.test(f.name));
  const groups=new Map();
  const hidden=new Set();
  for(const model of models)groups.set(model.id,[]);
  for(const texture of files.filter(f=>/\.ytd$/i.test(f.name))){
    const folder=path.posix.dirname(texture.relative);
    const candidates=models.filter(model=>
      path.posix.dirname(model.relative)===folder &&
      ((texture.group && model.group===texture.group && model.category===texture.category) ||
       texture.name.toLowerCase()===model.name.toLowerCase().replace(/(?:_hi)?\.[^.]+$/,'.ytd')));
    if(!candidates.length)continue;
    // Multiple YDD variants in the same slot share one YTD family.
    for(const model of candidates)groups.get(model.id).push({id:texture.id,name:texture.name});
    hidden.add(texture.id);
  }
  return {visible:files.filter(f=>!hidden.has(f.id)),groups,hidden};
}
module.exports={pairTextureGroups};
