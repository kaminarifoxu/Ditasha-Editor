import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  WEAPON_ATTACHMENT_TYPES, inspectWeaponHierarchy, validateWeaponProject,
  createWeaponGuide, weaponGuideHelper, disposeWeaponGuideHelper,
} from '../src/creators/weapon-attachments.js';
import { createWeaponSketch } from '../src/weapon-studio.js';

test('M2b visual weapon sketches have no claimed native GTA skeleton', () => {
  const model = createWeaponSketch('pistol');
  const before = model.children.map(c => ({ name:c.name, pos:c.position.toArray() }));
  const report = inspectWeaponHierarchy(model);
  assert.equal(report.hasSkeleton,false);
  assert.equal(report.nativeBoneIdsVerified,false);
  assert.ok(report.issues.some(x=>x.code==='missing-skeleton'));
  assert.deepEqual(model.children.map(c=>({name:c.name,pos:c.position.toArray()})), before);
  model.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});
});

test('M2b extracts real Three.js bones and attachment-name candidates non-destructively', () => {
  const root = new THREE.Group();
  const rig = new THREE.Bone(); rig.name='weapon_root';
  const muzzle = new THREE.Bone(); muzzle.name='muzzle_flash'; muzzle.position.set(0,0,0.2);
  const magazine = new THREE.Bone(); magazine.name='magazine'; magazine.position.set(-0.1,0,0);
  rig.add(muzzle, magazine); root.add(rig);
  const report = inspectWeaponHierarchy(root);
  assert.equal(report.bones.length,3);
  assert.equal(report.candidates.length,2);
  assert.equal(report.hasSkeleton,true);
  assert.equal(report.nativeBoneIdsVerified,false);
  assert.equal(muzzle.parent,rig);
  const dupe = new THREE.Group();dupe.name='magazine';root.add(dupe);
  assert.ok(inspectWeaponHierarchy(root).issues.some(x=>x.code==='duplicate-node'));
});

test('M2b versioned guide JSON round trips and refuses unsafe fields', () => {
  const guide = createWeaponGuide('muzzle',[0.1,0.2,0.3]);
  guide.rotation=[0,90,0];
  const project={schemaVersion:1,name:'ditasha_test_weapon',reference:'WEAPON_PISTOL',guides:[guide]};
  const verified=validateWeaponProject(JSON.parse(JSON.stringify(project)));
  assert.deepEqual(verified.guides[0].position,[0.1,0.2,0.3]);
  assert.equal(verified.reference,'WEAPON_PISTOL');
  const bad=[
    {...project,schemaVersion:2},
    {...project,sourcePath:'C:/Windows/System32'},
    {...project,guides:[guide,guide]},
    {...project,guides:[{...guide,type:'exploit'}]},
    {...project,guides:[{...guide,position:[Infinity,0,0]}]},
    {...project,guides:[{...guide,rotation:[0,361,0]}]},
    {...project,name:'../bad'},
    {...project,reference:'../../gun'},
  ];
  for(const value of bad) assert.throws(()=>validateWeaponProject(value));
  assert.deepEqual(WEAPON_ATTACHMENT_TYPES.includes('muzzle'),true);
});

test('M2b guide helpers do not mutate or attach to the source assembly',()=>{
  const source=createWeaponSketch('pistol');
  const children=source.children.length;
  const guide=createWeaponGuide('grip',[0.01,0.02,0.03]);
  const object=weaponGuideHelper(guide);
  assert.equal(object.userData.weaponAuthoringGuide,true);
  assert.deepEqual(object.position.toArray(),guide.position);
  assert.equal(source.children.length,children);
  disposeWeaponGuideHelper(object);
  source.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});
});
