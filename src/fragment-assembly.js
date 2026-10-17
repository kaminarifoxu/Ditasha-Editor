import { Matrix4 } from 'three';

// Legacy FragPhysicsLOD / FragPhysTransforms, verified against CodeWalker.
const frontWheels = new Set([27922, 26418]);
const rearWheels = new Set([29921, 29922, 29923, 27902, 5857, 5858, 5859, 26398]);
const rightWheels = new Set([26418, 5857, 5858, 5859, 26398]);
export function fragmentPose(r) {
  const at = r.ptr(168);
  if (at === null) return null;
  const count = r.bytes[at + 16];
  if (at + 32 + count * 48 > r.bytes.length) throw Error('Truncated fragment bone pose.');
  return Array.from({ length: count }, (_, i) => {
    const v = Array.from({ length: 12 }, (_, j) => r.f32(at + 32 + i * 48 + j * 4));
    if (!v.every(Number.isFinite)) throw Error('Invalid fragment bone pose.');
    return new Matrix4().set(...v.slice(0, 4), ...v.slice(4, 8), ...v.slice(8, 12), 0, 0, 0, 1);
  });
}

export function fragmentChildren(r, main, inheritedBones) {
  const group = r.ptr(240),
    lod = group === null ? null : r.ptr(group + 16);
  if (lod === null) return [];
  const children = r.list(lod + 208, r.bytes[lod + 285]);
  const transforms = r.ptr(lod + 256),
    count = transforms === null ? 0 : r.u32(transforms + 16);
  if (count > 256 || (transforms !== null && transforms + 32 + count * 64 > r.bytes.length))
    throw Error('Invalid fragment transform array.');
  const offset = [0, 4, 8].map((i) => r.f32(lod + 48 + i));
  if (!offset.every(Number.isFinite)) throw Error('Invalid fragment position offset.');
  const skeleton = main === null ? null : r.ptr(main + 24);
  const bones = skeleton === null ? null : r.ptr(skeleton + 32);
  const boneCount = skeleton === null ? 0 : r.u16(skeleton + 94);
  const byTag = new Map();
  if (bones !== null)
    for (let i = 0; i < boneCount; i++) byTag.set(r.u16(bones + i * 80 + 68), inheritedBones[i]);
  const records = children.map((child, index) => ({
    index,
    tag: r.u16(child + 18),
    pristine: r.ptr(child + 160),
    damaged: r.ptr(child + 168),
  }));
  const hasModels = (p) => {
    if (p === null) return false;
    try {
      return [80, 88, 96, 104].some((o) => {
        const list = r.ptr(p + o);
        return list !== null && r.u16(list + 8) > 0;
      });
    } catch {
      return true;
    } // Let the drawable reader report this child without losing the body.
  };
  const front = records.find((c) => frontWheels.has(c.tag) && hasModels(c.pristine))?.pristine;
  const rear = records.find((c) => rearWheels.has(c.tag) && hasModels(c.pristine))?.pristine;
  const result = [];
  for (const c of records) {
    let transform = byTag.get(c.tag);
    if (c.index < count) {
      const values = Array.from({ length: 16 }, (_, i) =>
        r.f32(transforms + 32 + c.index * 64 + i * 4),
      );
      if (!values.every((v, i) => i % 4 === 3 || Number.isFinite(v)))
        throw Error('Invalid fragment placement matrix.');
      transform = new Matrix4().fromArray(values);
      // GTA uses only the affine 3x4 portion. Its unused fourth column can be
      // zero (including M44); Three would otherwise divide vertex positions by zero.
      for (const i of [3, 7, 11]) transform.elements[i] = 0;
      transform.elements[15] = 1;
      // Native matrices use row-vector translation; fromArray transposes it for Three.
      transform.elements[12] += offset[0];
      transform.elements[13] += offset[1];
      transform.elements[14] += offset[2];
    }
    if (transform && rightWheels.has(c.tag)) {
      transform = transform.clone();
      const e = transform.elements;
      e[0] = -1;
      e[1] = e[2] = e[4] = e[6] = e[8] = e[9] = 0;
      e[5] = 1;
      e[10] = -1;
    }
    let pristine = c.pristine;
    if (pristine !== null && !hasModels(pristine)) {
      const donor = frontWheels.has(c.tag)
        ? (front ?? rear)
        : rearWheels.has(c.tag)
          ? (rear ?? front)
          : null;
      if (donor !== null && donor !== undefined) pristine = donor;
    }
    for (const [pointer, state] of [
      [pristine, 'Pristine'],
      [c.damaged, 'Damaged'],
    ]) {
      if (pointer === null || pointer === main) continue;
      result.push({
        pointer,
        name: `Fragment ${c.index + 1} · bone ${c.tag} · ${state}`,
        shaderParent: main,
        fragmentChild: true,
        fragmentState: state,
        fragmentIndex: c.index,
        fragmentBoneTag: c.tag,
        transform,
        inheritedBones,
      });
    }
  }
  return result;
}

export function assembleFragments(drawables, main) {
  const body = drawables.find((d) => d.sourceDrawable === main && !d.fragmentChild);
  if (!body) return;
  const children = drawables.filter((d) => d.fragmentState === 'Pristine');
  if (!children.length) return;
  const nativeLods = body.lods;
  body.lods = nativeLods.map((level) => {
    const geometries = [...level.geometries];
    let nextPart = geometries.reduce((n, g) => Math.max(n, g.part), -1) + 1;
    for (const child of children) {
      const childLevel = child.lods.find((l) => l.name === level.name) || child.lods[0];
      const parts = new Map();
      for (const g of childLevel.geometries) {
        if (!parts.has(g.part)) parts.set(g.part, nextPart++);
        geometries.push({
          ...g,
          part: parts.get(g.part),
          fragmentBoneTag: child.fragmentBoneTag,
          name: child.name + ' · ' + g.name,
        });
      }
    }
    return { ...level, geometries };
  });
  body.geometries = body.lods[0].geometries;
  body.embeddedTextures = [
    ...new Set([
      ...(body.embeddedTextures || []),
      ...children.flatMap((c) => c.embeddedTextures || []),
    ]),
  ];
  body.assembledVehicle = true;
  body.name = 'Vehicle · lengkap';
}
