// Offline facial morph engine. GTA-compatible exact shapes require calibrated
// target meshes with identical topology to the previewed head YDD.
// No model files or calibrated delta data are shipped with this module.
const finite=n=>typeof n==='number'&&Number.isFinite(n);
export function topologySignature(indices) {
  if(!indices || !Number.isInteger(indices.length))throw Error('Missing mesh indices');
  // FNV-1a over index values in their exact original order.
  let hash=2166136261;
  for(const index of indices){
    if(!Number.isInteger(index)||index<0)throw Error('Invalid mesh index');
    hash=Math.imul(hash ^ index,16777619)>>>0;
  }
  return indices.length+':'+hash.toString(16).padStart(8,'0');
}

export function validateMorphPack(pack, vertexCount, indices = null) {
  if(!pack||pack.version!==1||!Number.isInteger(vertexCount)||vertexCount<=0)throw Error('Invalid morph pack or vertex count');
  if(pack.vertexCount!==vertexCount)throw Error('Morph pack topology differs from this YDD');
  if(pack.indexSignature && (!indices || topologySignature(indices)!==pack.indexSignature))
    throw Error('Morph pack triangle topology differs from this YDD');
  if(!Array.isArray(pack.targets)||pack.targets.length>128)throw Error('Invalid morph targets');
  for(const target of pack.targets){
    if(!/^feature:(?:[0-9]|1[0-9])$/.test(target.key)&&!/^parent:(?:first|second)$/.test(target.key))
      throw Error('Unsupported morph channel: '+String(target.key));
    if(!Array.isArray(target.deltas)||target.deltas.length!==vertexCount*3||
       !target.deltas.every(finite))throw Error('Invalid morph delta buffer');
  }
  return true;
}
export function applyMorphPack(positions, pack, appearance, indices = null) {
  if(!positions||positions.length%3!==0)throw Error('Invalid geometry');
  validateMorphPack(pack,positions.length/3,indices);
  const output=new Float32Array(positions);
  const head=appearance||{};
  const channels=new Map();
  for(let i=0;i<20;i++)channels.set('feature:'+i,Math.max(-1,Math.min(1,Number(head.features?.[i])||0)));
  const mix=Math.max(0,Math.min(1,Number(head.shapeMix??0.5)));
  channels.set('parent:first',1-mix);
  channels.set('parent:second',mix);
  for(const target of pack.targets){
    const weight=channels.get(target.key)||0;
    if(!weight)continue;
    for(let i=0;i<output.length;i++)output[i]+=target.deltas[i]*weight;
  }
  return output;
}
