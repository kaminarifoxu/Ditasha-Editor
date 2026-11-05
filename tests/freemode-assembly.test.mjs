import test from 'node:test';
import assert from 'node:assert/strict';
import { planFreemodeActor } from '../src/freemode-assembly.js';

test('freemode head remains the actor when folder import lists hair first', () => {
 const hair={name:'mp_f_freemode_01^hair_005_u.ydd'};
 const torso={name:'mp_f_freemode_01^uppr_000_u.ydd'};
 const head={name:'mp_f_freemode_01^head_000_r.ydd'};
 const skeleton={name:'mp_f_freemode_01.yft'};
 const plan=planFreemodeActor([hair,torso,skeleton,head]);
 assert.equal(plan.primary,head);
 assert.deepEqual(plan.attachments.map(a=>a.kind),['accessory','clothing','accessory']);
 assert.equal(plan.attachments[2].category,'other');
});
test('reject missing or duplicate head rather than silently choosing torso as ped', () => {
 const head={name:'mp_m_freemode_01^head_000_r.ydd'};
 assert.throws(()=>planFreemodeActor([{name:'mp_m_freemode_01^uppr_000_u.ydd'}]),/tepat satu model kepala/);
 assert.throws(()=>planFreemodeActor([head,head]),/ditemukan 2/);
});
test('GLB source head and hair retain independent selection', () => {
 const head={name:'head_002_r.glb'};
 const hair={name:'hair_001_u.glb'};
 const plan=planFreemodeActor([hair,head]);
 assert.equal(plan.primary,head);
 assert.equal(plan.attachments[0].kind,'accessory');
});
