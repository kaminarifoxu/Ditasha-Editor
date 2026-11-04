import * as THREE from 'three';

/**
 * Phase 3 / M2a: non-mutating readiness audit for a weapon design assembly.
 * This is NOT a native GTA exporter or a guarantee that a weapon will
 * function in FiveM. Real skeletons, native drawable bindings and metadata
 * still need the managed Blender/Sollumz + AddonWeaponsBuilder workflow.
 */
export function auditWeaponAssembly(assembly, { reference = null } = {}) {
  if (!assembly?.isObject3D) throw new TypeError('Expected a Three.js weapon assembly');
  const issues = [];
  const warn = (code, message, severity = 'warning') => issues.push({ code, severity, message });
  let meshes = 0, triangles = 0, vertices = 0, textured = 0, uvMeshes = 0, skeletal = 0;
  const names = new Set();
  assembly.updateWorldMatrix(true, true);
  const globalBounds = new THREE.Box3();
  assembly.traverse(node => {
    if (!node.isMesh) return;
    meshes += 1;
    const geometry = node.geometry;
    const name = node.name || 'Unnamed mesh';
    if (names.has(name)) warn('duplicate-name', 'Multiple mesh parts share the name "' + name + '".');
    names.add(name);
    const position = geometry?.getAttribute?.('position');
    if (!position || position.count < 3) {
      warn('missing-geometry', name + ' has no usable geometry.', 'error');
      return;
    }
    vertices += position.count;
    const trianglesOnMesh = Math.floor((geometry.index?.count ?? position.count) / 3);
    triangles += trianglesOnMesh;
    if (!Number.isFinite(trianglesOnMesh) || trianglesOnMesh < 1) {
      warn('empty-mesh', name + ' has no triangles.', 'error');
    }
    for (let i = 0; i < position.count; i++) {
      if (![position.getX(i), position.getY(i), position.getZ(i)].every(Number.isFinite)) {
        warn('nonfinite-vertex', name + ' contains invalid coordinates.', 'error');
        break;
      }
    }
    const uv = geometry.getAttribute('uv');
    if (uv?.count === position.count) uvMeshes += 1;
    else warn('missing-uv', name + ' lacks complete UV coordinates.');
    const mats = Array.isArray(node.material) ? node.material : node.material ? [node.material] : [];
    if (mats.length === 0) warn('missing-material', name + ' has no material.');
    else if (mats.some(mat => mat?.map?.isTexture)) textured += 1;
    else warn('no-diffuse-texture', name + ' has no texture map; verify its GTA shader conversion.');
    if (node.isSkinnedMesh && node.skeleton?.bones?.length) skeletal += 1;
    node.updateWorldMatrix(true, false);
    const bounds = new THREE.Box3().setFromObject(node);
    if (bounds.isEmpty() || [...bounds.min.toArray(), ...bounds.max.toArray()].some(v => !Number.isFinite(v))) {
      warn('invalid-bounds', name + ' has invalid world bounds.', 'error');
    } else globalBounds.union(bounds);
  });
  if (!meshes) warn('no-model', 'Import a weapon model or create a sketch first.', 'error');
  if (vertices > 500000) warn('vertex-budget', 'Geometry exceeds the existing 500,000 vertex limit.', 'error');
  if (meshes > 64) warn('part-budget', 'Geometry exceeds the existing 64-mesh target.', 'error');
  if (!skeletal && meshes) warn('skeleton-unverified', 'No skinned mesh with bones was detected; native weapon bones and attachment positions must be checked.');
  if (meshes) warn('metadata-unverified', 'Weapon metadata, weapon grip, muzzle flash and magazine attachment points have not been certified for FiveM.');
  if (meshes && globalBounds.isEmpty()) warn('no-bounds', 'Weapon geometry has no finite world bounds.', 'error');
  if (reference && (!Array.isArray(reference) || reference.length < 4 || !/^WEAPON_[A-Z0-9_]+$/.test(reference[1]))) {
    warn('invalid-reference', 'The selected weapon reference is not recognized.', 'error');
  }
  const size = globalBounds.isEmpty() ? null : globalBounds.getSize(new THREE.Vector3()).toArray();
  return Object.freeze({
    schemaVersion: 1,
    readiness: issues.some(issue => issue.severity === 'error') ? 'invalid-model' : 'design-preview-only',
    nativeExportVerified: false,
    inGameVerified: false,
    stats: { meshes, triangles, vertices, uvMeshes, texturedMeshes: textured, skinnedMeshes: skeletal, bounds: size },
    reference: reference ? { weaponName: reference[1], modelName: reference[2] } : null,
    issues,
  });
}
