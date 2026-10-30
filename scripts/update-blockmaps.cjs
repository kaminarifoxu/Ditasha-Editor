'use strict';
const path = require('node:path');
const { buildBlockMap } = require('app-builder-lib/out/targets/blockmap/blockmap');
async function generate(directory = path.resolve('release')) {
  for (const name of ['DITASHA-Setup.exe', 'DITASHA-Editor.exe']) {
    const file = path.join(directory, name);
    // External maps never alter the EXE. Use the builder pinned in package-lock.
    await buildBlockMap(file, 'gzip', file + '.blockmap');
    console.log('Blockmap ready: ' + name);
  }
}
if (require.main === module)
  generate().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
module.exports = { generate };
