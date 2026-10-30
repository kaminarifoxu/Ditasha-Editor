import { deflateSync } from 'node:zlib';
import { crc32 } from '../../src/asset-tools.js';
import { buildLogoGeometry, logoMeshPayload } from '../../src/logo-prop.js';
export function logoPropFixture() {
  const w = 32,
    h = 32,
    rgba = new Uint8Array(w * h * 4),
    alpha = new Uint8Array(w * h);
  for (let y = 4; y < 28; y++)
    for (let x = 4; x < 28; x++)
      if (!(x >= 12 && x < 20 && y >= 12 && y < 20)) {
        const i = y * w + x;
        alpha[i] = 255;
        rgba.set(y < 16 ? [240, 20, 10, 255] : [10, 20, 240, 255], i * 4);
      }
  const chunk = (type, data) => {
    const body = Buffer.concat([Buffer.from(type), Buffer.from(data)]),
      result = Buffer.alloc(body.length + 8);
    result.writeUInt32BE(data.length);
    body.copy(result, 4);
    result.writeUInt32BE(crc32(body), body.length + 4);
    return result;
  };
  const head = Buffer.alloc(13);
  head.writeUInt32BE(w);
  head.writeUInt32BE(h, 4);
  head[8] = 8;
  head[9] = 6;
  const scan = Buffer.concat(
    Array.from({ length: h }, (_, y) =>
      Buffer.concat([Buffer.from([0]), Buffer.from(rgba.subarray(y * w * 4, (y + 1) * w * 4))]),
    ),
  );
  const png = Buffer.concat([
    Buffer.from('89504e470d0a1a0a', 'hex'),
    chunk('IHDR', head),
    chunk('IDAT', deflateSync(scan)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  const result = buildLogoGeometry(alpha, w, h, { width: 2, depth: 0.08, tolerance: 0 });
  const logo = {
    ...logoMeshPayload(result),
    texture: png.toString('base64'),
    sideColor: [0.1, 0.1, 0.1],
  };
  result.geometry.dispose();
  return { alpha, rgba, width: w, height: h, png, logo };
}
