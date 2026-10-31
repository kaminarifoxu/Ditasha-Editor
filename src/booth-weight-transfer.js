// Conservative weight transfer for meshes already aligned in the same GTA model space.
// Never uses unrelated bone index order or invents skinning for distant geometry.
export function transferSkinWeights(targetPositions, source, { maxDistance = 0.09, cellSize = 0.09, minCoverage = 0.995 } = {}) {
  const positions = source?.positions, skin = source?.skin, rig = source?.rig;
  const n = targetPositions?.length / 3, m = positions?.length / 3;
  if (!Number.isInteger(n) || !Number.isInteger(m) || n < 1 || m < 1 ||
      n > 150000 || m > 300000 || !Array.isArray(rig) || !rig.length ||
      !skin?.indices || !skin?.weights || skin.indices.length !== m * 4 ||
      skin.weights.length !== m * 4 ||
      !Number.isFinite(cellSize) || cellSize <= 0 || !Number.isFinite(maxDistance) ||
      maxDistance <= 0 || maxDistance > 0.25 || minCoverage < 0.95 || minCoverage > 1)
    return null;
  const key = (x,y,z) => x + ',' + y + ',' + z;
  const cells = new Map();
  for (let j=0;j<m;j++) {
    const offset=j*3, x=positions[offset], y=positions[offset+1], z=positions[offset+2];
    if (![x,y,z].every(Number.isFinite)) return null;
    let valid=false;
    for(let k=0;k<4;k++) {
      const weight=skin.weights[j*4+k], index=skin.indices[j*4+k];
      if (!Number.isFinite(weight) || weight<0) return null;
      if(weight>0) {
        if(!Number.isInteger(index) || index<0 || index>=rig.length) return null;
        valid=true;
      }
    }
    if(!valid) continue;
    const index=key(Math.floor(x/cellSize),Math.floor(y/cellSize),Math.floor(z/cellSize));
    if(!cells.has(index))cells.set(index,[]);
    cells.get(index).push(j);
  }
  if (!cells.size) return null;
  const indices=new Uint16Array(n*4),weights=new Float32Array(n*4);
  const r=Math.ceil(maxDistance/cellSize), maxSq=maxDistance*maxDistance;
  let matched=0;
  for(let i=0;i<n;i++){
    const o=i*3,x=targetPositions[o],y=targetPositions[o+1],z=targetPositions[o+2];
    if (![x,y,z].every(Number.isFinite)) return null;
    const cx=Math.floor(x/cellSize),cy=Math.floor(y/cellSize),cz=Math.floor(z/cellSize);
    let best=-1,bestSq=maxSq;
    for(let dx=-r;dx<=r;dx++)for(let dy=-r;dy<=r;dy++)for(let dz=-r;dz<=r;dz++){
      const bucket=cells.get(key(cx+dx,cy+dy,cz+dz));
      if(!bucket)continue;
      for(const j of bucket){
        const k=j*3,ax=positions[k]-x,ay=positions[k+1]-y,az=positions[k+2]-z;
        const dist=ax*ax+ay*ay+az*az;
        if(dist<=bestSq){bestSq=dist;best=j;}
      }
    }
    if(best<0)continue;
    matched++;
    let sum=0;
    for(let k=0;k<4;k++){
      const weight=skin.weights[best*4+k];
      indices[i*4+k]=skin.indices[best*4+k];
      weights[i*4+k]=weight;
      sum+=weight;
    }
    if(sum<=0)return null;
    for(let k=0;k<4;k++)weights[i*4+k]/=sum;
  }
  if(matched/n<minCoverage)return null;
  // Never leave vertices with all-zero weights even if overall coverage was high.
  if(matched!==n)return null;
  return {indices,weights,rig,coverage:matched/n};
}
