// Defend Three.js previews from corrupt/unsupported GTA vertex streams.
// Never mutate decoded source arrays; a damaged triangle is removed, while
// other valid triangles remain visible for inspection.
export function safePreviewMesh(mesh) {
  const positions = mesh?.positions;
  if (!positions || positions.length < 9 || positions.length % 3) return null;
  const vertexCount = positions.length / 3;
  const bad = new Uint8Array(vertexCount);
  let invalid = 0;
  for (let v = 0; v < vertexCount; v++) {
    const i = v * 3;
    if (![positions[i], positions[i + 1], positions[i + 2]].every(Number.isFinite)) {
      bad[v] = 1;
      invalid++;
    }
  }
  const source = mesh.indices;
  const triangles = [];
  if (source?.length) {
    for (let i = 0; i + 2 < source.length; i += 3) {
      const a = source[i], b = source[i + 1], c = source[i + 2];
      if ([a, b, c].every((n) => Number.isInteger(n) && n >= 0 && n < vertexCount && !bad[n]))
        triangles.push(a, b, c);
    }
  } else {
    for (let i = 0; i + 2 < vertexCount; i += 3)
      if (!bad[i] && !bad[i + 1] && !bad[i + 2]) triangles.push(i, i + 1, i + 2);
  }
  if (!triangles.length) return null;
  // Ensure invalid, unreferenced vertices cannot poison bounding spheres.
  const position = invalid ? Float32Array.from(positions, (n) => Number.isFinite(n) ? n : 0) : positions;
  function attribute(source, stride) {
    if (!source || source.length !== vertexCount * stride) return null;
    if (!Array.from(source).every(Number.isFinite))
      return Float32Array.from(source, (n) => Number.isFinite(n) ? n : 0);
    return source;
  }
  return {
    positions: position,
    indices: vertexCount > 65535 ? Uint32Array.from(triangles) : Uint16Array.from(triangles),
    uvs: attribute(mesh.uvs, 2),
    normals: attribute(mesh.normals, 3),
    uvs2: attribute(mesh.uvs2, 2),
    droppedTriangles: (source?.length || vertexCount) / 3 - triangles.length / 3,
  };
}
