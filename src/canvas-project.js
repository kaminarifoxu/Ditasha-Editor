import { blendModes, validSize } from './editor.js';
export function validateCanvasProject(p) {
  if (
    !p ||
    p.format !== 'ditasha-canvas' ||
    p.version !== 1 ||
    !validSize(p.w, p.h) ||
    !Array.isArray(p.layers) ||
    p.layers.length > 64 ||
    typeof p.name !== 'string' ||
    p.name.length > 200
  )
    throw Error('Proyek canvas tidak valid.');
  for (const l of p.layers) {
    if (
      !l ||
      typeof l.name !== 'string' ||
      l.name.length > 200 ||
      !['x', 'y', 'w', 'h', 'sx', 'sy', 'sw', 'sh', 'angle', 'opacity'].every(
        (k) => Number.isFinite(l[k]) && Math.abs(l[k]) <= 32768,
      ) ||
      l.w < 1 ||
      l.h < 1 ||
      l.sw < 1 ||
      l.sh < 1 ||
      l.sx < 0 ||
      l.sy < 0 ||
      l.opacity < 0 ||
      l.opacity > 1 ||
      !blendModes.includes(l.blend) ||
      ['visible', 'locked', 'flipX', 'flipY'].some((k) => typeof l[k] !== 'boolean') ||
      typeof l.image !== 'string' ||
      !l.image.startsWith('data:image/png;base64,') ||
      (l.mask !== null &&
        (typeof l.mask !== 'string' || !l.mask.startsWith('data:image/png;base64,')))
    )
      throw Error('Data layer proyek tidak valid.');
  }
  return p;
}
export function serializeCanvas(texture) {
  const pixels = texture.layers.reduce(
    (n, l) => n + l.source.width * l.source.height * (l.mask ? 2 : 1),
    0,
  );
  if (texture.layers.length > 64 || pixels > 33554432)
    throw Error('Proyek maksimum 64 layer dan 128 MB piksel decoded termasuk mask.');
  return JSON.stringify({
    format: 'ditasha-canvas',
    version: 1,
    name: texture.name.slice(0, 200),
    w: texture.w,
    h: texture.h,
    layers: texture.layers.map((l) => ({
      name: l.name.slice(0, 200),
      ...Object.fromEntries(
        ['x', 'y', 'w', 'h', 'sx', 'sy', 'sw', 'sh', 'angle', 'opacity'].map((k) => [k, l[k] || 0]),
      ),
      visible: !!l.visible,
      locked: !!l.locked,
      flipX: !!l.flipX,
      flipY: !!l.flipY,
      blend: l.blend || 'source-over',
      image: l.source.toDataURL('image/png'),
      mask: l.mask?.toDataURL('image/png') || null,
    })),
  });
}
export async function decodeCanvasProject(file) {
  if (file.size > 64 * 1024 * 1024) throw Error('Proyek canvas maksimum 64 MB.');
  const p = validateCanvasProject(JSON.parse(await file.text()));
  let pixels = 0;
  async function canvas(data) {
    const encoded = data.slice(data.indexOf(',') + 1);
    const bytes = Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0));
    const dimensions = pngDimensions(bytes);
    pixels += dimensions.w * dimensions.h;
    if (pixels > 33554432) throw Error('Layer dan mask proyek melebihi batas decoded 128 MB.');
    const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
    try {
      if (!validSize(bitmap.width, bitmap.height) || pixels > 33554432)
        throw Error('Layer dan mask proyek melebihi batas decoded 128 MB.');
      const c = document.createElement('canvas');
      c.width = bitmap.width;
      c.height = bitmap.height;
      c.getContext('2d').drawImage(bitmap, 0, 0);
      return c;
    } finally {
      bitmap.close();
    }
  }
  const layers = [];
  for (const l of p.layers) {
    const source = await canvas(l.image),
      mask = l.mask ? await canvas(l.mask) : null;
    if (
      l.sx + l.sw > source.width ||
      l.sy + l.sh > source.height ||
      (mask && (mask.width !== source.width || mask.height !== source.height))
    )
      throw Error('Ukuran crop/mask proyek tidak cocok.');
    const { image, ...metadata } = l;
    layers.push({ ...metadata, source, mask });
  }
  return { ...p, layers };
}
export function pngDimensions(bytes) {
  if (bytes.length < 24 || [137, 80, 78, 71, 13, 10, 26, 10].some((v, i) => bytes[i] !== v))
    throw Error('Gambar proyek harus PNG yang valid.');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength),
    w = view.getUint32(16),
    h = view.getUint32(20);
  if (!validSize(w, h)) throw Error('Dimensi PNG proyek melebihi batas 16 megapixel.');
  return { w, h };
}
