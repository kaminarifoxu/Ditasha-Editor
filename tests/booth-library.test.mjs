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

test('Scene library accepts source YCD clips with stable external IDs', () => {
  const s = scene();
  s.clipFiles = [
    { file: Object.assign(new Blob(['ycd']), { name: 'emote.ycd' }), prefix: 'external:1' },
  ];
  assert.equal(validateBoothScene(s), s);
  s.clipFiles[0].file.name = 'emote.exe';
  assert.throws(() => validateBoothScene(s), /Clip/);
});
test('Scene presets retain studio selection, photo settings and independent ped positions', () => {
  const s = scene();
  s.studio = {
    id: 'loft',
    background: '#242938',
    light: 1.2,
    transparent: false,
    floor: true,
    size: '1920x1080',
  };
  s.assets[0].offset = [-1.25, 0.15, 2.5];
  assert.equal(validateBoothScene(s), s);
  s.studio.id = 'remote-script';
  assert.throws(() => validateBoothScene(s), /studio/);
  s.studio.id = 'loft';
  s.studio.light = Infinity;
  assert.throws(() => validateBoothScene(s), /studio/);
  s.studio.light = 1.2;
  s.assets[0].offset[0] = 101;
  assert.throws(() => validateBoothScene(s), /Penempatan/);
});
test('Vehicle, matte and shadow options round-trip in validated photo presets', () => {
  const s = scene();
  s.assets[0].matte = true;
  s.assets.push({
    ...s.assets[0],
    kind: 'vehicle',
    category: 'vehicle',
    oldId: 2,
    ownerIndex: null,
    yaw: 90,
  });
  s.studio = {
    id: 'police',
    background: '#242938',
    light: 1,
    transparent: false,
    floor: true,
    size: '4000x3000',
    shadows: false,
    shadowStrength: 0.4,
    shadowAngle: 180,
  };
  assert.equal(validateBoothScene(s), s);
  s.studio.shadowStrength = 2;
  assert.throws(() => validateBoothScene(s), /studio/);
  s.studio.shadowStrength = 0.4;
  s.assets[0].matte = 'yes';
  assert.throws(() => validateBoothScene(s), /Matte/);
});
