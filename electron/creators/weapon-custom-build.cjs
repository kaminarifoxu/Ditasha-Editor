'use strict';
const fs=require('node:fs/promises');
const path=require('node:path');
const {randomUUID}=require('node:crypto');
const {managedEnv}=require('../native-setup.cjs');
const {managedExecutable}=require('./prop-build.cjs');
const {runNativeProcess,cleanupStaging}=require('./native-process.cjs');
const {validateArtifacts,commitExport}=require('./export-validation.cjs');
const {indexEditorYtd}=require('./ytd-compat.cjs');
const {validateWeaponBuildRequest,inspectWeaponSource,WEAPON_REFERENCES}=require('./weapon-schema.cjs');

const MAX_GLB=64*1024*1024;
function assertGlb(bytes) {
  // Renderer payload is never allowed to specify native filesystem paths.
  const input=bytes instanceof Uint8Array?bytes:
    bytes instanceof ArrayBuffer?new Uint8Array(bytes):null;
  if(!input||input.byteLength<20||input.byteLength>MAX_GLB)throw Error('Custom weapon GLB must be 20 bytes to 64 MiB');
  const buffer=Buffer.from(input);
  if(buffer.toString('ascii',0,4)!=='glTF'||buffer.readUInt32LE(4)!==2||
      buffer.readUInt32LE(8)!==buffer.byteLength)throw Error('Invalid binary GLB header');
  if(buffer.readUInt32LE(12)<2||buffer.readUInt32LE(16)!==0x4e4f534a)
    throw Error('Custom weapon GLB has no JSON chunk');
  return buffer;
}
function validateCustomReport(report,spec) {
  if(!report||report.schema!==1||report.ok!==true||report.nativeRoundTrip!==true||
     report.modelName!==spec.modelName||report.donorModel!==WEAPON_REFERENCES[spec.reference]||
     !Number.isSafeInteger(report.customMeshCount)||report.customMeshCount<1||
     !Number.isSafeInteger(report.customPolygonCount)||report.customPolygonCount<1||
     !Number.isSafeInteger(report.roundTripPolygonCount)||
     report.roundTripPolygonCount!==report.customPolygonCount||
     !Number.isSafeInteger(report.textureCount)||report.textureCount<1||
     !report.anchors||!report.anchorsAfter)throw Error('Custom YDR/YTD exporter did not verify geometry, textures and skeleton');
  for(const kind of ['muzzle','magazine','grip']){
    const a=report.anchors[kind],b=report.anchorsAfter[kind];
    if(!a||!b||a.name!==b.name||!Array.isArray(a.position)||!Array.isArray(b.position)||
       a.position.length!==3||b.position.length!==3||[...a.position,...b.position].some(x=>!Number.isFinite(x))||
       Math.hypot(...a.position.map((v,i)=>v-b.position[i]))>0.002)
      throw Error('Custom weapon donor '+kind+' anchor failed native reimport');
  }
  const expected=[spec.modelName+'.ydr',spec.modelName+'.ytd'];
  if(!Array.isArray(report.artifacts)||report.artifacts.length!==2||
     expected.some(name=>!report.artifacts.some(a=>a.name===name))||
     new Set(report.artifacts.map(a=>a.name)).size!==2)
    throw Error('Custom weapon export missing required YDR/YTD');
  return expected;
}
async function buildCustomWeapon({request,bytes,grants,userDataRoot,signal,runner=runNativeProcess}={}) {
  const spec=validateWeaponBuildRequest(request);
  const source=await grants.resolve(spec.sourceToken,'source');
  const output=await grants.resolve(spec.outputToken,'output');
  if(source===output||output.startsWith(source+path.sep))
    throw Error('Custom weapon export destination cannot be inside donor source');
  const donor=await inspectWeaponSource(source,spec.reference);
  const binary=assertGlb(bytes);
  const {engine,root}=await managedExecutable(path.join(userDataRoot,'native-tools'));
  signal?.throwIfAborted();
  const staging=await fs.mkdtemp(path.join(output,'ditasha-weapon-custom-'));
  const destination=path.join(output,spec.modelName+'-native-'+randomUUID().slice(0,8));
  let committed=false;
  try{
    const scripts=['weapon-custom-native.py','prop_dds.py','prop_material.py'];
    for(const name of scripts)await fs.copyFile(path.join(__dirname,name),path.join(staging,name));
    await fs.writeFile(path.join(staging,'weapon-design.glb'),binary,{flag:'wx',mode:0o600});
    const job=path.join(staging,'weapon-custom-job.json');
    await fs.writeFile(job,JSON.stringify({
      schema:1,edition:'legacy',donorPath:donor.folder,
      donorModel:donor.model,modelName:spec.modelName,glb:'weapon-design.glb',
    }),{flag:'wx',mode:0o600});
    await runner({executable:engine,cwd:root,env:managedEnv(root),signal,
      args:['--background','--disable-autoexec','--python-exit-code','2',
            '--python',path.join(staging,'weapon-custom-native.py'),'--',job],
      timeoutMs:15*60*1000,maxOutputBytes:384*1024});
    signal?.throwIfAborted();
    const report=JSON.parse(await fs.readFile(path.join(staging,'weapon-custom-report.json'),'utf8'));
    const names=validateCustomReport(report,spec);
    const artifacts=names.map(name=>({
      relativePath:'stream/'+name,
      bytes:report.artifacts.find(a=>a.name===name).bytes,
      sha256:report.artifacts.find(a=>a.name===name).sha256,
    }));
    await validateArtifacts(staging,artifacts);
    for(const name of names){
      const file=await fs.readFile(path.join(staging,'stream',name));
      if(file.subarray(0,4).toString('ascii')!=='RSC7'||file.readUInt32LE(4)!==13)
        throw Error('Custom weapon output must be GTA V Legacy RSC7');
    }
    const ytd=indexEditorYtd(await fs.readFile(path.join(staging,'stream',spec.modelName+'.ytd')));
    if(ytd.textureCount!==report.textureCount)throw Error('YTD does not match round-trip texture count');
    // Do not ship temporary model, confidential donor paths, executable scripts or DDS staging.
    await fs.rm(path.join(staging,'weapon-design.glb'),{force:true});
    await fs.rm(job,{force:true});
    for(const name of scripts)await fs.rm(path.join(staging,name),{force:true});
    await fs.rm(path.join(staging,'dds-cache'),{recursive:true,force:true});
    await fs.writeFile(path.join(staging,'validation.json'),JSON.stringify({
      schema:1,format:'native-ydr-ytd',modelName:spec.modelName,
      nativeRoundTripPassed:true,gameTestPassed:null,
      customMeshCount:report.customMeshCount,customPolygonCount:report.customPolygonCount,
      textureCount:report.textureCount,anchors:report.anchorsAfter,
      note:'YDR/YTD only. GTA weapon metadata and actual FiveM gameplay are not certified.',
    },null,2),{flag:'wx'});
    await grants.resolve(spec.sourceToken,'source');
    await grants.resolve(spec.outputToken,'output');
    signal?.throwIfAborted();
    const verified=await validateArtifacts(staging,[...artifacts,
      {relativePath:'validation.json'},{relativePath:'weapon-custom-report.json'}]);
    const committedOutput=await commitExport({
      stagingRoot:staging,destinationRoot:destination,artifacts:verified,
    });
    committed=true;
    return {output:committedOutput.output,modelName:spec.modelName,
      nativeFiles:names,nativeRoundTripPassed:true,gameTestPassed:null,
      customMeshCount:report.customMeshCount,textureCount:report.textureCount};
  }finally{
    if(!committed)await cleanupStaging(staging,output);
  }
}
module.exports={assertGlb,validateCustomReport,buildCustomWeapon};
