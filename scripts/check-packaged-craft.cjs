'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash } = require('node:crypto');
async function digest(file) {
  return createHash('sha256')
    .update(await fs.readFile(file))
    .digest('hex');
}
async function walk(source, target) {
  let count = 0;
  for (const entry of await fs.readdir(source, { withFileTypes: true })) {
    const a = path.join(source, entry.name),
      b = path.join(target, entry.name);
    if (entry.isDirectory()) count += await walk(a, b);
    else {
      if ((await digest(a)) !== (await digest(b)))
        throw Error('Packaged creative file differs: ' + b);
      count++;
    }
  }
  return count;
}
walk(path.resolve('craft-runtime'), path.resolve('release/win-unpacked/resources/craft-runtime'))
  .then((n) =>
    console.log('PASS: ' + n + ' packaged creative engine files match the verified originals'),
  )
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });
