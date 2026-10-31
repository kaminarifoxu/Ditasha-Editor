'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

const EXTENSIONS = new Set(['.ydd', '.ytd', '.ymt', '.yld', '.meta', '.png', '.jpg', '.jpeg', '.webp']);
const COMPONENTS = new Set(['head', 'berd', 'hair', 'uppr', 'lowr', 'hand', 'feet', 'teef', 'accs', 'task', 'decl', 'jbib', 'p_head', 'p_eyes', 'p_ears', 'p_lwrist', 'p_rwrist']);
const MAX_FILE_BYTES = 256 * 1024 * 1024;
const MAX_IMPORT_FILES = 5000;
function metadataFor(filename) {
  const basename = path.basename(filename);
  const gender = /mp_m_freemode_01/i.test(filename) ? 'male' : /mp_f_freemode_01/i.test(filename) ? 'female' : 'unknown';
  // GTA textures are named jbib_diff_003_a_uni.ytd, models jbib_003_u.ydd.
  const match = basename.match(/(?:\^|^)((?:p_)?[a-z]+)_(diff_)?(\d{3})(?:_|\.)(?:.*)?$/i);
  const component = match?.[1]?.toLowerCase() || 'unknown';
  const textureVariant = match?.[2]
    ? basename.match(/_diff_\d{3}_([a-z])(?:_|\.|$)/i)?.[1]?.toLowerCase() || null
    : null;
  return {
    gender,
    component: COMPONENTS.has(component) ? component : 'unknown',
    drawable: match ? Number(match[3]) : null,
    textureVariant,
  };
}
function safeLabel(value, fallback) {
  const label = String(value || fallback).trim().replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').slice(0, 96);
  return label || fallback;
}
function ensureInside(root, file) {
  const resolved = path.resolve(root, file);
  if (!resolved.startsWith(path.resolve(root) + path.sep)) throw new Error('Unsafe asset path');
  return resolved;
}
class ClothingLibrary {
  constructor(root) { this.root = path.resolve(root); }
  async list() {
    const file = path.join(this.root, 'index.json');
    try {
      const data = JSON.parse(await fs.readFile(file, 'utf8'));
      if (!Array.isArray(data.items)) throw new Error('Invalid library index');
      return data.items;
    } catch (error) {
      if (error.code === 'ENOENT') return [];
      throw error;
    }
  }
  async importFiles({ pack = 'My Custom Pack', files }) {
    if (!Array.isArray(files) || !files.length || files.length > MAX_IMPORT_FILES) throw new Error('Invalid number of files');
    const index = await this.list();
    const uniqueSources = [...new Set(files.map(file => path.resolve(file)))];
    if (uniqueSources.length !== files.length) throw new Error('Duplicate source files');
    const id = crypto.randomUUID();
    const dir = path.join(this.root, 'packs', id);
    await fs.mkdir(dir, { recursive: true });
    const records = [];
    try {
      for (const source of files) {
        const stat = await fs.stat(source);
        const ext = path.extname(source).toLowerCase();
        if (!stat.isFile() || !EXTENSIONS.has(ext) || stat.size > MAX_FILE_BYTES) throw new Error('Unsupported or oversized file: ' + path.basename(source));
        const name = path.basename(source);
        const hash = crypto.createHash('sha256').update(path.resolve(source)).digest('hex').slice(0, 12);
        const destName = hash + '-' + name;
        const destination = ensureInside(dir, destName);
        await fs.copyFile(source, destination);
        records.push({ name, relativePath: path.posix.join('packs', id, destName), bytes: stat.size, ...metadataFor(source) });
      }
      const item = { id, pack: safeLabel(pack, 'My Custom Pack'), createdAt: new Date().toISOString(), files: records };
      if (!records.some(file => /\.ydd$/i.test(file.name))) throw new Error('Import requires at least one YDD model');
      index.push(item);
      await this.writeIndex(index);
      return item;
    } catch (error) {
      await fs.rm(dir, { recursive: true, force: true });
      throw error;
    }
  }
  async writeIndex(items) {
    await fs.mkdir(this.root, { recursive: true });
    const target = path.join(this.root, 'index.json');
    const temp = target + '.' + crypto.randomUUID() + '.tmp';
    await fs.writeFile(temp, JSON.stringify({ version: 1, items }, null, 2), 'utf8');
    await fs.rename(temp, target);
  }
  async importDirectory({ pack = 'My Custom Pack', directory }) {
    if (typeof directory !== 'string' || !directory.trim()) throw new Error('Invalid directory');
    const root = path.resolve(directory);
    const sources = [];
    const pending = [root];
    let scanned = 0;
    while (pending.length) {
      const dir = pending.pop();
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (++scanned > MAX_IMPORT_FILES * 4) throw new Error('Too many files in directory');
        if (entry.isSymbolicLink()) continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) pending.push(full);
        else if (entry.isFile() && EXTENSIONS.has(path.extname(entry.name).toLowerCase())) sources.push(full);
        if (sources.length > MAX_IMPORT_FILES) throw new Error('Too many clothing files');
      }
    }
    return this.importFiles({ pack, files: sources });
  }
  async readAsset(packId, relativePath) {
    if (!/^[0-9a-f-]{36}$/i.test(packId)) throw new Error('Invalid pack ID');
    const packs = await this.list();
    const pack = packs.find(item => item.id === packId);
    const file = pack?.files.find(item => item.relativePath === relativePath);
    if (!file) throw new Error('Asset not found');
    if (!/\.(ydd|ytd)$/i.test(file.name)) throw new Error('Asset cannot be previewed');
    if (file.bytes > 64 * 1024 * 1024 && !/\.ytd$/i.test(file.name)) throw new Error('Preview model too large');
    return { name: file.name, bytes: await fs.readFile(ensureInside(this.root, file.relativePath)) };
  }
  async listOutfits() {
    const file = path.join(this.root, 'outfits.json');
    try {
      const data = JSON.parse(await fs.readFile(file, 'utf8'));
      if (!Array.isArray(data.items)) throw new Error('Invalid outfits index');
      return data.items;
    } catch (error) {
      if (error.code === 'ENOENT') return [];
      throw error;
    }
  }
  async saveOutfit({ name, gender, slots }) {
    if (typeof name !== 'string' || !name.trim() || name.length > 96)
      throw new Error('Invalid outfit name');
    if (!['male', 'female'].includes(gender)) throw new Error('Invalid gender');
    if (!Array.isArray(slots) || slots.length === 0 || slots.length > 16)
      throw new Error('Invalid outfit slots');
    const packs = await this.list();
    const seen = new Set();
    const normalized = [];
    for (const slot of slots) {
      if (!slot || !/^[0-9a-f-]{36}$/i.test(slot.packId) || typeof slot.relativePath !== 'string')
        throw new Error('Invalid outfit reference');
      const pack = packs.find(p => p.id === slot.packId);
      const file = pack?.files.find(f => f.relativePath === slot.relativePath && /\.ydd$/i.test(f.name));
      if (!file || !COMPONENTS.has(file.component) || (file.gender !== 'unknown' && file.gender !== gender))
        throw new Error('Missing or incompatible outfit model');
      if (seen.has(file.component)) throw new Error('Duplicate outfit component');
      seen.add(file.component);
      const variant = slot.textureVariant === null || slot.textureVariant === undefined
        ? null : String(slot.textureVariant).toLowerCase();
      if (variant !== null && !/^[a-z]$/.test(variant))
        throw new Error('Invalid texture variant');
      if (variant !== null && !pack.files.some(f => /\.ytd$/i.test(f.name) &&
        f.component === file.component && f.drawable === file.drawable && f.textureVariant === variant))
        throw new Error('Texture variant missing');
      normalized.push({ packId: slot.packId, relativePath: file.relativePath, component: file.component, textureVariant: variant });
    }
    const items = await this.listOutfits();
    const outfit = { id: crypto.randomUUID(), name: safeLabel(name, 'Outfit'), gender, slots: normalized, createdAt: new Date().toISOString() };
    items.push(outfit);
    await this.writeOutfits(items);
    return outfit;
  }
  async writeOutfits(items) {
    await fs.mkdir(this.root, { recursive: true });
    const target = path.join(this.root, 'outfits.json');
    const temp = target + '.' + crypto.randomUUID() + '.tmp';
    await fs.writeFile(temp, JSON.stringify({ version: 1, items }, null, 2), 'utf8');
    await fs.rename(temp, target);
  }
  async removeOutfit(id) {
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error('Invalid outfit ID');
    const items = await this.listOutfits();
    const next = items.filter(item => item.id !== id);
    if (next.length === items.length) return false;
    await this.writeOutfits(next);
    return true;
  }
  async rename(id, label) {
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error('Invalid ID');
    if (typeof label !== 'string' || !label.trim() || label.length > 96)
      throw new Error('Invalid pack name');
    const items = await this.list();
    const item = items.find(pack => pack.id === id);
    if (!item) throw new Error('Pack not found');
    item.pack = safeLabel(label, 'My Custom Pack');
    await this.writeIndex(items);
    return { id, pack: item.pack };
  }
  async remove(id) {
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error('Invalid ID');
    const items = await this.list();
    const next = items.filter(item => item.id !== id);
    if (next.length === items.length) return false;
    const dependent = (await this.listOutfits()).find(outfit => outfit.slots.some(slot => slot.packId === id));
    if (dependent) throw new Error('Pack is used by saved outfit: ' + dependent.name + '. Remove the outfit first.');
    await this.writeIndex(next);
    await fs.rm(path.join(this.root, 'packs', id), { recursive: true, force: true });
    return true;
  }
}
module.exports = { ClothingLibrary, metadataFor };
