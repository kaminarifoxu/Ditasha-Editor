import test from 'node:test';
import assert from 'node:assert/strict';
import { recoverSavedExternalEmote } from '../src/booth-emote-restore.js';
test('restored clip keeps the original chosen emote and saved timeline', () => {
 const actor={name:'Frenni',motion:{clip:'external:4:0',pose:'clip',time:1.8,playing:false}};
 const warnings=[];
 assert.equal(recoverSavedExternalEmote(actor,new Set(['external:4:0']),warnings),false);
 assert.equal(actor.motion.clip,'external:4:0');
 assert.equal(actor.motion.time,1.8);
 assert.deepEqual(warnings,[]);
});
test('missing YCD source reports fallback and clears stale clip pose', () => {
 const actor={name:'Frenni',motion:{clip:'external:4:0',pose:'clip',time:15,playing:true}};
 const warnings=[];
 assert.equal(recoverSavedExternalEmote(actor,new Set(),warnings),true);
 assert.deepEqual(actor.motion,{clip:'',pose:'relaxed',time:0,playing:false});
 assert.match(warnings[0],/Frenni.*impor ulang file YCD/);
});
test('built-in pose and emotes with no clip remain unchanged', () => {
 const actor={name:'Frenni',motion:{clip:'',pose:'walk',time:2,playing:false}};
 assert.equal(recoverSavedExternalEmote(actor,new Set()),false);
 assert.equal(actor.motion.pose,'walk');
});
