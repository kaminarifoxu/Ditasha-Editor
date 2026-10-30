import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { deflateRaw } from 'pako';
import { readYft, Resource } from '../src/resource.js';
import { viewerModel } from './viewer-format.test.mjs';
import { surfaceYftFixture } from './fixtures/surface-yft.mjs';
import {
  surfaceProfile,
  surfaceReferences,
  createModelMaterial,
  setSurfaceMaps,
  copyVehicleSurface,
} from '../src/vehicle-surface.js';
import { setVehicleLivery, copyVehicleLivery } from '../src/vehicle-livery.js';
import { modelTextureReferences } from '../src/vehicle-textures.js';

test('Native numeric parameters and all surface texture roles survive parsing without changing source bytes', () => {
  const data = surfaceYftFixture(viewerModel),
    before = new Uint8Array(data).slice(),
    [d] = readYft(data),
    g = d.geometries[0];
  assert.deepEqual(surfaceReferences(g), { normal: 'surface_normal', specular: 'surface_spec' });
  const p = surfaceProfile(g);
  assert(Math.abs(p.bumpiness - 0.8) < 1e-6);
  assert.equal(p.intensity, 2);
  assert.equal(p.falloff, 40);
  assert.deepEqual(p.mask, [1, 0, 0]);
  assert.deepEqual(
    new Set(modelTextureReferences([d])),
    new Set(['cloth_diffuse', 'surface_normal', 'surface_spec']),
  );
  assert.deepEqual(new Uint8Array(data), before);
  const r = new Resource(data, 162);
  r.v.setFloat32(3112, NaN, true);
  const body = deflateRaw(r.bytes),
    out = new Uint8Array(16 + body.length);
  out.set(r.header);
  out.set(body, 16);
  assert.throws(() => readYft(out.buffer), /non-finite shader/);
});
test('Surface role maps and shader channel handling survive Photoshoot cloning together with livery', () => {
  const g = readYft(surfaceYftFixture(viewerModel))[0].geometries[0],
    m = createModelMaterial(g),
    normal = new THREE.Texture(),
    specular = new THREE.Texture(),
    livery = new THREE.Texture();
  assert(m.isMeshPhongMaterial);
  const roles = [];
  setSurfaceMaps(m, { normal, specular }, (t, role) => {
    roles.push(role);
    return t;
  });
  assert.deepEqual(roles, ['data', 'data']);
  assert(m.normalScale.y < 0);
  setVehicleLivery(m, livery);
  const clone = copyVehicleLivery(m, copyVehicleSurface(m, m.clone()));
  for (const material of [m, clone]) {
    const s = {
      uniforms: {},
      vertexShader: '#include <common>\n#include <uv_vertex>',
      fragmentShader:
        '#include <common>\n#include <map_fragment>\n#include <normal_fragment_maps>\n#include <specularmap_fragment>\n#include <lights_phong_fragment>',
    };
    material.onBeforeCompile(s, {});
    assert(s.fragmentShader.includes('dot(texelSpecular.rgb, ditashaSpecMask)'));
    assert(s.fragmentShader.includes('rgNormal'));
    assert(s.fragmentShader.includes('vSpecularMapUv).a'));
    assert(s.uniforms.ditashaLiveryMap.value === livery);
    assert(material.normalMap === normal && material.specularMap === specular);
  }
});
