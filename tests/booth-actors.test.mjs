import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createActorMotion,
  actorForAsset,
  advanceActorMotion,
  validateActorMotion,
} from '../src/booth-actors.js';
test('Ped emotes and independent clocks never share state; clothing resolves only its owner', () => {
  const a = { id: 1, kind: 'ped', motion: createActorMotion() },
    b = { id: 2, kind: 'ped', motion: createActorMotion() },
    shirt = { id: 3, kind: 'clothing', owner: 2 };
  const assets = [a, b, shirt];
  a.motion.pose = 'wave';
  b.motion.pose = 'dance';
  a.motion.playing = true;
  advanceActorMotion(a.motion, 0.1);
  assert.equal(b.motion.time, 0);
  assert.equal(b.motion.pose, 'dance');
  assert.equal(actorForAsset(assets, shirt), b);
  assert.equal(actorForAsset(assets, a), a);
  shirt.owner = 1;
  assert.equal(actorForAsset(assets, shirt), a);
  assert.equal(actorForAsset([shirt], shirt), shirt);
  b.motion.playing = true;
  b.motion.speed = 2;
  advanceActorMotion(b.motion, 0.1);
  assert.equal(b.motion.time, 0.2);
  assert.equal(a.motion.time, 0.1);
  b.motion.time = 3.95;
  advanceActorMotion(b.motion, 0.1);
  assert.ok(b.motion.time < 0.2);
  assert.throws(() => advanceActorMotion(b.motion, -1), /tidak valid/);
  assert.throws(() => validateActorMotion({ ...a.motion, speed: 0 }), /tidak valid/);
});
