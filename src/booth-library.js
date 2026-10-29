import { BOOTH_STUDIOS } from './booth-studio.js';
import { MAX_BOOTH_MODELS, OUTFIT_CATEGORIES } from './booth-outfits.js';
import { validateActorMotion } from './booth-actors.js';
export function validateBoothScene(record) {
  if (
    record?.version !== 1 ||
    !Array.isArray(record.assets) ||
    !record.assets.length ||
    record.assets.length > MAX_BOOTH_MODELS ||
    !Array.isArray(record.textureFiles) ||
    !Array.isArray(record.clipFiles)
  )
    throw Error('Preset Photo Booth tidak valid.');
  if (record.studio !== undefined) {
    const s = record.studio;
    if (
      !s ||
      (!BOOTH_STUDIOS.some(([id]) => id === s.id) &&
        !/^custom:[a-z0-9-]{1,80}:\d{1,4}$/.test(s.id)) ||
      !/^#[0-9a-f]{6}$/i.test(s.background) ||
      !Number.isFinite(s.light) ||
      s.light < 0.3 ||
      s.light > 3 ||
      typeof s.transparent !== 'boolean' ||
      typeof s.floor !== 'boolean' ||
      !['1080x1350', '1920x1080', '2048x2048', '3000x4000', '4000x3000', '3000x3000'].includes(
        s.size,
      ) ||
      (s.shadows !== undefined && typeof s.shadows !== 'boolean') ||
      (s.shadowStrength !== undefined &&
        (!Number.isFinite(s.shadowStrength) || s.shadowStrength < 0 || s.shadowStrength > 1)) ||
      (s.shadowAngle !== undefined &&
        (!Number.isFinite(s.shadowAngle) || s.shadowAngle < 0 || s.shadowAngle > 360))
    )
      throw Error('Pengaturan studio preset tidak valid.');
  }
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
  if (record.studio?.packs !== undefined) {
    const packs = record.studio.packs;
    if (!Array.isArray(packs) || packs.length > 16) throw Error('Paket studio tidak valid.');
    let count = 0;
    const ids = new Set();
    for (const pack of packs) {
      if (
        !pack ||
        !/^[-a-z0-9]{1,80}$/.test(pack.id) ||
        ids.has(pack.id) ||
        typeof pack.label !== 'string' ||
        pack.label.length > 80 ||
        !Array.isArray(pack.files) ||
        !pack.files.length
      )
        throw Error('Paket studio tidak valid.');
      ids.add(pack.id);
      for (const f of pack.files) {
        file(f, /\.ytd$/i.test(f?.name || '') ? 256 * 1024 ** 2 : 64 * 1024 ** 2);
        if (!/\.(ymap|ytyp|ydr|ydd|ytd)$/i.test(f.name) || ++count > 2000)
          throw Error('File studio tidak valid.');
      }
    }
    if (record.studio.id.startsWith('custom:') && !ids.has(record.studio.id.split(':')[1]))
      throw Error('Sumber studio preset hilang.');
  } else if (record.studio?.id.startsWith('custom:')) throw Error('Sumber studio preset hilang.');
  for (const [key, max] of [
    ['studioY', 50],
    ['studioYaw', 360],
  ])
    if (
      record.studio?.[key] !== undefined &&
      (!Number.isFinite(record.studio[key]) || Math.abs(record.studio[key]) > max)
    )
      throw Error('Penempatan studio tidak valid.');
  if (record.studio?.cutaway !== undefined && typeof record.studio.cutaway !== 'boolean')
    throw Error('Cutaway studio tidak valid.');
  for (const a of record.assets) {
    file(a.file, 64 * 1024 ** 2);
    if (
      !/\.(glb|ydd|ydr|yft)$/i.test(a.file.name) ||
      !['ped', 'vehicle', 'vehicle-part', 'clothing', 'accessory'].includes(a.kind) ||
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
    if (
      a.category !== undefined &&
      a.category !== 'ped' &&
      a.category !== 'vehicle' &&
      a.category !== 'vehicle-part' &&
      !OUTFIT_CATEGORIES.some(([id]) => id === a.category)
    )
      throw Error('Kategori preset tidak valid.');
    if (
      a.rigChoice !== undefined &&
      !['auto', 'reference', 'freemode-male', 'freemode-female'].includes(a.rigChoice)
    )
      throw Error('Acuan skeleton tidak valid.');
    if (a.referenceOnly !== undefined && typeof a.referenceOnly !== 'boolean')
      throw Error('Acuan skeleton tidak valid.');
    if (
      a.targetHeightCm != null &&
      (!Number.isFinite(a.targetHeightCm) || a.targetHeightCm < 1 || a.targetHeightCm > 1000)
    )
      throw Error('Tinggi preset tidak valid.');
    if (
      a.textureOverride !== undefined &&
      (typeof a.textureOverride !== 'string' || a.textureOverride.length > 2048)
    )
      throw Error('Penggantian tekstur tidak valid.');
    if (a.matte !== undefined && typeof a.matte !== 'boolean')
      throw Error('Matte preset tidak valid.');
    if (a.label !== undefined && (typeof a.label !== 'string' || a.label.length > 60))
      throw Error('Nama grup tidak valid.');
    if (a.groupCollapsed !== undefined && typeof a.groupCollapsed !== 'boolean')
      throw Error('Status grup tidak valid.');
    if (a.grip !== undefined && typeof a.grip !== 'boolean') throw Error('Grip prop tidak valid.');
    for (const key of ['pitch', 'roll'])
      if (a[key] !== undefined && (!Number.isFinite(a[key]) || Math.abs(a[key]) > 360))
        throw Error('Rotasi prop tidak valid.');
    if (
      a.vehicleOffBones !== undefined &&
      (!Array.isArray(a.vehicleOffBones) ||
        a.vehicleOffBones.length > 64 ||
        !a.vehicleOffBones.every((n) => typeof n === 'string' && n.length <= 128))
    )
      throw Error('Bone part kendaraan tidak valid.');
    for (const k of ['vehicleModel', 'vehicleSlot', 'vehicleBone'])
      if (a[k] !== undefined && (typeof a[k] !== 'string' || a[k].length > 128))
        throw Error('Metadata part kendaraan tidak valid.');
    if (a.vehicleAlt !== undefined && typeof a.vehicleAlt !== 'boolean')
      throw Error('LOD kendaraan tidak valid.');
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
        record.assets[a.ownerIndex]?.kind !== (a.kind === 'vehicle-part' ? 'vehicle' : 'ped') ||
        a.ownerIndex === record.assets.indexOf(a))
    )
      throw Error('Pemilik outfit tidak valid.');
  }
  if (record.textureFiles.length > 1000 || record.clipFiles.length > 2000)
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
    if (!/\.(glb|ycd)$/i.test(c.file.name) || !/^external:\d+$/.test(c.prefix))
      throw Error('Clip preset tidak valid.');
  }
  if (bytes > 512 * 1024 ** 2) throw Error('Preset library maksimal 512 MB.');
  return record;
}
// Store typed binary chunks instead of Chromium disk-backed Blob references.
const CHUNK_BYTES = 1024 * 1024;
function mapSourceFiles(record, fn) {
  return {
    ...record,
    assets: record.assets.map((a) => ({ ...a, file: fn(a.file) })),
    textureFiles: record.textureFiles.map(fn),
    clipFiles: record.clipFiles.map((c) => ({ ...c, file: fn(c.file) })),
    ...(record.studio
      ? {
          studio: {
            ...record.studio,
            ...(record.studio.packs
              ? { packs: record.studio.packs.map((p) => ({ ...p, files: p.files.map(fn) })) }
              : {}),
          },
        }
      : {}),
  };
}
export function createBoothLibrary(provider = globalThis.indexedDB) {
  let dbPromise;
  async function db() {
    if (!provider) throw Error('Penyimpanan library tidak tersedia.');
    return (dbPromise ||= new Promise((resolve, reject) => {
      const req = provider.open('ditasha-photo-booth-library', 2);
      req.onupgradeneeded = () => {
        const database = req.result;
        if (!database.objectStoreNames.contains('scenes'))
          database.createObjectStore('scenes', { keyPath: 'id' });
        if (!database.objectStoreNames.contains('sourceChunks'))
          database
            .createObjectStore('sourceChunks', { keyPath: ['bundle', 'file', 'part'] })
            .createIndex('bundle', 'bundle');
      };
      req.onsuccess = () => {
        req.result.onversionchange = () => {
          req.result.close();
          dbPromise = null;
        };
        resolve(req.result);
      };
      req.onerror = () => {
        dbPromise = null;
        reject(req.error || Error('Library tidak dapat dibuka.'));
      };
      req.onblocked = () => {
        dbPromise = null;
        reject(Error('Tutup jendela DITASHA lain lalu coba lagi.'));
      };
    }));
  }
  async function transaction(store, mode, fn) {
    const database = await db();
    return new Promise((resolve, reject) => {
      const tx = database.transaction(store, mode);
      let req, failure;
      tx.oncomplete = () => resolve(req?.result);
      tx.onabort = tx.onerror = () =>
        reject(failure || tx.error || req?.error || Error('Penyimpanan library gagal.'));
      try {
        req = fn(tx.objectStore(store));
      } catch (e) {
        failure = e;
        try {
          tx.abort();
        } catch {
          reject(e);
        }
      }
    });
  }
  async function discard(bundle) {
    if (!bundle) return;
    await transaction('sourceChunks', 'readwrite', (s) => {
      const req = s.index('bundle').openCursor(bundle);
      req.onsuccess = () => {
        const cursor = req.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };
      return req;
    });
  }
  async function hydrate(record) {
    if (!record?._binary) return validateBoothScene(record); // Existing v1 Blob presets.
    const { version, bundle, files } = record._binary;
    if (version !== 1 || typeof bundle !== 'string' || !Array.isArray(files) || files.length > 5100)
      throw Error('Data sumber preset tidak valid.');
    let total = 0;
    for (const f of files) {
      if (
        !f ||
        typeof f.name !== 'string' ||
        typeof f.type !== 'string' ||
        !Number.isSafeInteger(f.size) ||
        f.size < 0 ||
        f.size > 256 * 1024 ** 2 ||
        f.parts !== Math.ceil(f.size / CHUNK_BYTES) ||
        (total += f.size) > 512 * 1024 ** 2
      )
        throw Error('Data sumber preset tidak valid.');
    }
    const restored = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i],
        parts = [];
      for (let part = 0; part < f.parts; part++) {
        const chunk = await transaction('sourceChunks', 'readonly', (s) =>
          s.get([bundle, i, part]),
        );
        if (
          !(chunk?.bytes instanceof ArrayBuffer) ||
          chunk.bytes.byteLength !== Math.min(CHUNK_BYTES, f.size - part * CHUNK_BYTES)
        )
          throw Error(f.name + ': data preset tidak lengkap. Preset tidak dihapus.');
        parts.push(chunk.bytes);
      }
      restored.push(new File(parts, f.name, { type: f.type, lastModified: f.lastModified }));
    }
    const decoded = mapSourceFiles(record, (ref) => {
      if (!Number.isInteger(ref?.$boothFile) || !restored[ref.$boothFile])
        throw Error('Referensi sumber preset tidak valid.');
      return restored[ref.$boothFile];
    });
    delete decoded._binary;
    return validateBoothScene(decoded);
  }
  return {
    async list() {
      const rows = await transaction('scenes', 'readonly', (s) => s.getAll());
      return rows
        .map(({ id, name, updated, thumbnail }) => ({ id, name, updated, thumbnail }))
        .sort((a, b) => b.updated - a.updated);
    },
    async save(record, onProgress = () => {}) {
      validateBoothScene(record);
      const bundle = crypto.randomUUID(),
        sources = [],
        indices = new Map();
      const saved = mapSourceFiles(
        {
          ...record,
          id: record.id || crypto.randomUUID(),
          name: String(record.name || 'Sesi Photo Booth')
            .trim()
            .slice(0, 80),
          updated: Date.now(),
        },
        (file) => {
          if (!indices.has(file)) {
            indices.set(file, sources.length);
            sources.push(file);
          }
          return { $boothFile: indices.get(file) };
        },
      );
      const files = [];
      const totalBytes = sources.reduce((n, f) => n + f.size, 0);
      let completedBytes = 0;
      try {
        for (let i = 0; i < sources.length; i++) {
          const f = sources[i];
          files.push({
            name: f.name,
            type: f.type || '',
            size: f.size,
            lastModified: f.lastModified || 0,
            parts: Math.ceil(f.size / CHUNK_BYTES),
          });
          for (let part = 0; part < files[i].parts; part++) {
            let bytes;
            try {
              bytes = await f.slice(part * CHUNK_BYTES, (part + 1) * CHUNK_BYTES).arrayBuffer();
            } catch {
              throw Error(
                f.name +
                  ': file sumber tidak dapat dibaca. Masukkan ulang file tersebut lalu simpan lagi.',
              );
            }
            if (bytes.byteLength !== Math.min(CHUNK_BYTES, f.size - part * CHUNK_BYTES))
              throw Error(f.name + ': pembacaan file sumber tidak lengkap.');
            await transaction('sourceChunks', 'readwrite', (s) =>
              s.put({ bundle, file: i, part, bytes }),
            );
            completedBytes += bytes.byteLength;
            onProgress(completedBytes, totalBytes);
          }
        }
        saved._binary = { version: 1, bundle, files };
        const previous = await transaction('scenes', 'readonly', (s) => s.get(saved.id));
        // Publish metadata only after every source chunk has committed. A failed save
        // never replaces the previously visible preset.
        await transaction('scenes', 'readwrite', (s) => s.put(saved));
        if (previous?._binary?.bundle) await discard(previous._binary.bundle).catch(() => {});
        return saved.id;
      } catch (error) {
        await discard(bundle).catch(() => {});
        if (
          error.name === 'QuotaExceededError' ||
          /IOError|Failed to write|disk|quota/i.test(error.message)
        )
          throw Error(
            'Preset belum tersimpan: penyimpanan lokal gagal. Periksa ruang kosong drive sistem dan izin folder data DITASHA, lalu coba lagi. Scene aktif dan preset sebelumnya tetap utuh.',
          );
        throw error;
      }
    },
    async get(id) {
      return hydrate(await transaction('scenes', 'readonly', (s) => s.get(id)));
    },
    async remove(id) {
      const previous = await transaction('scenes', 'readonly', (s) => s.get(id));
      await transaction('scenes', 'readwrite', (s) => s.delete(id));
      if (previous?._binary?.bundle) await discard(previous._binary.bundle).catch(() => {});
    },
  };
}
