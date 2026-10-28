// Translate whole triangles, never individual vertices: preserve seam interpolation.
// Bound hostile UV ranges before iterating repeated atlas tiles.
export function repeatedUVTriangles(points) {
  if (points.length !== 3 || points.some((p) => p.length !== 2 || !p.every(Number.isFinite)))
    return [];
  const lo = [0, 1].map((axis) => Math.floor(Math.min(...points.map((p) => p[axis]))));
  const hi = [0, 1].map((axis) => Math.ceil(Math.max(...points.map((p) => p[axis]))) - 1);
  if (![...lo, ...hi].every(Number.isSafeInteger)) return [];
  const count = (hi[0] - lo[0] + 1) * (hi[1] - lo[1] + 1);
  if (!Number.isSafeInteger(count) || count < 1 || count > 64) return [];
  const result = [];
  for (let y = lo[1]; y <= hi[1]; y++)
    for (let x = lo[0]; x <= hi[0]; x++) result.push(points.map(([u, v]) => [u - x, v - y]));
  return result;
}
