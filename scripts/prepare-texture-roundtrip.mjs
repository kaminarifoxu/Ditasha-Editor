// Generate a real optimizer result for independent native-reader validation.
import { mkdir, writeFile } from 'node:fs/promises';
import { deflateRaw } from 'pako';
import { createYtd } from '../src/asset-tools.js';
import { optimizeYtd } from '../src/texture-optimize.js';
import { Resource } from '../src/resource.js';
const expected = [
  { name: 'native_alpha', w: 32, h: 16, color: [32, 180, 64, 128] },
  { name: 'native_opaque', w: 16, h: 16, color: [40, 80, 200, 255] },
];
const first = optimizeYtd(
  createYtd(
    expected.map((t) => ({
      ...t,
      out: Uint8Array.from({ length: t.w * t.h * 4 }, (_, i) => t.color[i % 4]),
    })),
  ).buffer,
);
const resource = new Resource(first.bytes.buffer, 13);
const padded = new Uint8Array(resource.sys + 64 * 1024 * 1024);
padded.set(resource.bytes);
const header = resource.header.slice();
const flags = new DataView(header.buffer);
flags.setUint32(12, (flags.getUint32(12, true) & 0xf0000000) | 0x0002000d, true);
const payload = deflateRaw(padded),
  input = new Uint8Array(16 + payload.length);
input.set(header);
input.set(payload, 16);
const result = optimizeYtd(input.buffer);
if (
  result.changed !== 0 ||
  !result.repacked ||
  result.allocation.before !== 64 * 1024 * 1024 ||
  result.allocation.after >= result.allocation.before
)
  throw Error('GPU allocation fixture did not repack without reencoding pixels');
await mkdir('release/native-qa', { recursive: true });
await writeFile('release/native-qa/native-repacked.ytd', result.bytes);
await writeFile(
  'release/native-qa/expected.json',
  JSON.stringify({ expected, allocation: result.allocation }),
);
console.log('Prepared lossless GPU repack fixture', result.allocation);
