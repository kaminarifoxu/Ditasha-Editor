import * as THREE from 'three';

// Static snapshots are captured from an explicit WebGL framebuffer, not the
// browser-composited offscreen DOM canvas. Chromium may clip/defer canvases
// positioned outside the visible viewport, producing partial model thumbnails.
export async function captureThumbnailRenderTarget(renderer, scene, camera, width, height) {
  const w = Math.max(1, Math.min(1024, Math.round(width)));
  const h = Math.max(1, Math.min(1024, Math.round(height)));
  const target = new THREE.WebGLRenderTarget(w, h, {
    depthBuffer: true,
    stencilBuffer: false,
    samples: 0,
    format: THREE.RGBAFormat,
    type: THREE.UnsignedByteType,
  });
  const pixels = new Uint8Array(w * h * 4);
  const previous = renderer.getRenderTarget();
  try {
    renderer.setRenderTarget(target);
    renderer.setViewport(0, 0, w, h);
    renderer.setScissorTest(false);
    renderer.clear(true, true, true);
    renderer.render(scene, camera);
    renderer.readRenderTargetPixels(target, 0, 0, w, h, pixels);
  } finally {
    renderer.setRenderTarget(previous);
    renderer.setScissorTest(false);
    target.dispose();
  }
  // readRenderTargetPixels follows OpenGL's bottom-left pixel origin.
  const image = new Uint8ClampedArray(pixels.length);
  const stride = w * 4;
  for (let y = 0; y < h; y++) {
    image.set(pixels.subarray((h - 1 - y) * stride, (h - y) * stride), y * stride);
  }
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw Error('Thumbnail 2D capture tidak tersedia.');
  ctx.putImageData(new ImageData(image, w, h), 0, 0);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  canvas.width = canvas.height = 1;
  if (!blob) throw Error('Tidak dapat menyimpan thumbnail GPU.');
  return blob;
}
