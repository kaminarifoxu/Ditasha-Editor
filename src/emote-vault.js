// Persist source bytes, not decoded tracks or temporary browser Blob URLs.
const CHUNK = 2 * 1024 ** 2;
export function createEmoteVault(provider = globalThis.indexedDB) {
  let connection;
  async function db() {
    if (!provider) throw Error('Penyimpanan emote lokal tidak tersedia.');
    return (connection ||= new Promise((resolve, reject) => {
      const request = provider.open('ditasha-emote-vault', 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore('files', { keyPath: 'id' });
        request.result.createObjectStore('chunks', { keyPath: ['id', 'part'] });
      };
      request.onsuccess = () => {
        request.result.onversionchange = () => {
          request.result.close();
          connection = null;
        };
        resolve(request.result);
      };
      request.onerror = request.onblocked = () => {
        connection = null;
        reject(request.error || Error('Tutup jendela DITASHA lain lalu muat ulang emote.'));
      };
    }));
  }
  async function transaction(stores, mode, action) {
    const database = await db();
    return new Promise((resolve, reject) => {
      const tx = database.transaction(stores, mode);
      let result;
      tx.oncomplete = () => resolve(typeof result === 'function' ? result() : result?.result);
      tx.onerror = tx.onabort = () =>
        reject(tx.error || Error('Emote belum tersimpan. Periksa ruang penyimpanan lokal.'));
      try {
        result = action(tx);
      } catch (error) {
        tx.abort();
        reject(error);
      }
    });
  }
  const list = () => transaction(['files'], 'readonly', (tx) => tx.objectStore('files').getAll());
  async function save(file, key) {
    if (!(file instanceof Blob) || !/\.(ycd|glb)$/i.test(file.name) || file.size > 64 * 1024 ** 2)
      throw Error('Sumber emote harus YCD/GLB, maksimal 64 MB.');
    const bytes = await file.arrayBuffer();
    const id =
      key ||
      [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
        .map((n) => n.toString(16).padStart(2, '0'))
        .join('');
    if (!/^[a-f0-9]{64}$/.test(id)) throw Error('Identitas emote tidak valid.');
    await transaction(['files', 'chunks'], 'readwrite', (tx) => {
      const files = tx.objectStore('files'),
        chunks = tx.objectStore('chunks');
      const request = files.getAll();
      request.onsuccess = () => {
        if (request.result.some((f) => f.id === id)) return;
        if (
          request.result.length >= 2000 ||
          request.result.reduce((n, f) => n + f.size, 0) + bytes.byteLength > 512 * 1024 ** 2
        ) {
          tx.abort();
          return;
        }
        for (let part = 0; part * CHUNK < bytes.byteLength; part++)
          chunks.put({ id, part, bytes: bytes.slice(part * CHUNK, (part + 1) * CHUNK) });
        files.put({
          id,
          name: file.name,
          size: bytes.byteLength,
          type: file.type || '',
          lastModified: file.lastModified || 0,
        });
      };
    });
    return id;
  }
  async function load(record) {
    if (
      !record ||
      !/^[a-f0-9]{64}$/.test(record.id) ||
      !Number.isSafeInteger(record.size) ||
      record.size < 0 ||
      record.size > 64 * 1024 ** 2 ||
      !/\.(ycd|glb)$/i.test(record.name)
    )
      throw Error('Data emote tersimpan tidak valid.');
    const parts = [];
    for (let part = 0; part * CHUNK < record.size; part++) {
      const chunk = await transaction(['chunks'], 'readonly', (tx) =>
        tx.objectStore('chunks').get([record.id, part]),
      );
      if (
        !(chunk?.bytes instanceof ArrayBuffer) ||
        chunk.bytes.byteLength !== Math.min(CHUNK, record.size - part * CHUNK)
      )
        throw Error(record.name + ': data emote belum lengkap; sumber tersimpan tidak dihapus.');
      parts.push(chunk.bytes);
    }
    const file = new File(parts, record.name, {
      type: record.type,
      lastModified: record.lastModified,
    });
    const digest = [
      ...new Uint8Array(await crypto.subtle.digest('SHA-256', await file.arrayBuffer())),
    ]
      .map((n) => n.toString(16).padStart(2, '0'))
      .join('');
    if (digest !== record.id) throw Error(record.name + ': checksum emote tersimpan tidak cocok.');
    return file;
  }
  const clear = () =>
    transaction(['files', 'chunks'], 'readwrite', (tx) => {
      tx.objectStore('files').clear();
      tx.objectStore('chunks').clear();
    });
  return { list, save, load, clear };
}
