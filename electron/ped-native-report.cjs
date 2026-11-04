'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const {createHash} = require('node:crypto');
const {indexEditorYtd} = require('./creators/ytd-compat.cjs');

const EXTS = ['.ydd','.yft','.ytd'];
function validatePedNativeReport(report) {
  const native = report?.nativeValidation;
  if(!report?.ok || !native || native.schema!==1 ||
      native.nativeYddRoundTrip!==true || native.nativeYftSignatureVerified!==true ||
      native.sourceSkeletonMatched!==true || !Array.isArray(native.rigs) ||
      !native.rigs.length || native.rigs.length>128)
    throw Error('Native ped export has no validated YDD round-trip or source skeleton');
  if(native.headHairAlignment?.checked && native.headHairAlignment.aligned!==true)
    throw Error('Native ped head/hair alignment failed');
  for(const rig of native.rigs){
    if(!Number.isInteger(rig.vertices)||rig.vertices<1 ||
      rig.weightedVertices!==rig.vertices ||
      !Number.isInteger(rig.bones)||rig.bones<30 ||
      rig.headBone!=='SKEL_Head' && rig.headBone!=='head' ||
      !Number.isInteger(rig.uvMeshes)||rig.uvMeshes<1)
      throw Error('Native ped skin, UV or skeleton verification is incomplete');
  }
  const inventory=native.files;
  if(!inventory || typeof inventory!=='object')throw Error('Missing ped inventory');
  const manifests=[];
  for(const ext of EXTS){
    const files=inventory[ext];
    if(!Array.isArray(files)||files.length<1||files.length>128)
      throw Error('Missing validated ped '+ext);
    for(const f of files){
      if(typeof f.relativePath!=='string'||!f.relativePath.endsWith(ext)||
         f.relativePath.startsWith('/')||f.relativePath.includes('\\')||
         f.relativePath.split('/').some(x=>!x||x==='.'||x==='..')||
         !/^[a-z0-9_. /-]+$/i.test(f.relativePath)||
         !Number.isSafeInteger(f.bytes)||f.bytes<64||f.bytes>256*1024*1024||
         !/^[0-9a-f]{64}$/.test(f.sha256))
        throw Error('Unsafe native ped file manifest');
      manifests.push(f);
    }
  }
  if(new Set(manifests.map(f=>f.relativePath.toLowerCase())).size!==manifests.length)
    throw Error('Duplicate native ped output');
  return manifests;
}
async function verifyPedNativeArtifacts(output, report) {
  const root=await fs.realpath(output);
  const manifests=validatePedNativeReport(report);
  let textures=0;
  for(const f of manifests){
    const relative=f.relativePath.split('/');
    const filename=path.join(root,...relative);
    const actual=await fs.realpath(filename);
    if(!actual.startsWith(root+path.sep))throw Error('Ped artifact escaped staging');
    const stat=await fs.stat(actual);
    if(!stat.isFile()||stat.size!==f.bytes)throw Error('Ped native file size changed');
    const data=await fs.readFile(actual);
    if(createHash('sha256').update(data).digest('hex')!==f.sha256)
      throw Error('Ped native file content changed after verification');
    if(data.subarray(0,4).toString('ascii')!=='RSC7'||data.readUInt32LE(4)!==13)
      throw Error('Ped native file has invalid Legacy RSC7 signature');
    if(f.relativePath.toLowerCase().endsWith('.ytd')){
      const info=indexEditorYtd(data);
      if(info.textureCount<1)throw Error('Ped YTD contains no readable textures');
      textures+=info.textureCount;
    }
  }
  return {artifacts:manifests.length,textures};
}
module.exports={validatePedNativeReport,verifyPedNativeArtifacts};
