// Compare the shipped runtime to the verified input, including all node_modules.
const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash } = require('node:crypto');
async function verify(source, destination) {
  let files = 0;
  async function walk(relative = '') {
    for (const entry of await fs.readdir(path.join(source, relative), { withFileTypes: true })) {
      const name = path.join(relative, entry.name);
      if (entry.isDirectory()) await walk(name);
      else if (entry.isFile()) {
        const [before, after] = await Promise.all([
          fs.readFile(path.join(source, name)),
          fs.readFile(path.join(destination, name)),
        ]);
        const digest = (value) => createHash('sha256').update(value).digest('hex');
        if (digest(before) !== digest(after)) throw Error('Packaged engine differs: ' + name);
        files++;
      }
    }
  }
  await walk();
  if (!files) throw Error('No engine files were checked.');
  console.log(`PASS: ${files} packaged IDE files match the verified engine.`);
}
if (require.main === module)
  verify(
    path.resolve('ide-runtime'),
    path.resolve('release/win-unpacked/resources/ide-runtime'),
  ).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
module.exports = { verify };
