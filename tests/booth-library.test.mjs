import test from 'node:test';
import assert from 'node:assert/strict';
import { validateBoothScene } from '../src/booth-library.js';
import { createActorMotion } from '../src/booth-actors.js';
const file = () => Object.assign(new Blob(['model']), { name: 'ped.glb' });
const scene = () => ({
  version: 1,
  assets: [
    {
      file: file(),
      kind: 'ped',
      ownerIndex: null,
      oldId: 1,
      offset: [0, 0, 0],
      yaw: 0,
      scale: 1,
      motion: createActorMotion(),
      hiddenSlots: [],
    },
  ],
  textureFiles: [],
  clipFiles: [],
});
test('Local library validates complete source bundles and rejects broken ownership, motion and unbounded files', () => {
  const s = scene();
  assert.equal(validateBoothScene(s), s);
  s.assets.push({ ...s.assets[0], oldId: 2, kind: 'clothing', ownerIndex: 0 });
  assert.equal(validateBoothScene(s), s);
  s.assets[1].ownerIndex = 1;
  assert.throws(() => validateBoothScene(s), /Pemilik/);
  s.assets[1].ownerIndex = 0;
  s.assets[0].motion.time = Infinity;
  assert.throws(() => validateBoothScene(s), /emote/);
  s.assets[0].motion = createActorMotion();
  s.assets[0].file = { name: 'big.glb', size: 65 * 1024 ** 2, arrayBuffer: async () => {} };
  assert.throws(() => validateBoothScene(s), /terlalu besar/);
  assert.throws(() => validateBoothScene({ version: 99 }), /tidak valid/);
});
