'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash, randomUUID } = require('node:crypto');
const { createReadStream } = require('node:fs');

const WINDOWS_DEVICE = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i;
function safeRelative(value) {
  if (typeof value !== 'string' || !value || value.length > 1024 || value.includes('\\') || value.includes('\0') || path.posix.isAbsolute(value)) throw Error('Invalid artifact path');
  const parts = value.split('/');
  if (parts.some(part => !part || part === '.' || part === '..' || part.length > 255 || /[<>:"|?*\x00-\x1f]/.test(part) || /[. ]$/.test(part) || WINDOWS_DEVICE.test(part))) throw Error('Unsafe artifact path');
  return value;
}
async function digest(file) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}
async function guardAncestors(root, file) {
  const relative = path.relative(root, file);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw Error('Artifact outside staging');
  let cursor = root;
  for (const component of relative.split(path.sep)) {
    cursor = path.join(cursor, component);
    const stat = await fs.lstat(cursor);
    if (stat.isSymbolicLink()) throw Error('Artifact symlink escape');
    if (cursor !== file && !stat.isDirectory()) throw Error('Invalid artifact ancestor');
  }
}
async function validateArtifacts(stagingRoot, artifacts) {
  if (!Array.isArray(artifacts) || !artifacts.length || artifacts.length > 4096) throw Error('Invalid artifact list');
  const base = await fs.lstat(stagingRoot);
  if (!base.isDirectory() || base.isSymbolicLink()) throw Error('Invalid staging root');
  const root = await fs.realpath(stagingRoot);
  const seen = new Set(), verified = [];
  for (const item of artifacts) {
    if (!item || typeof item !== 'object') throw Error('Invalid artifact');
    const relativePath = safeRelative(item.relativePath);
    const normalized = relativePath.toLowerCase();
    if (seen.has(normalized)) throw Error('Duplicate artifact');
    seen.add(normalized);
    const filename = path.resolve(root, ...relativePath.split('/'));
    await guardAncestors(root, filename);
    const stat = await fs.lstat(filename);
    if (!stat.isFile() || stat.size <= 0) throw Error('Invalid artifact type or size');
    const sha256 = await digest(filename);
    if (item.sha256 !== undefined && item.sha256 !== sha256) throw Error('Artifact checksum mismatch');
    if (item.bytes !== undefined && item.bytes !== stat.size) throw Error('Artifact size mismatch');
    verified.push(Object.freeze({ relativePath, bytes: stat.size, sha256 }));
  }
  return verified;
}
async function commitExport({ stagingRoot, destinationRoot, artifacts }) {
  const validated = await validateArtifacts(stagingRoot, artifacts);
  const target = path.resolve(destinationRoot);
  const parent = path.dirname(target);
  safeRelative(path.basename(target));
  const stagingParent = await fs.realpath(path.dirname(path.resolve(stagingRoot)));
  await fs.mkdir(parent, { recursive: true });
  const realParent = await fs.realpath(parent);
  if (stagingParent !== realParent) throw Error('Export requires sibling staging on the same volume');
  if (path.resolve(stagingRoot) === target) throw Error('Invalid export destination');
  // Exclusive cross-process reservation, held until rename completes. Never rename
  // into a pre-created target directory, especially on Windows.
  const reservation = path.join(realParent, '.' + path.basename(target) + '.ditasha-lock');
  const lock = await fs.open(reservation, 'wx', 0o600).catch(error => {
    if (error.code === 'EEXIST') throw Error('Export destination reserved by another build');
    throw error;
  });
  try {
    try {
      await fs.lstat(target);
      throw Error('Export destination already exists');
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    await fs.rename(stagingRoot, target);
    return { output: target, artifacts: validated };
  } finally {
    await lock.close();
    await fs.rm(reservation, { force: true });
  }
}
module.exports = { safeRelative, validateArtifacts, commitExport };
