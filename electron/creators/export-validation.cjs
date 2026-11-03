'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { createReadStream } = require('node:fs');
function safeRelative(value) {
  if (typeof value !== 'string' || !value || value.includes('\\') || value.includes('\0') || path.posix.isAbsolute(value)) throw Error('Invalid artifact path');
  const parts = value.split('/');
  if (parts.some(part => !part || part === '.' || part === '..' || /[<>:"|?*\x00-\x1f]/.test(part))) throw Error('Unsafe artifact path');
  return value;
}
async function digest(file) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}
async function validateArtifacts(stagingRoot, artifacts) {
  if (!Array.isArray(artifacts) || !artifacts.length || artifacts.length > 4096) throw Error('Invalid artifact list');
  const root = await fs.realpath(stagingRoot);
  const seen = new Set(), verified = [];
  for (const item of artifacts) {
    if (!item || typeof item !== 'object') throw Error('Invalid artifact');
    const relativePath = safeRelative(item.relativePath);
    if (seen.has(relativePath.toLowerCase())) throw Error('Duplicate artifact');
    seen.add(relativePath.toLowerCase());
    const filename = path.resolve(root, ...relativePath.split('/'));
    if (!filename.startsWith(root + path.sep)) throw Error('Artifact outside staging');
    const stat = await fs.lstat(filename);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size <= 0) throw Error('Invalid artifact type or size');
    const real = await fs.realpath(filename);
    if (!real.startsWith(root + path.sep)) throw Error('Artifact symlink escape');
    const sha256 = await digest(real);
    if (item.sha256 !== undefined && item.sha256 !== sha256) throw Error('Artifact checksum mismatch');
    if (item.bytes !== undefined && item.bytes !== stat.size) throw Error('Artifact size mismatch');
    verified.push(Object.freeze({ relativePath, bytes: stat.size, sha256 }));
  }
  return verified;
}
async function commitExport({ stagingRoot, destinationRoot, artifacts }) {
  const validated = await validateArtifacts(stagingRoot, artifacts);
  const target = path.resolve(destinationRoot);
  // Never replace existing outputs. A unique destination avoids partial overwrite.
  await fs.mkdir(path.dirname(target), { recursive: true });
  try { await fs.lstat(target); throw Error('Export destination already exists'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  // Staging must be on the same filesystem for atomic rename.
  await fs.rename(stagingRoot, target);
  return { output: target, artifacts: validated };
}
module.exports = { safeRelative, validateArtifacts, commitExport };
