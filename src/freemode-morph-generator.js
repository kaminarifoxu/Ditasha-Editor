import { topologySignature } from './freemode-morph-pack.js';
import { decodeResource } from './resource-client.js';
import { defaultDrawableSelection, drawableView } from './drawable-selection.js';
const validChannel=key=>/^feature:(?:[0-9]|1[0-9])$/.test(key)||/^parent:(?:first|second)$/.test(key);
export async function extractHeadGeometry(file){
 if(!file || !/\.ydd$/i.test(file.name) || file.size>64*1024*1024)throw Error('Pilih file kepala .ydd maksimal 64MB.');
 const data=await decodeResource('ydd',await file.arrayBuffer());
 const drawable=drawableView(data,defaultDrawableSelection(data));
 const high=drawable?.lods?.find(l=>l.name==='High')||drawable?.lods?.[0];
 const candidate=high?.geometries?.find(g=>/head|face|skin/i.test((g.name||'')+' '+(g.diffuseTexture||'')))||high?.geometries?.[0];
 if(!candidate?.positions?.length)throw Error('File YDD tidak memiliki geometri terbaca.');
 return {positions:candidate.positions,indices:candidate.indices,name:candidate.name||'mesh'};
}
export function makeMorphTarget(base,target,key,{tolerance=1e-7}={}){
 if(!validChannel(key))throw Error('Channel morph tidak dikenal.');
 if(!base?.positions||!target?.positions||base.positions.length!==target.positions.length||
   base.positions.length%3!==0)throw Error('Jumlah vertex tidak sama.');
 if(!base.indices||!target.indices||base.indices.length!==target.indices.length||
   !Array.from(base.indices).every((v,i)=>v===target.indices[i]))
   throw Error('Urutan/index segitiga tidak sama. Perlu mesh bertopologi identik.');
 const deltas=new Array(base.positions.length);
 let changes=0;
 for(let i=0;i<deltas.length;i++){
   const diff=target.positions[i]-base.positions[i];
   if(!Number.isFinite(diff))throw Error('Vertex tidak valid.');
   deltas[i]=Math.abs(diff)>tolerance?diff:0;
   if(deltas[i])changes++;
 }
 if(!changes)throw Error('Tidak ditemukan perubahan bentuk antara dua model.');
 return {version:1,vertexCount:base.positions.length/3,indexSignature:topologySignature(base.indices),targets:[{key,deltas}],details:{base:base.name,target:target.name,changedCoordinates:changes}};
}
