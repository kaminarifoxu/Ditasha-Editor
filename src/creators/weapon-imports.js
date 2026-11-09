// Weapon Studio-only file intake. A visual GLB/prop is editable in the
// workspace but is NOT automatically grafted into a native GTA weapon rig.
const MODEL_EXTENSIONS = new Set(['glb', 'obj', 'ydr', 'ydd']);
const TEXTURE_EXTENSIONS = new Set(['ytd']);
function extension(name) {
  return typeof name === 'string' ? name.toLowerCase().split('.').pop() : '';
}
export function validateWeaponImportSelection(files, mode) {
  if (!Array.isArray(files) || !['base','part','native'].includes(mode))
    throw Error('Invalid Weapon Studio import request');
  if (!files.length || files.length > 12) throw Error('Select a model (maximum 12 files).');
  const models=files.filter(file=>MODEL_EXTENSIONS.has(extension(file?.name)));
  const textures=files.filter(file=>TEXTURE_EXTENSIONS.has(extension(file?.name)));
  if (files.length !== models.length + textures.length)
    throw Error('Weapon Studio accepts GLB, OBJ, YDR, YDD and YTD files only.');
  if (models.length !== 1) throw Error('Select exactly one GLB, OBJ, YDR or YDD model.');
  if (files.some(file=>!Number.isSafeInteger(file.size)||file.size<1))
    throw Error('Weapon source file is empty or invalid.');
  if (files.reduce((size,file)=>size+file.size,0)>128*1024*1024 || models[0].size>64*1024*1024)
    throw Error('Weapon import exceeds the existing 128 MB total / 64 MB model limits.');
  const isNative=['ydr','ydd'].includes(extension(models[0].name));
  if (mode==='native' && !isNative)
    throw Error('The GTA native import requires a YDR or YDD model.');
  if (textures.length && !isNative)
    throw Error('YTD dictionaries can only accompany YDR/YDD models.');
  if (mode==='native' && !textures.length)
    throw Error('Select the GTA model and its matching YTD together.');
  const names=new Set();
  for (const file of files) {
    const key=file.name.toLowerCase();
    if (names.has(key)) throw Error('Duplicate weapon input filename.');
    names.add(key);
  }
  if (textures.length && !textures.some(file=>
    file.name.toLowerCase().replace(/\.ytd$/,'')===
    models[0].name.toLowerCase().replace(/\.(ydr|ydd)$/,''))) {
    if (mode==='native') throw Error('YDR/YDD and YTD base filenames must match.');
  }
  return Object.freeze({
    model:models[0], textures,mode,
    isNative, editablePreviewOnly:true, nativeWeaponRigCertified:false,
  });
}
