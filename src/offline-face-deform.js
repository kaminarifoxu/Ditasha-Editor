// Offline preview-only facial deformation. This is not Rockstar's proprietary head-blend algorithm.
// Uses mesh-local bounds and smooth spatial falloffs. Never edits source YDD or exports deformed meshes.
export function deformFacePositions(positions, features, blend = 0.5) {
  if (!positions || positions.length % 3 || positions.length < 9) return null;
  const box={min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]};
  for(let i=0;i<positions.length;i+=3)
    for(let k=0;k<3;k++){const v=positions[i+k];if(!Number.isFinite(v))return null;box.min[k]=Math.min(box.min[k],v);box.max[k]=Math.max(box.max[k],v);}
  const d=box.max.map((n,i)=>Math.max(n-box.min[i],1e-6));
  if(d.some(x=>x<1e-5))return null;
  const result=new Float32Array(positions);
  const value=i=>Math.max(-1,Math.min(1,Number(features?.[i])||0));
  const smooth=(n,center,width)=>{const a=Math.max(0,1-Math.abs(n-center)/width);return a*a*(3-2*a);};
  const blendBias=(Math.max(0,Math.min(1,Number(blend)||0))-0.5)*0.08;
  for(let i=0;i<positions.length;i+=3){
    const x=(positions[i]-box.min[0])/d[0],y=(positions[i+1]-box.min[1])/d[1],z=(positions[i+2]-box.min[2])/d[2];
    // These axis-local masks are an approximate visual guide only.
    const central=smooth(x,0.5,0.27),nose=central*smooth(y,0.57,0.23)*smooth(z,0.75,0.42);
    const eyes=smooth(y,0.69,0.13)*smooth(z,0.76,0.35);
    const cheeks=smooth(y,0.48,0.24)*smooth(z,0.65,0.45);
    const jaw=smooth(y,0.20,0.24);
    const lips=central*smooth(y,0.36,0.10)*smooth(z,0.78,0.4);
    const a=Math.sign(x-0.5);
    result[i]+=(a*(value(0)*nose*0.07+value(9)*cheeks*0.045+value(13)*jaw*0.07)+
      a*blendBias*cheeks)*d[0];
    result[i+1]+=(value(1)*nose*0.045+value(6)*eyes*0.025-
      value(15)*jaw*0.06)*d[1];
    result[i+2]+=(value(2)*nose*0.065+value(7)*eyes*0.02+
      value(12)*lips*0.055+value(14)*jaw*0.035)*d[2];
  }
  return result;
}
