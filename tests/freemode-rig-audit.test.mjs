import test from 'node:test';
import assert from 'node:assert/strict';
import {validatePedSettings,inspectFreemodeSources,inspectFreemodeUv} from '../src/freemode-rig-audit.js';
import {resolveCharacterBodyEntries} from '../src/freemode-character-source.js';
import {selectBoothRig} from '../src/booth-rig.js';

const uuid='01234567-89ab-4def-a012-3456789abc';
const files=[
 {name:'mp_m_freemode_01.yft',relativePath:'mp_m_freemode_01.yft',gender:'male'},
 ...['head','hair','uppr','hand','lowr','feet'].flatMap(component=>[
  {name:'mp_m_freemode_01^'+component+'_000_u.ydd',relativePath:component+'.ydd',gender:'male',component,drawable:0},
  {name:'mp_m_freemode_01^'+component+'_diff_000_a.ytd',relativePath:component+'.ytd',gender:'male',component,drawable:0,textureVariant:'a'},
 ])
];
const packs=[{id:uuid,files}];
const model={packId:uuid,relativePath:'head.ydd'};

test('ped settings are versionless, bounded, immutable-value presets',()=>{
 assert.deepEqual(validatePedSettings(),{skeletonMode:'auto',headUv:[0,0,1,1],hairUv:[0,0,1,1]});
 const normalized=validatePedSettings({skeletonMode:'strict',headUv:[0.15,-0.2,1.2,1.2],hairUv:[0,0,1,1]});
 assert.deepEqual(normalized.headUv,[0.15,-0.2,1.2,1.2]);
 for(const invalid of [
  {skeletonMode:'forced',headUv:[0,0,1,1],hairUv:[0,0,1,1]},
  {skeletonMode:'auto',headUv:[Infinity,0,1,1],hairUv:[0,0,1,1]},
  {skeletonMode:'auto',headUv:[0,0,1,1],hairUv:[0,0,0,1]},
  {skeletonMode:'auto',headUv:[0,0,1,1],hairUv:[0,0,1,1],command:'exec'},
 ])assert.throws(()=>validatePedSettings(invalid));
});
test('same-pack matching freemode skeleton and hair are automatically paired',()=>{
 const report=inspectFreemodeSources(packs,model,'male');
 assert.equal(report.skeleton,'source-yft');
 assert.equal(report.ready,true);
 assert.equal(report.reference,'mp_m_freemode_01.yft');
 assert.equal(report.components.find(x=>x.component==='hair').textureCount,1);
 const selected=resolveCharacterBodyEntries(packs,model,'male').map(x=>x.entry.relativePath);
 assert.ok(selected.includes('hair.ydd'));
 assert.ok(selected.includes('hair.ytd'));
 assert.ok(selected.includes('mp_m_freemode_01.yft'));
});
test('missing YFT or wrong gender is never called native auto-rigged',()=>{
 assert.equal(inspectFreemodeSources(packs,model,'female').ready,false);
 const incomplete=[{id:uuid,files:files.filter(f=>!f.name.endsWith('.yft'))}];
 const check=inspectFreemodeSources(incomplete,model,'male');
 assert.equal(check.skeleton,'missing');
 assert.equal(check.ready,false);
 assert.match(check.issues.join(' '),/YFT/);
});
test('head/hair UV geometry validation distinguishes real arrays from missing UV',()=>{
 const mesh={positions:new Float32Array([0,0,0,1,0,0,0,1,0]),uvs:new Float32Array([0,0,1,0,0,1])};
 const valid=inspectFreemodeUv([{lods:[{geometries:[mesh]}]}],'head');
 assert.equal(valid.ready,true);
 assert.equal(valid.uvMeshes,1);
 assert.equal(inspectFreemodeUv([{lods:[{geometries:[{...mesh,uvs:null}]}]}],'hair').ready,false);
 assert.equal(inspectFreemodeUv([{lods:[{geometries:[{...mesh,uvs:[0,0,Infinity,0,0,1]}]}]}],'hair').nonfiniteUv,1);
 assert.throws(()=>inspectFreemodeUv([], 'feet'));
});
test('hair without source rig only uses explicit approximate preview binding',()=>{
 const skin={indices:new Uint16Array([100,0,0,0]),weights:new Float32Array([1,0,0,0])};
 const exact=selectBoothRig([],skin,[],{family:'male',modelName:'mp_m_freemode_01^hair_001_u.ydd'});
 assert.equal(exact.rig.length,0);
 const preview=selectBoothRig([],skin,[],{family:'male',modelName:'mp_m_freemode_01^hair_001_u.ydd',allowApproximate:true});
 assert.equal(preview.approximate,true);
 assert.match(preview.warning,/rigid fallback/);
 assert.ok(preview.rig[preview.indices[0]].name.toLowerCase().includes('head'));
});
