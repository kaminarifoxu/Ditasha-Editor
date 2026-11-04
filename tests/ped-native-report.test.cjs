'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {createHash}=require('node:crypto');
const {validatePedNativeReport,verifyPedNativeArtifacts}=require('../electron/ped-native-report.cjs');

const native=Buffer.concat([Buffer.from('RSC7'),Buffer.from([13,0,0,0]),Buffer.alloc(128)]);
const hash=b=>createHash('sha256').update(b).digest('hex');
const manifest=(name,bytes=native)=>({
  name,relativePath:'stream/'+name,bytes:bytes.length,sha256:hash(bytes)
});
const report=(ytd=native)=>({
 ok:true,nativeValidation:{
  schema:1,nativeYddRoundTrip:true,nativeYftSignatureVerified:true,
  nativeYftRagdollRoundTrip:false,sourceSkeletonMatched:true,
  headHairAlignment:{checked:true,aligned:true,centerDistanceMeters:0.08},
  rigs:[{vertices:3,weightedVertices:3,bones:128,headBone:'SKEL_Head',uvMeshes:1}],
  files:{
   '.ydd':[manifest('ped.ydd')],
   '.yft':[manifest('ped.yft')],
   '.ytd':[manifest('ped.ytd',ytd)]
  }
 }
});
test('ped native completion report gates skin weights, skeleton, texture inventory and alignment',()=>{
 const good=report();
 assert.equal(validatePedNativeReport(good).length,3);
 const cases=[
  {...good,nativeValidation:{...good.nativeValidation,nativeYddRoundTrip:false}},
  {...good,nativeValidation:{...good.nativeValidation,sourceSkeletonMatched:false}},
  {...good,nativeValidation:{...good.nativeValidation,headHairAlignment:{checked:true,aligned:false}}},
  {...good,nativeValidation:{...good.nativeValidation,rigs:[{...good.nativeValidation.rigs[0],weightedVertices:0}]}},
  {...good,nativeValidation:{...good.nativeValidation,files:{...good.nativeValidation.files,'.ydd':[]}}},
  {...good,nativeValidation:{...good.nativeValidation,files:{...good.nativeValidation.files,'.ydd':[{...good.nativeValidation.files['.ydd'][0],relativePath:'../escape.ydd'}]}}},
 ];
 for(const bad of cases)assert.throws(()=>validatePedNativeReport(bad));
});
test('ped save gate detects modified native YDD/YFT and indexes real YTD',async t=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'ditasha-ped-native-save-'));
 t.after(()=>fs.rm(root,{recursive:true,force:true}));
 const {createYtd}=await import('../src/asset-tools.js');
 const ytd=Buffer.from(createYtd([{name:'diffuse',w:4,h:4,out:new Uint8Array(64).fill(255)}]));
 const r=report(ytd);
 await fs.mkdir(path.join(root,'stream'));
 for(const ext of ['ydd','yft'])await fs.writeFile(path.join(root,'stream','ped.'+ext),native);
 await fs.writeFile(path.join(root,'stream','ped.ytd'),ytd);
 const good=await verifyPedNativeArtifacts(root,r);
 assert.equal(good.artifacts,3);
 assert.equal(good.textures,1);
 await fs.writeFile(path.join(root,'stream','ped.ydd'),Buffer.from(native.map((x,i)=>i===20?x^7:x)));
 await assert.rejects(verifyPedNativeArtifacts(root,r),/content changed/);
});
test('ped save flow verifies native files prior to persisting the result',async()=>{
 const source=await fs.readFile(path.resolve(__dirname,'../electron/native-build.cjs'),'utf8');
 const call=source.indexOf('await verifyPedNativeArtifacts(pending.output, state.report)');
 const destination=source.indexOf("destination = await fs.mkdtemp(",call);
 assert.ok(call>0 && destination>call);
});
