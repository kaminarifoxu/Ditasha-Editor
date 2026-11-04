'use strict';
// Windows-only opt-in LOCAL native integration smoke.
// Usage: node scripts/smoke-prop-native.cjs "C:\Path\To\native-tools" "C:\Temp\prop-test-outputs"
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { createAssetTokens } = require('../electron/creators/asset-tokens.cjs');
const { buildPropResource } = require('../electron/creators/prop-build.cjs');
const cubeObj = "o DitashaSmokeCube\nv -0.5 -0.5 -0.5\nv 0.5 -0.5 -0.5\nv 0.5 0.5 -0.5\nv -0.5 0.5 -0.5\nv -0.5 -0.5 0.5\nv 0.5 -0.5 0.5\nv 0.5 0.5 0.5\nv -0.5 0.5 0.5\nvt 0 0\nvt 1 0\nvt 1 1\nvt 0 1\nf 1/1 4/2 3/3 2/4\nf 5/1 6/2 7/3 8/4\nf 1/1 2/2 6/3 5/4\nf 2/1 3/2 7/3 6/4\nf 3/1 4/2 8/3 7/4\nf 4/1 1/2 5/3 8/4\n";
async function main() {
  if (process.platform !== 'win32') throw Error('Binary Sollumz/PyMateria smoke requires Windows');
  const [providerRoot, outputRoot] = process.argv.slice(2);
  if (!providerRoot || !outputRoot || !path.isAbsolute(providerRoot) || !path.isAbsolute(outputRoot))
    throw Error('Specify absolute managed-native root and output directory');
  await fs.mkdir(outputRoot, { recursive: true });
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'ditasha-prop-smoke-'));
  const source = path.join(temp, 'ditasha_cube.obj');
  await fs.writeFile(source, cubeObj);
  try {
    const tokens = createAssetTokens();
    const input = await tokens.issue({ kind: 'input', selectedPath: source });
    const output = await tokens.issue({ kind: 'output', selectedPath: outputRoot });
    const result = await buildPropResource({
      request: {
        schemaVersion: 1, sourceToken: input.token, outputToken: output.token,
        projectName: 'ditasha_prop_smoke', sourceName: 'ditasha_cube.obj',
        edition: 'legacy', collision: 'box', drawDistance: 100, lodDistances: [20, 60],
      }, tokens, providerRoot,
    });
    console.log(JSON.stringify({ smoke: 'PASS', output: result.output, roundTrip: result.nativeRoundTripPassed, gameTestPassed: result.gameTestPassed }, null, 2));
  } finally {
    await fs.rm(temp, { recursive: true, force: true });
  }
}
if (require.main === module) main().catch(error => {
  console.error('PROP_NATIVE_SMOKE_FAILED:', error.message);
  process.exitCode = 1;
});
module.exports = { cubeObj };
