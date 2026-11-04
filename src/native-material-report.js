// Pure preview payload validation. Keep shader diagnostics separate from the GTA source bytes.
export const NATIVE_SAMPLER_ROLES = ['diffuse', 'normal', 'specular'];
export function validateNativeMaterialReferences(meshes, textureCount) {
  if (!Array.isArray(meshes) || !Number.isInteger(textureCount) || textureCount < 0 || textureCount > 32)
    throw Error('Invalid preview materials or texture count.');
  const problems = [];
  for (const mesh of meshes) {
    const name = String(mesh?.name || '(unnamed mesh)');
    const info = mesh?.materialInfo || {};
    for (const [role, key] of [['diffuse', 'texture'], ['normal', 'normalTexture'], ['specular', 'specularTexture']]) {
      const index = mesh?.[key];
      if (index != null && (!Number.isInteger(index) || index < 0 || index >= textureCount))
        throw Error(name + ': invalid ' + role + ' sampler index.');
    }
    if (!Array.isArray(mesh?.uvs) || !mesh.uvs.every(Number.isFinite))
      throw Error(name + ': invalid preview UV buffer.');
    if (info.uv === 'present' && mesh.uvs.length === 0)
      problems.push({ name, role: 'uv', status: 'missing' });
    for (const role of ['uv', ...NATIVE_SAMPLER_ROLES]) {
      const status = info[role];
      if (status && !['present', 'unknown', 'missing', 'uv-mismatch'].includes(status))
        throw Error(name + ': invalid ' + role + ' diagnostic status.');
      if (status && !['present', 'unknown'].includes(status))
        problems.push({ name, role, status });
    }
  }
  return problems;
}
