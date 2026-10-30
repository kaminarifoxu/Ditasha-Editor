// Composite projection layers from the original RGBA bytes. Canvas readback
// premultiplies alpha and irreversibly loses RGB stored beneath alpha=0.
export function composeProjectionLayers(layers, width, height) {
  const base = layers[0],
    raw = base?.originalPixels;
  const full = (l) =>
    l.visible !== false &&
    l.x === 0 &&
    l.y === 0 &&
    l.w === width &&
    l.h === height &&
    !l.angle &&
    !l.flipX &&
    !l.flipY &&
    !l.mask &&
    l.sx === 0 &&
    l.sy === 0 &&
    l.sw === l.source.width &&
    l.sh === l.source.height &&
    (l.blend || 'source-over') === 'source-over';
  if (
    !raw ||
    !full(base) ||
    base.opacity !== 1 ||
    layers
      .slice(1)
      .some(
        (l) => !l.projectionPixels || !full(l) || l.projectionPixels.length !== width * height * 4,
      )
  )
    return null;
  const output = new Uint8ClampedArray(width * height * 4);
  if (raw.w === width && raw.h === height) output.set(raw.data);
  else
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        const sx = ((x + 0.5) * raw.w) / width - 0.5,
          sy = ((y + 0.5) * raw.h) / height - 0.5;
        const ix = Math.floor(sx),
          iy = Math.floor(sy),
          fx = sx - ix,
          fy = sy - iy;
        for (let c = 0; c < 4; c++) {
          let value = 0;
          for (let dy = 0; dy < 2; dy++)
            for (let dx = 0; dx < 2; dx++) {
              const px = Math.max(0, Math.min(raw.w - 1, ix + dx)),
                py = Math.max(0, Math.min(raw.h - 1, iy + dy));
              value +=
                raw.data[(py * raw.w + px) * 4 + c] * (dx ? fx : 1 - fx) * (dy ? fy : 1 - fy);
            }
          output[(y * width + x) * 4 + c] = value;
        }
      }
  for (const layer of layers.slice(1)) {
    const pixels = layer.projectionPixels,
      opacity = layer.opacity ?? 1;
    for (let i = 0; i < output.length; i += 4) {
      const a = (pixels[i + 3] / 255) * opacity;
      if (!a) continue;
      const baseAlpha = layer.preserveSourceAlpha ? 1 : output[i + 3] / 255;
      const alpha = a + baseAlpha * (1 - a);
      for (let c = 0; c < 3; c++)
        output[i + c] = alpha
          ? (pixels[i + c] * a + output[i + c] * baseAlpha * (1 - a)) / alpha
          : 0;
      if (!layer.preserveSourceAlpha) output[i + 3] = alpha * 255;
    }
  }
  return output;
}
