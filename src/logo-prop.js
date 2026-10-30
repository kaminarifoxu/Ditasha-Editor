import { Shape, Path, ExtrudeGeometry } from 'three';

// Remove a connected, approximately flat background. Interior matching pixels
// survive in edge mode; all-color mode is explicit for enclosed white areas.
export function removeLogoBackground(
  pixels,
  width,
  height,
  { mode = 'keep', color = [255, 255, 255], tolerance = 30 } = {},
) {
  if (pixels.length !== width * height * 4 || width < 1 || height < 1 || width * height > 4194304)
    throw Error('Gambar kerja maksimal 4 megapixel.');
  if (
    !['keep', 'edge', 'color'].includes(mode) ||
    !Number.isFinite(tolerance) ||
    tolerance < 0 ||
    tolerance > 150 ||
    color.length !== 3 ||
    color.some((c) => !Number.isFinite(c) || c < 0 || c > 255)
  )
    throw Error('Pengaturan latar tidak valid.');
  const out = new Uint8ClampedArray(pixels);
  if (mode === 'keep') return out;
  const matches = (i) =>
    out[i * 4 + 3] === 0 || Math.hypot(...color.map((c, k) => out[i * 4 + k] - c)) <= tolerance;
  if (mode === 'color') {
    for (let i = 0; i < width * height; i++) if (matches(i)) out[i * 4 + 3] = 0;
  } else {
    const queue = new Int32Array(width * height),
      seen = new Uint8Array(width * height);
    let read = 0,
      write = 0;
    const add = (i) => {
      if (!seen[i] && matches(i)) {
        seen[i] = 1;
        queue[write++] = i;
      }
    };
    for (let x = 0; x < width; x++) {
      add(x);
      add((height - 1) * width + x);
    }
    for (let y = 0; y < height; y++) {
      add(y * width);
      add(y * width + width - 1);
    }
    while (read < write) {
      const i = queue[read++],
        x = i % width,
        y = Math.floor(i / width);
      out[i * 4 + 3] = 0;
      if (x) add(i - 1);
      if (x + 1 < width) add(i + 1);
      if (y) add(i - width);
      if (y + 1 < height) add(i + width);
    }
  }
  return out;
}

const area = (p) =>
  p.reduce((n, a, i) => {
    const b = p[(i + 1) % p.length];
    return n + a[0] * b[1] - b[0] * a[1];
  }, 0) / 2;
function inside(point, polygon) {
  let hit = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [x, y] = polygon[i],
      [a, b] = polygon[j];
    if (y > point[1] !== b > point[1] && point[0] < ((a - x) * (point[1] - y)) / (b - y) + x)
      hit = !hit;
  }
  return hit;
}
function simplify(points, tolerance) {
  // Collinear grid vertices are redundant, including the closed seam.
  const p = points.filter((b, i) => {
    const a = points[(i + points.length - 1) % points.length],
      c = points[(i + 1) % points.length];
    return (b[0] - a[0]) * (c[1] - b[1]) !== (b[1] - a[1]) * (c[0] - b[0]);
  });
  if (p.length < 4 || tolerance === 0) return p;
  let far = 1;
  for (let i = 2; i < p.length; i++)
    if (
      Math.hypot(p[i][0] - p[0][0], p[i][1] - p[0][1]) >
      Math.hypot(p[far][0] - p[0][0], p[far][1] - p[0][1])
    )
      far = i;
  function line(list) {
    const keep = new Set([0, list.length - 1]),
      work = [[0, list.length - 1]];
    while (work.length) {
      const [a, b] = work.pop(),
        dx = list[b][0] - list[a][0],
        dy = list[b][1] - list[a][1],
        length = dx * dx + dy * dy;
      let best = -1,
        distance = tolerance;
      for (let i = a + 1; i < b; i++) {
        const t = length
          ? Math.max(
              0,
              Math.min(
                1,
                ((list[i][0] - list[a][0]) * dx + (list[i][1] - list[a][1]) * dy) / length,
              ),
            )
          : 0;
        const d = Math.hypot(list[i][0] - list[a][0] - t * dx, list[i][1] - list[a][1] - t * dy);
        if (d > distance) {
          best = i;
          distance = d;
        }
      }
      if (best !== -1) {
        keep.add(best);
        work.push([a, best], [best, b]);
      }
    }
    return [...keep].sort((a, b) => a - b).map((i) => list[i]);
  }
  const result = [
    ...line(p.slice(0, far + 1)).slice(0, -1),
    ...line([...p.slice(far), p[0]]).slice(0, -1),
  ];
  return result.length >= 3 ? result : p;
}
export function logoContours(alpha, width, height, { threshold = 128, tolerance = 0.65 } = {}) {
  if (
    width > 256 ||
    height > 256 ||
    width < 1 ||
    height < 1 ||
    alpha.length !== width * height ||
    !Number.isFinite(threshold) ||
    threshold < 1 ||
    threshold > 255 ||
    !Number.isFinite(tolerance) ||
    tolerance < 0 ||
    tolerance > 2
  )
    throw Error('Silhouette maksimal 256 × 256; pengaturan kontur tidak valid.');
  const edges = new Map(),
    stride = width + 1;
  const occupied = (x, y) =>
    x >= 0 && y >= 0 && x < width && y < height && alpha[y * width + x] >= threshold;
  function add(x, y, dx, dy, direction) {
    const key = y * stride + x;
    if (!edges.has(key)) edges.set(key, []);
    edges.get(key).push({ end: (y + dy) * stride + x + dx, direction });
  }
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      if (occupied(x, y)) {
        if (!occupied(x, y - 1)) add(x, y, 1, 0, 0);
        if (!occupied(x + 1, y)) add(x + 1, y, 0, 1, 1);
        if (!occupied(x, y + 1)) add(x + 1, y + 1, -1, 0, 2);
        if (!occupied(x - 1, y)) add(x, y + 1, 0, -1, 3);
      }
  const loops = [];
  while (edges.size) {
    const start = edges.keys().next().value,
      points = [];
    let key = start,
      previous = 0,
      steps = 0;
    do {
      points.push([key % stride, Math.floor(key / stride)]);
      const choices = edges.get(key);
      if (!choices?.length || ++steps > 262144) throw Error('Kontur tidak tertutup.');
      choices.sort(
        (a, b) =>
          [1, 0, 3, 2].indexOf((a.direction - previous + 4) % 4) -
          [1, 0, 3, 2].indexOf((b.direction - previous + 4) % 4),
      );
      const edge = choices.shift();
      if (!choices.length) edges.delete(key);
      previous = edge.direction;
      key = edge.end;
    } while (key !== start);
    if (Math.abs(area(points)) >= 2) loops.push(simplify(points, tolerance));
    if (loops.length > 512)
      throw Error('Logo terlalu berisik: kurangi detail atau bersihkan latar.');
  }
  const shapes = loops.filter((p) => area(p) > 0).map((outer) => ({ outer, holes: [] }));
  for (const hole of loops.filter((p) => area(p) < 0)) {
    const owner = shapes
      .filter((s) => inside(hole[0], s.outer))
      .sort((a, b) => area(a.outer) - area(b.outer))[0];
    if (owner) owner.holes.push(hole);
  }
  if (!shapes.length)
    throw Error('Tidak ada bagian logo yang terlihat. Turunkan batas alpha atau pulihkan latar.');
  if (loops.reduce((n, p) => n + p.length, 0) > 16000)
    throw Error('Kontur terlalu rumit; turunkan detail.');
  return shapes;
}

export function buildLogoGeometry(alpha, gridWidth, gridHeight, options = {}) {
  const { width = 2, depth = 0.08, mode = 'logo', threshold = 128, tolerance = 0.65 } = options;
  if (
    !Number.isFinite(width) ||
    width < 0.05 ||
    width > 20 ||
    !Number.isFinite(depth) ||
    depth < 0.001 ||
    depth > 1 ||
    !['logo', 'board'].includes(mode)
  )
    throw Error('Ukuran prop tidak valid.');
  if (
    gridWidth < 1 ||
    gridHeight < 1 ||
    gridWidth > 256 ||
    gridHeight > 256 ||
    alpha.length !== gridWidth * gridHeight
  )
    throw Error('Ukuran silhouette tidak valid.');
  const contours =
    mode === 'board'
      ? [
          {
            outer: [
              [0, 0],
              [gridWidth, 0],
              [gridWidth, gridHeight],
              [0, gridHeight],
            ],
            holes: [],
          },
        ]
      : logoContours(alpha, gridWidth, gridHeight, { threshold, tolerance });
  const points = contours.flatMap((c) => c.outer);
  const minX = Math.min(...points.map((p) => p[0])),
    maxX = Math.max(...points.map((p) => p[0]));
  const minY = Math.min(...points.map((p) => p[1])),
    maxY = Math.max(...points.map((p) => p[1]));
  const scale = width / (maxX - minX),
    height = (maxY - minY) * scale;
  if (height > 20) throw Error('Tinggi prop maksimal 20 meter; kurangi lebar atau crop gambar.');
  const convert = (p) => [(p[0] - minX) * scale - width / 2, height / 2 - (p[1] - minY) * scale];
  const paths = contours.map((c) => {
    const shape = new Shape(
      c.outer.map((p) => {
        const [x, y] = convert(p);
        return { x, y };
      }),
    );
    shape.holes = c.holes.map(
      (h) =>
        new Path(
          h.map((p) => {
            const [x, y] = convert(p);
            return { x, y };
          }),
        ),
    );
    return shape;
  });
  const uv = (x, y) => [
    (x / scale + minX + (maxX - minX) / 2) / gridWidth,
    1 - ((height / 2 - y) / scale + minY) / gridHeight,
  ];
  const geometry = new ExtrudeGeometry(paths, {
    depth,
    bevelEnabled: false,
    steps: 1,
    curveSegments: 1,
    material: 0,
    extrudeMaterial: 1,
    UVGenerator: {
      generateTopUV: (g, v, a, b, c) =>
        [a, b, c].map((i) => {
          const [x, y] = uv(v[i * 3], v[i * 3 + 1]);
          return { x, y };
        }),
      generateSideWallUV: () => [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 1 },
        { x: 0, y: 1 },
      ],
    },
  });
  if (geometry.attributes.position.count > 180000) {
    geometry.dispose();
    throw Error('Mesh melebihi 60.000 segitiga; kurangi detail.');
  }
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return {
    geometry,
    width,
    height,
    depth,
    islands: contours.length,
    holes: contours.reduce((n, c) => n + c.holes.length, 0),
  };
}

export function logoMeshPayload(result) {
  const g = result.geometry,
    p = g.attributes.position,
    uv = g.attributes.uv;
  const positions = [],
    uvs = Array.from(uv.array),
    materials = Array(p.count / 3).fill(1);
  for (let i = 0; i < p.count; i++) positions.push(p.getX(i), -p.getZ(i), p.getY(i));
  for (const group of g.groups)
    for (let i = group.start; i < group.start + group.count; i += 3)
      materials[i / 3] = group.materialIndex;
  return { positions, uvs, materials };
}
