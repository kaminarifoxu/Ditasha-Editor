import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { deflateRaw } from 'pako';
import { Resource, readYft, readYdd } from '../src/resource.js';
import { viewerModel } from './viewer-format.test.mjs';
import { hashName } from '../src/asset-tools.js';
import { liveryYftFixture } from './fixtures/livery-yft.mjs';
import {
  liveryReference,
  resolveVehicleLivery,
  setVehicleLivery,
  copyVehicleLivery,
} from '../src/vehicle-livery.js';
test('Vehicle paint3 retains its primary map while resolving secondary livery from its own dictionary', () => {
  const data = liveryYftFixture(viewerModel),
    snapshot = new Uint8Array(data).slice();
  const drawable = readYft(data)[0];
  assert.equal(drawable.geometries.length, 1, 'GPU fixture must isolate one visible material');
  assert.equal(
    readYft(liveryYftFixture(viewerModel, { embedded: false }))[0].embeddedTextures.length,
    0,
  );
  const g = drawable.geometries[0];
  assert.equal(g.diffuseTexture, 'cloth_diffuse');
  assert.equal(liveryReference(g), 'vehicle_sign_1');
  assert(g.uvs2 && g.uvs2[0] !== g.uvs[0]);
  const correct = { name: 'VEHICLE_SIGN_1.dds', dictionary: 'car.ytd' },
    other = { name: 'vehicle_sign_1', dictionary: 'other.ytd' };
  assert.equal(resolveVehicleLivery(g, [other, correct], [], 'car_hi.yft'), correct);
  assert.equal(
    resolveVehicleLivery({ ...g, shaderHash: 0, shaderFileHash: 0 }, [correct], [], 'car.yft'),
    null,
  );
  assert.equal(
    liveryReference({
      ...g,
      shaderHash: hashName('vehicle_paint3_lvr'),
      shaderFileHash: 0,
      textureSamplers: [{ hash: hashName('DiffuseSampler3'), name: 'third' }],
    }),
    'third',
  );
  assert.deepEqual(new Uint8Array(data), snapshot);
});
test('Layered livery uses UV2 and alpha mixing, survives Photoshoot cloning and releases its hook on removal', () => {
  const material = new THREE.MeshStandardMaterial(),
    map = new THREE.Texture();
  const original = material.onBeforeCompile;
  const shader = () => ({
    uniforms: {},
    vertexShader: '#include <common>\n#include <uv_vertex>',
    fragmentShader: '#include <common>\n#include <map_fragment>',
  });
  setVehicleLivery(material, map);
  const s = shader();
  material.onBeforeCompile(s);
  assert.equal(s.uniforms.ditashaLiveryMap.value, map);
  assert.match(s.vertexShader, /vDitashaLiveryUv = ditashaLiveryUv/);
  assert.match(s.fragmentShader, /mix\(diffuseColor.rgb, ditashaLivery.rgb, ditashaLivery.a\)/);
  const copy = copyVehicleLivery(material, material.clone());
  const c = shader();
  copy.onBeforeCompile(c);
  assert.equal(c.uniforms.ditashaLiveryMap.value, map);
  assert.equal(
    JSON.stringify(material.userData),
    '{}',
    'GPU textures must not be serialized into cloned userData',
  );
  setVehicleLivery(material, null);
  assert.equal(material.onBeforeCompile, original);
  const clean = shader();
  material.onBeforeCompile(clean);
  assert(!clean.uniforms.ditashaLiveryMap);
  material.dispose();
  copy.dispose();
  map.dispose();
});
test('Empty vertex/index placeholders do not hide readable geometry; mismatched nonempty buffers still fail', () => {
  const pack = (r) => {
    const data = deflateRaw(r.bytes),
      out = new Uint8Array(16 + data.length);
    out.set(r.header);
    out.set(data, 16);
    return out.buffer;
  };
  const r = new Resource(viewerModel, 165);
  r.v.setUint32(1472 + 24, 0, true);
  r.v.setUint32(1648 + 8, 0, true);
  const d = readYdd(pack(r))[0];
  assert.equal(d.lods.length, 1);
  assert.equal(d.geometries.length, 2);
  r.v.setUint32(1648 + 8, 3, true);
  assert.throws(() => readYdd(pack(r)), /Vertex buffer/);
  r.v.setUint32(1472 + 24, 3, true);
  r.v.setUint32(1648 + 8, 0, true);
  assert.throws(() => readYdd(pack(r)), /Index buffer/);
});
