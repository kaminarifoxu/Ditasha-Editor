import * as THREE from 'three';

/**
 * Validate decoded GTA model buffers before handing them to Three.js.
 * Never silently invent a complete model when the decoder returned broken data.
 */
export function createSafeGeometry(drawable) {
  const source = drawable?.positions;
  if (!source || source.length < 9 || source.length % 3 !== 0) {
    throw new Error('Invalid model positions: expected complete XYZ vertex triples.');
  }
  const count = source.length / 3;
  const positions = new Float32Array(source.length);
  const valid = new Uint8Array(count);
  let validCount = 0;
  for (let i = 0; i < count; i++) {
    const offset = i * 3;
    const x = Number(source[offset]), y = Number(source[offset + 1]), z = Number(source[offset + 2]);
    if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z) &&
        Math.abs(x) < 1e8 && Math.abs(y) < 1e8 && Math.abs(z) < 1e8) {
      positions[offset] = x;
      positions[offset + 1] = y;
      positions[offset + 2] = z;
      valid[i] = 1;
      validCount++;
    }
  }
  if (validCount < 3) throw new Error('Model decoder returned no usable 3D vertices.');

  const srcIndices = drawable.indices;
  const indices = [];
  const appendTriangle = (a, b, c) => {
    if (!Number.isSafeInteger(a) || !Number.isSafeInteger(b) || !Number.isSafeInteger(c) ||
      a < 0 || b < 0 || c < 0 || a >= count || b >= count || c >= count ||
      a === b || b === c || a === c || !valid[a] || !valid[b] || !valid[c]) return;
    indices.push(a, b, c);
  };
  if (srcIndices?.length) {
    for (let i = 0; i + 2 < srcIndices.length; i += 3) {
      appendTriangle(srcIndices[i], srcIndices[i + 1], srcIndices[i + 2]);
    }
  } else {
    for (let i = 0; i + 2 < count; i += 3) appendTriangle(i, i + 1, i + 2);
  }
  if (!indices.length) throw new Error('Model contains no valid triangles after vertex validation.');

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setIndex(indices);

  const addAttribute = (name, source, itemSize) => {
    if (!source || source.length !== count * itemSize) return false;
    const array = new Float32Array(source.length);
    for (let i = 0; i < source.length; i++) {
      const value = Number(source[i]);
      array[i] = Number.isFinite(value) && Math.abs(value) < 1e8 ? value : 0;
    }
    geometry.setAttribute(name, new THREE.BufferAttribute(array, itemSize));
    return true;
  };

  addAttribute('uv', drawable.uvs, 2);
  const hasNormals = addAttribute('normal', drawable.normals, 3);
  if (!hasNormals) geometry.computeVertexNormals();
  if (drawable.uvs2) addAttribute('ditashaLiveryUv', drawable.uvs2, 2);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  if (!Number.isFinite(geometry.boundingSphere?.radius)) {
    geometry.dispose();
    throw new Error('Decoded model has invalid 3D bounds.');
  }
  return geometry;
}
