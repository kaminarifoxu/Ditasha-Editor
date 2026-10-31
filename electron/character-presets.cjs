'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const GENDERS = new Set(['male','female']);
class CharacterPresets {
  constructor(root) { this.file = path.join(root, 'characters.json'); }
  async list() {
    try {
      const data = JSON.parse(await fs.readFile(this.file,'utf8'));
      if (!Array.isArray(data.items)) throw Error('Invalid character catalog');
      return data.items;
    } catch(error) { if(error.code === 'ENOENT') return []; throw error; }
  }
  async save(data) {
    if (!data || !GENDERS.has(data.gender) || typeof data.name !== 'string' ||
        !data.name.trim() || data.name.length > 80) throw Error('Invalid character name or gender');
    if (data.baseModel != null && (!/^[0-9a-f-]{36}$/i.test(data.baseModel.packId || '') ||
        typeof data.baseModel.relativePath !== 'string' || data.baseModel.relativePath.length > 512 ||
        !/\.ydd$/i.test(data.baseModel.relativePath))) throw Error('Invalid freemode base model');
    if (data.outfitId != null && !/^[0-9a-f-]{36}$/i.test(data.outfitId)) throw Error('Invalid outfit reference');
    const clamp = (n,min,max) => Number.isFinite(Number(n)) ? Math.max(min,Math.min(max,Number(n))) : 0;
    const appearance = data.appearance || {};
    const features = Array.from({length:20},(_,i)=>clamp(appearance.features?.[i]||0,-1,1));
    const overlays = Array.from({length:13},(_,i)=>clamp(appearance.overlays?.[i]||0,0,255));
    let morphPack=null;
    if(data.morphPack != null){
      const candidate=data.morphPack;
      if(candidate.version!==1 || !Number.isInteger(candidate.vertexCount) ||
        candidate.vertexCount<=0 || !Array.isArray(candidate.targets) ||
        candidate.targets.length>20)throw Error('Invalid character morph pack.');
      if(candidate.targets.some(t=>!/^feature:(?:[0-9]|1[0-9])$/.test(t.key) &&
        !/^parent:(?:first|second)$/.test(t.key)))throw Error('Invalid morph channel.');
      for(const target of candidate.targets){
        if(!Array.isArray(target.deltas) || target.deltas.length!==candidate.vertexCount*3 ||
          !target.deltas.every(v=>typeof v==='number' && Number.isFinite(v)))
          throw Error('Invalid morph target values.');
      }
      const serialized=JSON.stringify(candidate);
      if(Buffer.byteLength(serialized)>8*1024*1024)throw Error('Morph pack maksimum 8MB per karakter.');
      morphPack=JSON.parse(serialized);
    }
    const item = {
      id: /^[0-9a-f-]{36}$/i.test(data.id || '') ? data.id : crypto.randomUUID(),
      name:data.name.trim(),gender:data.gender,
      outfitId:data.outfitId || null,
      baseModel:data.baseModel || null,
      morphPack,
      appearance:{
        shapeFirst:clamp(appearance.shapeFirst||0,0,45),
        shapeSecond:clamp(appearance.shapeSecond||0,0,45),
        skinFirst:clamp(appearance.skinFirst||0,0,45),
        skinSecond:clamp(appearance.skinSecond||0,0,45),
        shapeMix:clamp(appearance.shapeMix??0.5,0,1),
        skinMix:clamp(appearance.skinMix??0.5,0,1),
        eyeColor:clamp(appearance.eyeColor||0,0,31),
        hairColor:clamp(appearance.hairColor||0,0,63),
        features, overlays
      },
      updatedAt:new Date().toISOString()
    };
    const items = await this.list();
    const index=items.findIndex(x=>x.id===item.id);
    if(index>=0)items[index]=item;
    else items.push(item);
    if(items.length>250) throw Error('Maximum 250 characters');
    await fs.mkdir(path.dirname(this.file),{recursive:true});
    const temp=this.file+'.'+crypto.randomUUID()+'.tmp';
    await fs.writeFile(temp,JSON.stringify({version:1,items},null,2));
    await fs.rename(temp,this.file);
    return item;
  }
  async remove(id) {
    if(!/^[0-9a-f-]{36}$/i.test(id)) throw Error('Invalid character ID');
    const items=await this.list();
    const next=items.filter(x=>x.id!==id);
    if(items.length===next.length)return false;
    const temp=this.file+'.'+crypto.randomUUID()+'.tmp';
    await fs.writeFile(temp,JSON.stringify({version:1,items:next},null,2));
    await fs.rename(temp,this.file);
    return true;
  }
}
module.exports={CharacterPresets};
