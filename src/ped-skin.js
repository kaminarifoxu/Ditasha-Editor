import { Matrix4, Quaternion, Vector3 } from 'three';

// Legacy GTA layout: CodeWalker Skeleton / Bone / DrawableGeometry.
// Read-only metadata for the booth; no native skeleton or vertex bytes are rewritten.
const basis = new Matrix4().makeRotationX(-Math.PI / 2);
const inverseBasis = basis.clone().invert();
export function readPedRig(r, drawable) {
  const skeleton = r.ptr(drawable + 24);
  if (skeleton === null) return [];
  const data = r.ptr(skeleton + 32),
    parents = r.ptr(skeleton + 56),
    count = r.u16(skeleton + 94);
  if (!count) return [];
  if (
    count > 1024 ||
    data === null ||
    data + count * 80 > r.bytes.length ||
    (parents !== null && parents + count * 2 > r.bytes.length)
  )
    throw Error('Invalid photo skeleton.');
  const bones = [];
  for (let i = 0; i < count; i++) {
    const at = data + i * 80;
    const rotation = [0, 4, 8, 12].map((n) => r.f32(at + n));
    const position = [16, 20, 24].map((n) => r.f32(at + n));
    const scale = [32, 36, 40].map((n) => r.f32(at + n));
    const parent = r.v.getInt16(parents === null ? at + 50 : parents + i * 2, true);
    if (
      ![...rotation, ...position, ...scale].every(Number.isFinite) ||
      parent < -1 ||
      parent >= count ||
      parent === i ||
      Math.hypot(...rotation) < 1e-10 ||
      scale.some((n) => Math.abs(n) < 1e-10)
    )
      throw Error('Invalid photo bone transform.');
    const matrix = new Matrix4().compose(
      new Vector3(...position),
      new Quaternion(...rotation).normalize(),
      new Vector3(...scale),
    );
    matrix.premultiply(basis).multiply(inverseBasis);
    bones.push({
      name: r.str(r.ptr(at + 56)) || 'bone_' + i,
      tag: r.u16(at + 68),
      parent,
      matrix: matrix.toArray(),
    });
  }
  for (let i = 0; i < count; i++) {
    const visited = new Set();
    for (let n = i; n >= 0; n = bones[n].parent) {
      if (visited.has(n)) throw Error('Cyclic photo skeleton.');
      visited.add(n);
    }
  }
  return bones;
}
export function readPedWeights(r, g, data, count, stride, offsets) {
  if (!offsets[1] || !offsets[2]) return null;
  if (![8, 9].includes(offsets[2].type) || ![7, 8, 9].includes(offsets[1].type)) return null;
  const paletteAt = r.ptr(g + 104),
    paletteCount = r.u16(g + 114);
  if (
    paletteCount > 1024 ||
    (paletteCount && (paletteAt === null || paletteAt + paletteCount * 2 > r.bytes.length))
  )
    throw Error('Invalid photo bone palette.');
  const palette = Array.from({ length: paletteCount }, (_, i) => r.u16(paletteAt + i * 2));
  const indices = new Uint16Array(count * 4),
    weights = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    let sum = 0;
    for (let k = 0; k < 4; k++) {
      const index = r.bytes[data + i * stride + offsets[2].offset + k];
      const weight =
        offsets[1].type === 7
          ? r.f32(data + i * stride + offsets[1].offset + k * 4)
          : r.bytes[data + i * stride + offsets[1].offset + k] / 255;
      if (
        !Number.isFinite(weight) ||
        weight < 0 ||
        weight > 1.001 ||
        (weight > 0 && palette.length && index >= palette.length)
      )
        throw Error('Invalid photo skin weights.');
      indices[i * 4 + k] = palette.length ? palette[index] || 0 : index;
      weights[i * 4 + k] = weight;
      sum += weight;
    }
    if (sum < 1e-8) throw Error('Photo skin contains unweighted vertices.');
    for (let k = 0; k < 4; k++) weights[i * 4 + k] /= sum;
  }
  return { indices, weights };
}
