'use strict';
// Windows-only opt-in LOCAL native GLB -> FiveM prop integration smoke.
// Usage: node scripts/smoke-prop-native.cjs "C:\Path\To\native-tools" "C:\Temp\prop-test-outputs"
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { createAssetTokens } = require('../electron/creators/asset-tokens.cjs');
const { buildPropResource } = require('../electron/creators/prop-build.cjs');

function createGlbCube() {
  const faces = [
    [[-0.5,-0.5,0.5],[0.5,-0.5,0.5],[0.5,0.5,0.5],[-0.5,0.5,0.5]],
    [[0.5,-0.5,-0.5],[-0.5,-0.5,-0.5],[-0.5,0.5,-0.5],[0.5,0.5,-0.5]],
    [[0.5,-0.5,0.5],[0.5,-0.5,-0.5],[0.5,0.5,-0.5],[0.5,0.5,0.5]],
    [[-0.5,-0.5,-0.5],[-0.5,-0.5,0.5],[-0.5,0.5,0.5],[-0.5,0.5,-0.5]],
    [[-0.5,0.5,0.5],[0.5,0.5,0.5],[0.5,0.5,-0.5],[-0.5,0.5,-0.5]],
    [[-0.5,-0.5,-0.5],[0.5,-0.5,-0.5],[0.5,-0.5,0.5],[-0.5,-0.5,0.5]],
  ];
  const positions = [];
  const uvs = [];
  const indices = [];
  const faceUvs = [[0,0],[1,0],[1,1],[0,1]];
  for (let face = 0; face < faces.length; face++) {
    const base = face * 4;
    for (let vertex = 0; vertex < 4; vertex++) {
      positions.push(...faces[face][vertex]);
      uvs.push(...faceUvs[vertex]);
    }
    indices.push(base, base+1, base+2, base, base+2, base+3);
  }

  const positionBytes = Buffer.from(new Float32Array(positions).buffer);
  const uvBytes = Buffer.from(new Float32Array(uvs).buffer);
  const indexBytes = Buffer.from(new Uint16Array(indices).buffer);
  const positionOffset = 0;
  const uvOffset = positionBytes.length;
  const indexOffset = uvOffset + uvBytes.length;
  const binary = Buffer.concat([positionBytes, uvBytes, indexBytes]);
  const document = {
    asset: { version: '2.0', generator: 'DITASHA GLB native smoke fixture' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0, name: 'DitashaSmokeCube' }],
    meshes: [{
      name: 'DitashaSmokeCube',
      primitives: [{ attributes: { POSITION: 0, TEXCOORD_0: 1 }, indices: 2, material: 0 }],
    }],
    materials: [{
      name: 'DitashaSmokeOrange',
      pbrMetallicRoughness: {
        baseColorFactor: [0.85, 0.32, 0.08, 1],
        metallicFactor: 0,
        roughnessFactor: 0.8,
      },
    }],
    buffers: [{ byteLength: binary.length }],
    bufferViews: [
      { buffer: 0, byteOffset: positionOffset, byteLength: positionBytes.length, target: 34962 },
      { buffer: 0, byteOffset: uvOffset, byteLength: uvBytes.length, target: 34962 },
      { buffer: 0, byteOffset: indexOffset, byteLength: indexBytes.length, target: 34963 },
    ],
    accessors: [
      { bufferView: 0, componentType: 5126, count: 24, type: 'VEC3', min: [-0.5,-0.5,-0.5], max: [0.5,0.5,0.5] },
      { bufferView: 1, componentType: 5126, count: 24, type: 'VEC2' },
      { bufferView: 2, componentType: 5123, count: 36, type: 'SCALAR', min: [0], max: [23] },
    ],
  };
  let json = Buffer.from(JSON.stringify(document), 'utf8');
  const jsonPadding = (4 - (json.length % 4)) % 4;
  if (jsonPadding) json = Buffer.concat([json, Buffer.alloc(jsonPadding, 0x20)]);
  const binaryPadding = (4 - (binary.length % 4)) % 4;
  const paddedBinary = binaryPadding ? Buffer.concat([binary, Buffer.alloc(binaryPadding)]) : binary;
  const totalLength = 12 + 8 + json.length + 8 + paddedBinary.length;
  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(totalLength, 8);
  const jsonHeader = Buffer.alloc(8);
  jsonHeader.writeUInt32LE(json.length, 0);
  jsonHeader.writeUInt32LE(0x4e4f534a, 4);
  const binHeader = Buffer.alloc(8);
  binHeader.writeUInt32LE(paddedBinary.length, 0);
  binHeader.writeUInt32LE(0x004e4942, 4);
  return Buffer.concat([header, jsonHeader, json, binHeader, paddedBinary]);
}

async function main() {
  if (process.platform !== 'win32') throw Error('Binary Sollumz/PyMateria smoke requires Windows');
  const [providerRoot, outputRoot] = process.argv.slice(2);
  if (!providerRoot || !outputRoot || !path.isAbsolute(providerRoot) || !path.isAbsolute(outputRoot))
    throw Error('Specify absolute managed-native root and output directory');
  await fs.mkdir(outputRoot, { recursive: true });
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'ditasha-glb-prop-smoke-'));
  const source = path.join(temp, 'ditasha_cube.glb');
  await fs.writeFile(source, createGlbCube());
  try {
    const tokens = createAssetTokens();
    const input = await tokens.issue({ kind: 'input', selectedPath: source });
    const output = await tokens.issue({ kind: 'output', selectedPath: outputRoot });
    const result = await buildPropResource({
      request: {
        schemaVersion: 1, sourceToken: input.token, outputToken: output.token,
        projectName: 'ditasha_glb_prop_smoke', sourceName: 'ditasha_cube.glb',
        edition: 'legacy', collision: 'box', drawDistance: 100, lodDistances: [20, 60],
      }, tokens, providerRoot,
    });
    console.log(JSON.stringify({
      smoke: 'PASS', input: 'GLB 2.0', output: result.output,
      roundTrip: result.nativeRoundTripPassed, gameTestPassed: result.gameTestPassed,
    }, null, 2));
  } finally {
    await fs.rm(temp, { recursive: true, force: true });
  }
}
if (require.main === module) main().catch(error => {
  console.error('PROP_GLB_NATIVE_SMOKE_FAILED:', error.message);
  process.exitCode = 1;
});
module.exports = { createGlbCube };
