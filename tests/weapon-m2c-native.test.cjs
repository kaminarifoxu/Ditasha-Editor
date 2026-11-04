'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { createHash } = require('node:crypto');
const { validateWeaponBuildRequest,inspectWeaponSource,createWeaponFolderGrants,WEAPON_REFERENCES } =
  require('../electron/creators/weapon-schema.cjs');
const { validAnchorSet,buildNativeWeapon,generateFiveMManifest,prepareFiveMPackage } =
  require('../electron/creators/weapon-build.cjs');

const donorName='w_pi_pistol';
const requestBase={
  schemaVersion:1,edition:'legacy',reference:'WEAPON_PISTOL',
  name:'DITASHA Test Pistol',modelName:'w_pi_ditashatest',price:5000,
};
const nativeBinary=Buffer.concat([Buffer.from('RSC7'),Buffer.from([13,0,0,0]),Buffer.alloc(100)]);
async function fixture(t) {
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'ditasha-weapon-m2c-'));
  t.after(()=>fs.rm(root,{recursive:true,force:true}));
  const data=path.join(root,'data'),input=path.join(root,'source'),output=path.join(root,'output');
  const native=path.join(data,'native-tools');
  await fs.mkdir(input,{recursive:true});
  await fs.mkdir(output,{recursive:true});
  await fs.mkdir(native,{recursive:true});
  await fs.writeFile(path.join(input,donorName+'.ydr'),nativeBinary);
  await fs.writeFile(path.join(input,donorName+'.ytd'),nativeBinary);
  const engine=path.join(native,'blender.exe');
  await fs.writeFile(engine,Buffer.alloc(100));
  await fs.writeFile(path.join(native,'ready.json'),JSON.stringify({version:1,engine}));
  const grants=createWeaponFolderGrants();
  const source=await grants.issue('source',input),result=await grants.issue('output',output);
  const request={...requestBase,sourceToken:source.token,outputToken:result.token};
  return {root,data,input,output,grants,request};
}
const anchors={
  muzzle:{name:'WAPSupp',position:[0,0,0.2]},
  magazine:{name:'WAPClip',position:[-0.1,0,0]},
  grip:{name:'WAPGrip',position:[0,-0.1,0]},
};
const report=(artifacts)=>({
  schema:1,ok:true,nativeRoundTrip:true,sourceModel:donorName,
  before:{meshes:1,boneCount:4,textureCount:1,anchors},
  after:{meshes:1,boneCount:4,textureCount:1,anchors},
  artifacts,gameTestPassed:null,
});
function simulateNative({badAnchor=false,crash=false}={}) {
  return async ({args,executable})=>{
    assert.equal(path.basename(executable).toLowerCase(),'blender.exe');
    assert.deepEqual(args.slice(0,2),['--background','--disable-autoexec']);
    const jobFile=args.at(-1);
    const job=JSON.parse(await fs.readFile(jobFile,'utf8'));
    assert.equal(job.referenceModel,donorName);
    const stage=path.dirname(jobFile);
    const worker=await fs.readFile(args[args.indexOf('--python')+1],'utf8');
    assert.match(worker,/nativeRoundTrip/);
    if(crash)throw Error('Simulated Blender crash');
    const dir=path.join(stage,'native-roundtrip');
    await fs.mkdir(dir);
    const artifacts=[];
    for(const ext of ['.ydr','.ytd']){
      const name=donorName+ext;
      await fs.copyFile(path.join(job.source,name),path.join(dir,name));
      artifacts.push({name,bytes:nativeBinary.length,sha256:createHash('sha256').update(nativeBinary).digest('hex')});
    }
    const value=report(artifacts);
    if(badAnchor)value.after.anchors={...anchors,muzzle:{...anchors.muzzle,position:[0,0,99]}};
    await fs.writeFile(path.join(stage,'weapon-native-report.json'),JSON.stringify(value));
    return {log:'DITASHA_WEAPON_NATIVE_OK'};
  };
}
function simulateBuilder({loose=false,fail=false}={}) {
  return ()=>({
    cancel(){},
    async run(id,action,values,source,parent) {
      assert.equal(id,'weapons'); assert.equal(action,'build');
      assert.equal(values.model,'w_pi_ditashatest');
      assert.equal(path.basename(source),'source');
      if(fail)throw Error('Simulated AddonWeaponsBuilder error');
      const destination=path.join(parent,'DITASHA-weapons-build-fixture');
      await fs.mkdir(destination);
      await fs.writeFile(path.join(destination,'dlc.rpf'),Buffer.concat([Buffer.from('RPF7'),Buffer.alloc(100)]));
      if(loose){
        await fs.writeFile(path.join(destination,'w_pi_ditashatest.ydr'),nativeBinary);
        await fs.writeFile(path.join(destination,'w_pi_ditashatest.ytd'),nativeBinary);
        for(const name of ['weapons.meta','weaponarchetypes.meta','weaponanimations.meta']){
          await fs.writeFile(path.join(destination,name),'<CDataFileMgr__ContentsOfDataFileXml><Item>weapon</Item></CDataFileMgr__ContentsOfDataFileXml>');
        }
      }
      return {success:true,output:destination};
    },
  });
}
test('M2c weapon source grant, Legacy model and request validation are constrained',async t=>{
  const f=await fixture(t);
  const request=validateWeaponBuildRequest(f.request);
  assert.equal(request.reference,'WEAPON_PISTOL');
  assert.equal((await inspectWeaponSource(f.input,request.reference)).model,donorName);
  assert.deepEqual(validateWeaponBuildRequest(request),request);
  for(const invalid of [
    {...request,modelName:'../evil'}, {...request,edition:'enhanced'},
    {...request,reference:'WEAPON_NOT_REAL'}, {...request,price:1.2},
    {...request,extraCommand:'powershell'},
  ])assert.throws(()=>validateWeaponBuildRequest(invalid));
  const unexpected=path.join(f.input,'program.exe');
  await fs.writeFile(unexpected,'binary');
  await assert.rejects(inspectWeaponSource(f.input,'WEAPON_PISTOL'),/Unsupported file/);
});
test('M2c checks grip, muzzle and magazine names and positions',()=>{
  assert.equal(validAnchorSet(report([{name:donorName+'.ydr'},{name:donorName+'.ytd'}])),true);
  const malformed=report([{name:donorName+'.ydr'},{name:donorName+'.ytd'}]);
  malformed.after.anchors={...anchors,magazine:{name:'WAPClip',position:[1,0,0]}};
  assert.throws(()=>validAnchorSet(malformed),/magazine.*drift/);
  malformed.after.anchors={...anchors,muzzle:null};
  assert.throws(()=>validAnchorSet(malformed),/muzzle/);
});
test('M2c native, AddonWeaponsBuilder, DLC export produce report and no source changes',async t=>{
  const f=await fixture(t);
  const result=await buildNativeWeapon({
    request:f.request,grants:f.grants,userDataRoot:f.data,
    runner:simulateNative(),makeBuilder:simulateBuilder(),verifyArchives:async()=>1,
  });
  assert.equal(result.nativeRoundTripPassed,true);
  assert.equal(result.addonWeaponsBuilderPassed,true);
  assert.equal(result.fiveMReady,false);
  assert.equal(result.gameTestPassed,null);
  const reportResult=JSON.parse(await fs.readFile(path.join(result.output,'weapon-validation.json'),'utf8'));
  assert.equal(reportResult.boneCount,4);
  assert.deepEqual(Object.keys(reportResult.anchors).sort(),['grip','magazine','muzzle']);
  assert.deepEqual(await fs.readFile(path.join(f.input,donorName+'.ydr')),nativeBinary);
  assert.deepEqual((await fs.readdir(f.output)).length,1);
  assert.equal((await fs.stat(path.join(result.output,'GTA-DLC','dlc.rpf'))).size,104);
  await assert.rejects(fs.stat(path.join(result.output,'weapon-native.py')));
});
test('M2c package FiveM only if native stream and all weapon metadata are loose',async t=>{
  const f=await fixture(t);
  const result=await buildNativeWeapon({
    request:f.request,grants:f.grants,userDataRoot:f.data,
    runner:simulateNative(),makeBuilder:simulateBuilder({loose:true}),verifyArchives:async()=>1,
  });
  assert.equal(result.fiveMReady,true);
  const manifest=await fs.readFile(path.join(result.output,'FiveM-resource','fxmanifest.lua'),'utf8');
  assert.match(manifest,/WEAPONINFO_FILE/);
  assert.match(manifest,/WEAPON_ANIMATIONS_FILE/);
  assert.equal((await fs.readFile(path.join(result.output,'FiveM-resource','stream','w_pi_ditashatest.ytd'))).subarray(0,4).toString(),'RSC7');
  assert.throws(()=>generateFiveMManifest(['weapons.meta']),/Complete FiveM/);
});
test('M2c rejects invalid skeleton and never commits partial failed native builds',async t=>{
  for(const option of [{badAnchor:true},{crash:true}]){
    const f=await fixture(t);
    await assert.rejects(buildNativeWeapon({
      request:f.request,grants:f.grants,userDataRoot:f.data,runner:simulateNative(option),
      makeBuilder:simulateBuilder(),verifyArchives:async()=>1,
    }),/drift|Blender crash/);
    assert.deepEqual(await fs.readdir(f.output),[]);
  }
});
test('M2c AddonWeaponsBuilder failure cannot leave user export folders',async t=>{
  const f=await fixture(t);
  await assert.rejects(buildNativeWeapon({
    request:f.request,grants:f.grants,userDataRoot:f.data,runner:simulateNative(),
    makeBuilder:simulateBuilder({fail:true}),verifyArchives:async()=>1,
  }),/AddonWeaponsBuilder/);
  assert.deepEqual(await fs.readdir(f.output),[]);
});
