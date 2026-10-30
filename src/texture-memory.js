// RGBA memory is separate from compressed file size and native RSC graphics pages.
export const MAX_DECODED_TEXTURE_BYTES = 1024 * 1024 * 1024;
export const MAX_YTD_RESOURCE_BYTES = 768 * 1024 * 1024;
export const MAX_YTD_GRAPHICS_BYTES = 512 * 1024 * 1024;

export const MAX_YTD_INPUT_BYTES = 256 * 1024 * 1024;
export const textureBudgetLabel = Math.round(MAX_DECODED_TEXTURE_BYTES / 1048576) + ' MB';

export function textureThumbnail(t, size = 96) {
  const ratio = Math.min(1, size / t.w, size / t.h),
    w = Math.max(1, Math.round(t.w * ratio)),
    h = Math.max(1, Math.round(t.h * ratio)),
    out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const source = (Math.floor((y * t.h) / h) * t.w + Math.floor((x * t.w) / w)) * 4;
      out.set(t.out.subarray(source, source + 4), (y * w + x) * 4);
    }
  return { w, h, out };
}
