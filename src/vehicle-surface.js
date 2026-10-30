import * as THREE from 'three';
import { hashName } from './asset-tools.js';
import { resolveModelTexture } from './model-material.js';

const sampler = (g, name) =>
  g.textureSamplers?.find((t) => t.hash === hashName(name))?.name || null;
const parameter = (g, name) => g.shaderParameters?.find((p) => p.hash === hashName(name))?.values;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
export function surfaceReferences(g) {
  return {
    normal: sampler(g, 'BumpSampler') || sampler(g, 'PlateBgBumpSampler'),
    specular: sampler(g, 'SpecSampler'),
  };
}
export function resolveSurfaceMaps(g, external, embedded, source, parents = []) {
  return Object.fromEntries(
    Object.entries(surfaceReferences(g)).map(([role, name]) => [
      role,
      resolveModelTexture(name, external, embedded, source, parents),
    ]),
  );
}
export function surfaceProfile(g) {
  return {
    bumpiness: clamp(parameter(g, 'bumpiness')?.[0] ?? 1, 0, 20),
    intensity: clamp(parameter(g, 'specularIntensityMult')?.[0] ?? 0.2, 0, 8),
    falloff: clamp(parameter(g, 'specularFalloffMult')?.[0] ?? 80, 1, 2048),
    mask: (parameter(g, 'specMapIntMask') || [1, 0, 0]).map((v) => clamp(v, 0, 1)),
  };
}
function installSurfaceShader(material) {
  const compile = material.onBeforeCompile,
    key = material.customProgramCacheKey;
  material.onBeforeCompile = (shader, renderer) => {
    compile.call(material, shader, renderer);
    shader.uniforms.ditashaSpecMask = {
      value: new THREE.Vector3(...material.userData.surfaceProfile.mask),
    };
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 ditashaSpecMask;')
      .replace(
        '#include <normal_fragment_maps>',
        THREE.ShaderChunk.normal_fragment_maps.replace(
          'vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;',
          'vec2 rgNormal = texture2D(normalMap, vNormalMapUv).rg * 2.0 - 1.0;\nvec3 mapN = vec3(rgNormal, sqrt(max(0.0, 1.0 - dot(rgNormal, rgNormal))));',
        ),
      )
      .replace(
        '#include <specularmap_fragment>',
        THREE.ShaderChunk.specularmap_fragment.replace(
          'specularStrength = texelSpecular.r;',
          'specularStrength = clamp(dot(texelSpecular.rgb, ditashaSpecMask), 0.0, 1.0);',
        ),
      )
      .replace(
        '#include <lights_phong_fragment>',
        THREE.ShaderChunk.lights_phong_fragment +
          '\n#ifdef USE_SPECULARMAP\nmaterial.specularShininess = max(1.0, shininess * texture2D(specularMap, vSpecularMapUv).a);\n#endif\n',
      );
  };
  material.customProgramCacheKey = () => key.call(material) + '|ditasha-rg-normal-spec-v1';
}
// Original Three.js approximation of native sampler roles; not the GTA renderer.
export function createModelMaterial(g, options = {}) {
  const refs = surfaceReferences(g);
  if (!refs.normal && !refs.specular) return new THREE.MeshStandardMaterial(options);
  const { roughness, metalness, ...common } = options;
  const p = surfaceProfile(g),
    material = new THREE.MeshPhongMaterial({
      ...common,
      shininess: p.falloff,
      specular: new THREE.Color().setScalar(p.intensity),
    });
  material.normalScale.set(p.bumpiness, -p.bumpiness); // GTA/DirectX green convention.
  material.userData.surfaceProfile = p;
  installSurfaceShader(material);
  return material;
}
export function setSurfaceMaps(material, maps, textureMap) {
  if (!material.isMeshPhongMaterial || !material.userData.surfaceProfile) return;
  material.normalMap = textureMap(maps.normal, 'data');
  material.specularMap = textureMap(maps.specular, 'data');
  material.needsUpdate = true;
}
export function copyVehicleSurface(source, target) {
  if (source.userData.surfaceProfile && target.isMeshPhongMaterial) installSurfaceShader(target);
  return target;
}
