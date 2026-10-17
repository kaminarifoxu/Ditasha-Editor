import { hashName } from './asset-tools.js';
import { resolveModelTexture } from './model-material.js';

// Verified paint families with base on UV0 and a second diffuse/livery on UV1.
// Samplers/UVs: Sollumz/szio src/szio/gta5/Shaders.xml.
const shaders = new Map();
for (const [shader, sampler] of [
  ['vehicle_paint3', 'DiffuseSampler2'],
  ['vehicle_paint3_enveff', 'DiffuseSampler2'],
  ...[
    'vehicle_paint4',
    'vehicle_paint4_enveff',
    'vehicle_paint4_emissive',
    'vehicle_paint5_enveff',
    'vehicle_paint6',
    'vehicle_paint6_enveff',
    'vehicle_paint7',
    'vehicle_paint7_enveff',
  ].map((name) => [name, 'DiffuseSampler2']),
  ['vehicle_paint3_lvr', 'DiffuseSampler3'],
])
  for (const name of [shader, shader + '.sps']) shaders.set(hashName(name), hashName(sampler));
export function liveryReference(geometry) {
  const sampler = shaders.get(geometry.shaderHash) || shaders.get(geometry.shaderFileHash);
  return sampler ? geometry.textureSamplers?.find((t) => t.hash === sampler)?.name || null : null;
}
export function hasVisibleLiveryPixels(texture) {
  if (!texture?.out?.length) return false;
  for (let i = 3; i < texture.out.length; i += 4) if (texture.out[i] > 0) return true;
  return false;
}
export function resolveVehicleLivery(geometry, external, embedded, source) {
  return resolveModelTexture(liveryReference(geometry), external, embedded, source);
}
// Keep GPU maps out of userData: Three serializes it when cloning a Photoshoot scene.
const states = new WeakMap();
export function setVehicleLivery(material, map) {
  const old = states.get(material);
  if (old?.map === map) return;
  if (old) {
    material.onBeforeCompile = old.compile;
    material.customProgramCacheKey = old.key;
    states.delete(material);
  }
  if (map) {
    const compile = material.onBeforeCompile,
      key = material.customProgramCacheKey;
    states.set(material, { map, compile, key });
    material.onBeforeCompile = (shader, renderer) => {
      compile.call(material, shader, renderer);
      shader.uniforms.ditashaLiveryMap = { value: map };
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          '#include <common>\nattribute vec2 ditashaLiveryUv;\nvarying vec2 vDitashaLiveryUv;',
        )
        .replace(
          '#include <uv_vertex>',
          '#include <uv_vertex>\nvDitashaLiveryUv = ditashaLiveryUv;',
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          '#include <common>\nuniform sampler2D ditashaLiveryMap;\nvarying vec2 vDitashaLiveryUv;',
        )
        .replace(
          '#include <map_fragment>',
          '#include <map_fragment>\nvec4 ditashaLivery = texture2D(ditashaLiveryMap, vDitashaLiveryUv);\ndiffuseColor.rgb = mix(diffuseColor.rgb, ditashaLivery.rgb, ditashaLivery.a);',
        );
    };
    material.customProgramCacheKey = () => key.call(material) + '|ditasha-livery-uv1-v1';
  }
  material.needsUpdate = true;
}
export function copyVehicleLivery(source, target) {
  const state = states.get(source);
  if (state) setVehicleLivery(target, state.map);
  return target;
}
