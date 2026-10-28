import test from 'node:test';
import assert from 'node:assert/strict';
import { previewAlpha } from '../src/material-preview.js';

test('Ped cutout uses texture alpha and writes depth; blend and opaque remain explicit choices', () => {
  assert.deepEqual(previewAlpha({ mode: 'cutout', cutoff: 0.25 }, true), {
    transparent: false,
    alphaTest: 0.25,
    depthWrite: true,
  });
  assert.deepEqual(previewAlpha({ mode: 'blend', cutoff: 0.05 }, true), {
    transparent: true,
    alphaTest: 0.05,
    depthWrite: false,
  });
  assert.deepEqual(previewAlpha({ mode: 'opaque', cutoff: 0.9 }, true), {
    transparent: false,
    alphaTest: 0,
    depthWrite: true,
  });
  assert.deepEqual(previewAlpha({ mode: 'blend', cutoff: 0.9 }, false), {
    transparent: false,
    alphaTest: 0,
    depthWrite: true,
  });
});

test('Ped brow/lash shader keeps atlas alpha despite a head diffuse name and survives clones', async () => {
  const THREE = await import('three');
  const { hashName } = await import('../src/asset-tools.js');
  const { modelPreviewAlpha } = await import('../src/model-material.js');
  const { defaultPreviewSettings } = await import('../src/material-preview.js');
  for (const shader of ['ped_hair_cutout_alpha', 'ped_default_cutout']) {
    for (const key of ['shaderHash', 'shaderFileHash']) {
      const geometry = {
        [key]: hashName(shader + (key === 'shaderFileHash' ? '.sps' : '')),
        diffuseTexture: 'head_diff_000_a_uni',
      };
      const material = new THREE.MeshStandardMaterial();
      material.userData.previewAlphaDefault = modelPreviewAlpha(geometry);
      for (const m of [material, material.clone()]) {
        assert.deepEqual(previewAlpha(defaultPreviewSettings(m), true), {
          transparent: false,
          alphaTest: 0.25,
          depthWrite: true,
        });
        assert.equal(previewAlpha(defaultPreviewSettings(m), false).alphaTest, 0);
      }
      assert.deepEqual(modelPreviewAlpha(geometry, 'opaque'), { mode: 'opaque', cutoff: 0 });
    }
  }
});
