'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { INPUT_FORMATS } = require('./prop-schema.cjs');

function assertAllowedKind(kind) {
  if (kind !== 'input' && kind !== 'output') throw Error('Invalid asset grant kind');
}
async function checkedPath(file, kind, maxInputBytes) {
  if (typeof file !== 'string' || !path.isAbsolute(file) || file.includes('\0'))
    throw Error('Asset path must be absolute');
  const real = await fs.realpath(file);
  const info = await fs.lstat(real);
  if (kind === 'input') {
    if (!info.isFile() || info.size < 1 || info.size > maxInputBytes)
      throw Error('Asset input must be a bounded regular file');
    if (!INPUT_FORMATS.includes(path.extname(real).slice(1).toLowerCase()))
      throw Error('Unsupported input extension');
  } else if (!info.isDirectory()) throw Error('Output grant must be a directory');
  // Existing symlink ancestors resolve only once, at issuance. Every later
  // resolution rechecks the same canonical path and inode identity.
  return { path: real, size: kind === 'input' ? info.size : 0, dev: info.dev, ino: info.ino };
}
function createAssetTokens({
  ttlMs = 10 * 60 * 1000, maxGrants = 64, maxInputBytes = 256 * 1024 * 1024,
  now = Date.now,
} = {}) {
  if (!Number.isSafeInteger(ttlMs) || ttlMs < 1000 || ttlMs > 24 * 60 * 60 * 1000) throw Error('Invalid token TTL');
  if (!Number.isSafeInteger(maxGrants) || maxGrants < 1 || maxGrants > 1024) throw Error('Invalid token limit');
  if (!Number.isSafeInteger(maxInputBytes) || maxInputBytes < 1 || maxInputBytes > 2 * 1024 ** 3) throw Error('Invalid asset byte limit');
  const grants = new Map();
  function sweep() {
    for (const [token, item] of grants) if (now() >= item.expiresAt) grants.delete(token);
  }
  async function issue({ kind, selectedPath }) {
    assertAllowedKind(kind);
    sweep();
    if (grants.size >= maxGrants) throw Error('Too many active asset grants');
    const verified = await checkedPath(selectedPath, kind, maxInputBytes);
    const token = randomUUID();
    grants.set(token, { ...verified, kind, expiresAt: now() + ttlMs });
    return Object.freeze({ token, kind, name: path.basename(verified.path), expiresAt: now() + ttlMs });
  }
  async function resolve(token, kind) {
    assertAllowedKind(kind);
    sweep();
    if (typeof token !== 'string' || !/^[a-f0-9-]{36}$/i.test(token)) throw Error('Invalid asset token');
    const grant = grants.get(token);
    if (!grant || grant.kind !== kind) throw Error('Expired or unauthorized asset token');
    const current = await checkedPath(grant.path, kind, maxInputBytes).catch(() => null);
    if (!current || current.path !== grant.path || current.dev !== grant.dev || current.ino !== grant.ino) {
      grants.delete(token);
      throw Error('Asset grant changed or disappeared');
    }
    return Object.freeze({ kind, path: grant.path, size: current.size });
  }
  function revoke(token) { return grants.delete(token); }
  function clear() { grants.clear(); }
  function size() { sweep(); return grants.size; }
  return Object.freeze({ issue, resolve, revoke, clear, size });
}
module.exports = { createAssetTokens };
