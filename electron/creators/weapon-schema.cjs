'use strict';

const path = require('node:path');
const fs = require('node:fs/promises');
const { randomUUID } = require('node:crypto');

const WEAPON_REFERENCES = Object.freeze({
  WEAPON_PISTOL: 'w_pi_pistol',
  WEAPON_COMBATPISTOL: 'w_pi_combatpistol',
  WEAPON_APPISTOL: 'w_pi_appistol',
  WEAPON_MICROSMG: 'w_sb_microsmg',
  WEAPON_SMG: 'w_sb_smg',
  WEAPON_CARBINERIFLE: 'w_ar_carbinerifle',
  WEAPON_ASSAULTRIFLE: 'w_ar_assaultrifle',
  WEAPON_PUMPSHOTGUN: 'w_sg_pumpshotgun',
});
const MAX_SOURCE_FILES = 96;
const MAX_SOURCE_BYTES = 384 * 1024 * 1024;
const MAX_FILE_BYTES = 128 * 1024 * 1024;

function validateWeaponBuildRequest(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).some(k => !['schemaVersion','sourceToken','outputToken','reference','name','modelName','price','edition'].includes(k)))
    throw Error('Unsupported weapon build settings');
  if (value.schemaVersion !== 1 || value.edition !== 'legacy')
    throw Error('M2c supports GTA V Legacy only');
  if (!Object.hasOwn(WEAPON_REFERENCES, value.reference))
    throw Error('Unsupported weapon template reference');
  for (const key of ['sourceToken','outputToken']) {
    if (typeof value[key] !== 'string' || !/^[a-f0-9-]{36}$/i.test(value[key])) throw Error('Invalid ' + key);
  }
  if (typeof value.name !== 'string' || value.name.length < 3 || value.name.length > 48 ||
      !/^[A-Za-z0-9 _-]+$/.test(value.name) || value.name.trim().length < 3)
    throw Error('Invalid weapon display name');
  if (typeof value.modelName !== 'string' || !/^w_(pi|sb|ar|sg)_[a-z][a-z0-9_]{2,40}$/.test(value.modelName))
    throw Error('Invalid weapon native model name');
  if (!Number.isSafeInteger(value.price) || value.price < 0 || value.price > 10000000)
    throw Error('Invalid weapon price');
  return Object.freeze({ schemaVersion: 1, edition: 'legacy', sourceToken: value.sourceToken,
    outputToken: value.outputToken, reference: value.reference,
    name: value.name.trim(), modelName: value.modelName, price: value.price });
}

async function inspectWeaponSource(folder, reference) {
  if (!Object.hasOwn(WEAPON_REFERENCES, reference)) throw Error('Unsupported weapon reference');
  const resolved = await fs.realpath(folder);
  if (!(await fs.stat(resolved)).isDirectory()) throw Error('Weapon source must be a directory');
  const entries = await fs.readdir(resolved, { withFileTypes: true });
  if (entries.length > MAX_SOURCE_FILES) throw Error('Too many weapon source files');
  const files = new Map();
  let total = 0;
  for (const entry of entries) {
    if (!entry.isFile() || entry.isSymbolicLink()) throw Error('Weapon source must contain only regular files (no links or subfolders)');
    if (!/^[a-z0-9_. -]{1,128}$/i.test(entry.name)) throw Error('Unsafe weapon source filename');
    if (!/\.(ydr|ytd|meta|xml|txt)$/i.test(entry.name))
      throw Error('Unsupported file in weapon source directory: ' + entry.name);
    const lower = entry.name.toLowerCase();
    if (files.has(lower)) throw Error('Case-colliding weapon source files');
    const stat = await fs.stat(path.join(resolved,entry.name));
    if (stat.size < 1 || stat.size > MAX_FILE_BYTES) throw Error('Weapon source file missing or too large');
    total += stat.size;
    if (total > MAX_SOURCE_BYTES) throw Error('Weapon source directory exceeds byte limit');
    files.set(lower, entry.name);
  }
  const stem = WEAPON_REFERENCES[reference];
  const ydr = files.get(stem + '.ydr');
  const ytd = files.get(stem + '.ytd');
  if (!ydr || !ytd) throw Error('Source must contain matching original ' + stem + '.ydr and ' + stem + '.ytd');
  for (const name of [ydr,ytd]) {
    const handle = await fs.open(path.join(resolved,name),'r');
    const buffer = Buffer.alloc(8);
    try { await handle.read(buffer,0,8,0); } finally { await handle.close(); }
    if (buffer.toString('ascii',0,4) !== 'RSC7' || buffer.readUInt32LE(4) !== 13)
      throw Error('Weapon YDR/YTD is not GTA V Legacy native RSC7: ' + name);
  }
  return Object.freeze({ folder: resolved, model: stem, ydr: path.join(resolved,ydr),
    ytd: path.join(resolved,ytd), totalBytes: total, fileCount: files.size });
}

function createWeaponFolderGrants({ now=Date.now, ttlMs=20*60*1000 }={}) {
  const grants = new Map();
  async function issue(kind, selectedPath) {
    if (!['source','output'].includes(kind)) throw Error('Invalid weapon grant kind');
    if (typeof selectedPath !== 'string' || !path.isAbsolute(selectedPath)) throw Error('Expected absolute directory');
    const canonical = await fs.realpath(selectedPath);
    const stat = await fs.lstat(canonical);
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw Error('Weapon grant must be an actual directory');
    if (grants.size >= 24) throw Error('Too many weapon grants');
    const token=randomUUID();
    grants.set(token,{ kind, path:canonical, dev:stat.dev, ino:stat.ino, expires:now()+ttlMs });
    return Object.freeze({ token, kind, name:path.basename(canonical) });
  }
  async function resolve(token,kind) {
    if (typeof token !== 'string' || !/^[a-f0-9-]{36}$/i.test(token)) throw Error('Invalid weapon grant token');
    const grant=grants.get(token);
    if (!grant || grant.kind!==kind || now()>=grant.expires) throw Error('Weapon directory permission expired');
    const canonical=await fs.realpath(grant.path).catch(()=>null);
    if (!canonical || canonical!==grant.path) throw Error('Weapon granted directory has changed');
    const stat=await fs.lstat(canonical);
    if (!stat.isDirectory() || stat.isSymbolicLink() || stat.dev!==grant.dev || stat.ino!==grant.ino)
      throw Error('Weapon granted directory has changed');
    return grant.path;
  }
  function revoke(token) { return grants.delete(token); }
  function clear() { grants.clear(); }
  return Object.freeze({ issue, resolve, revoke, clear });
}
module.exports={WEAPON_REFERENCES,validateWeaponBuildRequest,inspectWeaponSource,createWeaponFolderGrants};
