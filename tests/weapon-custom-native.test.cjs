'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const fs=require('node:fs/promises');
const os=require('node:os');
const {createHash}=require('node:crypto');
const {execFileSync}=require('node:child_process');
const {assertGlb,validateCustomReport,buildCustomWeapon}=require('../electron/creators/weapon-custom-build.cjs');
const {createWeaponFolderGrants}=require('../electron/creators/weapon-schema.cjs');
const donor='w_pi_pistol',model='w_pi_ditashatest';
const native=Buffer.concat([Buffer.from('RSC7'),Buffer.from([13,0,0,0]),Buffer.alloc(92)]);
const anchors={
  muzzle:{name:'WAPSupp',position:[0,0,0.2]},
  magazine:{name:'WAPClip',position:[-0.1,0,0]},
  grip:{name:'WAPGrip',position:[0,-0.1,0]},
};
function glb(){
  const json=Buffer.from('{"asset":{"version":"2.0"}}','utf8');
  const aligned=Buffer.alloc(Math.ceil(json.length/4)*4,0x20);json.copy(aligned);
  const header=Buffer.alloc(20);
  header.write('glTF',0);header.writeUInt32LE(2,4);
  header.writeUInt32LE(header.length+aligned.length,8);
  header.writeUInt32LE(aligned.length,12);header.writeUInt32LE(0x4e4f534a,16);
  return Buffer.concat([header,aligned]);
}
const hash=b=>createHash('sha256').update(b).digest('hex');
async function fixture(t){
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'ditasha-custom-native-'));
  t.after(()=>fs.rm(root,{recursive:true,force:true}));
  const source=path.join(root,'donor'),output=path.join(root,'output'),data=path.join(root,'data');
  await Promise.all([fs.mkdir(source),fs.mkdir(output),fs.mkdir(path.join(data,'native-tools'),{recursive:true})]);
  await fs.writeFile(path.join(source,donor+'.ydr'),native);
  await fs.writeFile(path.join(source,donor+'.ytd'),native);
  const engine=path.join(data,'native-tools','blender.exe');
  await fs.writeFile(engine,Buffer.alloc(100));
  await fs.writeFile(path.join(data,'native-tools','ready.json'),JSON.stringify({version:1,engine}));
  const grants=createWeaponFolderGrants();
  const st=await grants.issue('source',source),ot=await grants.issue('output',output);
  const request={schemaVersion:1,edition:'legacy',reference:'WEAPON_PISTOL',
    name:'Ditasha Custom Weapon',modelName:model,price:5000,
    sourceToken:st.token,outputToken:ot.token};
  return {root,source,output,data,grants,request};
}
test('GLB assembly accepts only bounded real binary GLB headers',()=>{
  assert.equal(assertGlb(glb()).toString('ascii',0,4),'glTF');
  for(const bad of [
    Buffer.alloc(20),Buffer.from('not a GLB'),glb().subarray(0,25),
    Buffer.alloc(65*1024*1024),
  ])assert.throws(()=>assertGlb(bad));
});
test('Custom weapon report requires matching meshes, textures, filename and anchor parity',()=>{
  const spec={reference:'WEAPON_PISTOL',modelName:model};
  const good={schema:1,ok:true,nativeRoundTrip:true,modelName:model,
    donorModel:donor,customMeshCount:2,customPolygonCount:18,
    roundTripPolygonCount:18,textureCount:3,
    uvCornerCount:54,bounds:[[0,0,0],[1,1,1]],
    anchors,anchorsAfter:anchors,artifacts:[
      {name:model+'.ydr'},{name:model+'.ytd'},
    ]};
  assert.deepEqual(validateCustomReport(good,spec),[model+'.ydr',model+'.ytd']);
  for(const broken of [
    {...good,textureCount:0},
    {...good,uvCornerCount:0},
    {...good,bounds:[[0,0,0],[Number.NaN,1,1]]},
    {...good,customPolygonCount:19},
    {...good,artifacts:[{name:model+'.ydr'},{name:model+'.ydr'}]},
    {...good,anchorsAfter:{...anchors,muzzle:{name:'WAPSupp',position:[0,0,1]}}},
  ])assert.throws(()=>validateCustomReport(broken,spec));
});
test('Custom native Blender worker includes donor-rigged mesh and DDS/UV checks',()=>{
  const script=path.resolve(__dirname,'../electron/creators/weapon-custom-native.py');
  const python=process.platform==='win32'?'python':'python3';
  const check='import ast,pathlib,sys; s=pathlib.Path(sys.argv[1]).read_text(); ast.parse(s); assert all(v in s for v in ["bpy.ops.sollumz.import_assets","bpy.ops.sollumz.export_assets","armature","vertex_groups","uv_layers","customPolygonCount","textureCount"]);print("OK")';
  assert.match(execFileSync(python,['-c',check,script],{encoding:'utf8',timeout:10000}),/OK/);
});
test('Native custom weapon builds YDR + YTD without exposing original GLB or overwriting donor',async t=>{
  const f=await fixture(t);
  const {createYtd}=await import('../src/asset-tools.js');
  const ytd=Buffer.from(createYtd([{name:'diffuse_0',w:4,h:4,out:new Uint8Array(64).fill(255)}]));
  const runner=async({args})=>{
    const job=JSON.parse(await fs.readFile(args.at(-1),'utf8'));
    const root=path.dirname(args.at(-1));
    assert.equal(job.modelName,model);
    assert.equal(job.donorModel,donor);
    assert.deepEqual(await fs.readFile(path.join(root,'weapon-design.glb')),glb());
    assert.ok((await fs.readFile(path.join(root,'prop_dds.py'),'utf8')).includes('encode_dds_rgba'));
    assert.ok((await fs.readFile(path.join(root,'prop_material.py'),'utf8')).includes('material_diffuse_spec'));
    const stream=path.join(root,'stream');
    await fs.mkdir(stream);
    const artifacts=[];
    for(const [name,contents] of [[model+'.ydr',native],[model+'.ytd',ytd]]){
      await fs.writeFile(path.join(stream,name),contents);
      artifacts.push({name,bytes:contents.length,sha256:hash(contents)});
    }
    await fs.writeFile(path.join(root,'weapon-custom-report.json'),JSON.stringify({
      schema:1,ok:true,nativeRoundTrip:true,modelName:model,donorModel:donor,
      customMeshCount:1,customPolygonCount:12,roundTripPolygonCount:12,
      textureCount:1,uvCornerCount:36,bounds:[[0,0,0],[1,1,1]],anchors,anchorsAfter:anchors,artifacts,
    }));
  };
  const result=await buildCustomWeapon({request:f.request,bytes:glb(),grants:f.grants,userDataRoot:f.data,runner});
  assert.deepEqual(result.nativeFiles,[model+'.ydr',model+'.ytd']);
  assert.equal(result.nativeRoundTripPassed,true);
  assert.equal(result.gameTestPassed,null);
  assert.deepEqual(await fs.readdir(path.join(result.output,'stream')),[model+'.ydr',model+'.ytd']);
  assert.deepEqual(await fs.readFile(path.join(f.source,donor+'.ydr')),native);
  assert.deepEqual((await fs.readdir(f.output)).length,1);
  await assert.rejects(fs.stat(path.join(result.output,'weapon-design.glb')));
  await assert.rejects(fs.stat(path.join(result.output,'weapon-custom-job.json')));
});
test('Native custom export refuses worker failures and cleans only its stage',async t=>{
  const f=await fixture(t);
  await assert.rejects(buildCustomWeapon({
    request:f.request,bytes:glb(),grants:f.grants,userDataRoot:f.data,
    runner:async()=>{throw Error('Native Sollumz failed');},
  }),/Native Sollumz failed/);
  assert.deepEqual(await fs.readdir(f.output),[]);
});
