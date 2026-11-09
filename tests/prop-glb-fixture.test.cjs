'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createGlbCube } = require('../scripts/smoke-prop-native.cjs');

test('native prop smoke fixture is a valid GLB 2.0 cube with UVs and PBR material', () => {
  const glb = createGlbCube();
  assert.ok(Buffer.isBuffer(glb));
  assert.equal(glb.readUInt32LE(0), 0x46546c67, 'glTF magic');
  assert.equal(glb.readUInt32LE(4), 2, 'GLB version');
  assert.equal(glb.readUInt32LE(8), glb.length, 'declared total length');

  let offset = 12;
  const jsonLength = glb.readUInt32LE(offset);
  assert.equal(glb.readUInt32LE(offset + 4), 0x4e4f534a, 'JSON chunk');
  offset += 8;
  const json = JSON.parse(glb.subarray(offset, offset + jsonLength).toString('utf8').trim());
  offset += jsonLength;

  const binLength = glb.readUInt32LE(offset);
  assert.equal(glb.readUInt32LE(offset + 4), 0x004e4942, 'BIN chunk');
  offset += 8;
  assert.equal(offset + binLength, glb.length, 'binary chunk reaches end of file');
  assert.equal(json.asset.version, '2.0');
  assert.equal(json.meshes[0].primitives[0].attributes.TEXCOORD_0, 1);
  assert.equal(json.accessors[0].count, 24);
  assert.equal(json.accessors[1].count, 24);
  assert.equal(json.accessors[2].count, 36);
  assert.deepEqual(json.materials[0].pbrMetallicRoughness.baseColorFactor, [0.85, 0.32, 0.08, 1]);
  assert.equal(json.buffers[0].byteLength, 552);
});
