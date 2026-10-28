import { validateActorMotion } from './booth-actors.js';
export function validateBoothScene(record) {
  if (
    record?.version !== 1 ||
    !Array.isArray(record.assets) ||
    !record.assets.length ||
    record.assets.length > 20 ||
    !Array.isArray(record.textureFiles) ||
    !Array.isArray(record.clipFiles)
  )
    throw Error('Preset Photo Booth tidak valid.');
  let bytes = 0;
  const file = (f, max) => {
    if (
      !f ||
      typeof f.arrayBuffer !== 'function' ||
      typeof f.name !== 'string' ||
      !Number.isSafeInteger(f.size) ||
      f.size < 0 ||
      f.size > max
    )
      throw Error('File preset tidak valid / terlalu besar.');
    bytes += f.size;
  };
  for (const a of record.assets) {
    file(a.file, 64 * 1024 ** 2);
    if (
      !/\.(glb|ydd|ydr|yft)$/i.test(a.file.name) ||
      !['ped', 'clothing', 'accessory'].includes(a.kind) ||
      !Array.isArray(a.offset) ||
      a.offset.length !== 3 ||
      !a.offset.every((n) => Number.isFinite(n) && Math.abs(n) <= 100) ||
      !Number.isFinite(a.scale) ||
      a.scale <= 0 ||
      a.scale > 100 ||
      !Number.isFinite(a.yaw) ||
      Math.abs(a.yaw) > 360
    )
      throw Error('Penempatan ped tidak valid.');
    validateActorMotion(a.motion);
    if (
      typeof a.motion.clip !== 'string' ||
      a.motion.clip.length > 256 ||
      !Array.isArray(a.hiddenSlots) ||
      a.hiddenSlots.length > 64 ||
      !a.hiddenSlots.every((s) => typeof s === 'string' && s.length <= 64) ||
      !Number.isSafeInteger(a.oldId)
    )
      throw Error('Metadata preset tidak valid.');
    if (
      a.ownerIndex !== null &&
      (!Number.isInteger(a.ownerIndex) ||
        record.assets[a.ownerIndex]?.kind !== 'ped' ||
        a.ownerIndex === record.assets.indexOf(a))
    )
      throw Error('Pemilik outfit tidak valid.');
  }
  if (record.textureFiles.length > 200 || record.clipFiles.length > 100)
    throw Error('Terlalu banyak file dalam preset.');
  if (
    record.textureOwners &&
    (!Array.isArray(record.textureOwners) ||
      record.textureOwners.length !== record.textureFiles.length ||
      record.textureOwners.some((i) => i !== null && (!Number.isInteger(i) || !record.assets[i])))
  )
    throw Error('Pemilik tekstur preset tidak valid.');
  for (const f of record.textureFiles) {
    file(f, 256 * 1024 ** 2);
    if (!/\.(ytd|dds|png|jpg|jpeg|webp)$/i.test(f.name)) throw Error('Tekstur preset tidak valid.');
  }
  for (const c of record.clipFiles) {
    file(c.file, 64 * 1024 ** 2);
    if (!/\.glb$/i.test(c.file.name) || !/^external:\d+$/.test(c.prefix))
      throw Error('Clip preset tidak valid.');
  }
  if (bytes > 512 * 1024 ** 2) throw Error('Preset library maksimal 512 MB.');
  return record;
}
export function createBoothLibrary(provider = globalThis.indexedDB) {
  let dbPromise;
  async function db() {
    if (!provider) throw Error('Penyimpanan library tidak tersedia.');
    return (dbPromise ||= new Promise((resolve, reject) => {
      const req = provider.open('ditasha-photo-booth-library', 1);
      req.onupgradeneeded = () => req.result.createObjectStore('scenes', { keyPath: 'id' });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => {
        dbPromise = null;
        reject(Error(req.error?.message || 'Library tidak dapat dibuka.'));
      };
      req.onblocked = () => {
        dbPromise = null;
        reject(Error('Tutup jendela DITASHA lain lalu coba lagi.'));
      };
    }));
  }
  async function transaction(mode, fn) {
    const database = await db();
    return new Promise((resolve, reject) => {
      const tx = database.transaction('scenes', mode);
      let req;
      try {
        req = fn(tx.objectStore('scenes'));
      } catch (e) {
        reject(e);
        return;
      }
      tx.oncomplete = () => resolve(req.result);
      tx.onabort = tx.onerror = () =>
        reject(
          Error(tx.error?.message || 'Penyimpanan library gagal. Ruang penyimpanan mungkin penuh.'),
        );
    });
  }
  return {
    async list() {
      const rows = await transaction('readonly', (s) => s.getAll());
      return rows
        .map(({ id, name, updated, thumbnail }) => ({ id, name, updated, thumbnail }))
        .sort((a, b) => b.updated - a.updated);
    },
    async save(record) {
      validateBoothScene(record);
      const saved = {
        ...record,
        id: record.id || crypto.randomUUID(),
        name: String(record.name || 'Sesi Photo Booth')
          .trim()
          .slice(0, 80),
        updated: Date.now(),
      };
      await transaction('readwrite', (s) => s.put(saved));
      return saved.id;
    },
    async get(id) {
      const record = await transaction('readonly', (s) => s.get(id));
      return validateBoothScene(record);
    },
    async remove(id) {
      return transaction('readwrite', (s) => s.delete(id));
    },
  };
}
