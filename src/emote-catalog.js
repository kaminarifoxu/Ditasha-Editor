// Keep the library metadata separate from decoded animation memory. Files remain
// available for presets; only selected source dictionaries are hydrated for playback.
export function createEmoteCatalog({
  decode,
  fingerprint = async (file) => {
    const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
    return [...new Uint8Array(digest)].map((n) => n.toString(16).padStart(2, '0')).join('');
  },
  maxFiles = 2000,
  maxBytes = 512 * 1024 ** 2,
  maxEntries = 32768,
  maxValues = 16e6,
  maxCacheBytes = 192 * 1024 ** 2,
} = {}) {
  const sources = [],
    entries = [],
    signatures = new Map(),
    cache = new Map(),
    inflight = new Map();
  let sourceBytes = 0;
  const cost = (decoded) => ({
    values: decoded.values || 0,
    bytes: decoded.memoryBytes ?? (decoded.values || 0) * 4,
  });
  async function add(file, prefix) {
    if (file.size > 64 * 1024 ** 2) throw Error('File emote maksimal 64 MB.');
    const key = await fingerprint(file);
    if (signatures.has(key))
      return { duplicate: true, source: signatures.get(key), entries: [], warnings: [] };
    if (sources.length >= maxFiles || sourceBytes + file.size > maxBytes)
      throw Error('Library emote maksimal 2000 file / 512 MB sumber.');
    const decoded = await decode(file, prefix);
    if (entries.length + decoded.entries.length > maxEntries)
      throw Error(
        'Katalog emote maksimal ' + maxEntries + ' clip. Hapus sumber yang tidak digunakan.',
      );
    const metadata = decoded.entries.map((entry, index) => ({
      id: entry.id,
      label: entry.label,
      lazyPrefix: prefix,
      sourceIndex: index,
      nativeYcd: !!entry.ycd,
      clip: { name: entry.clip.name, duration: entry.clip.duration, tracks: [] },
    }));
    const source = { file, prefix };
    sources.push(source);
    entries.push(...metadata);
    signatures.set(key, source);
    sourceBytes += file.size;
    return { source, entries: metadata, warnings: decoded.warnings || [], duplicate: false };
  }
  async function load(selected) {
    const pinned = new Set(selected.map((c) => c.lazyPrefix).filter(Boolean));
    const loaded = new Map();
    for (const prefix of pinned) {
      if (!cache.has(prefix)) {
        const source = sources.find((s) => s.prefix === prefix);
        if (!source) throw Error('Sumber emote tidak tersedia.');
        if (!inflight.has(prefix))
          inflight.set(
            prefix,
            decode(source.file, prefix).finally(() => inflight.delete(prefix)),
          );
        const decoded = await inflight.get(prefix),
          incoming = cost(decoded);
        // A second selection can finish hydration of the same file while we await.
        if (cache.has(prefix)) {
          for (const entry of cache.get(prefix).entries) loaded.set(entry.id, entry);
          continue;
        }
        const totals = () =>
          [...cache.values()].reduce(
            (n, d) => {
              const c = cost(d);
              return { values: n.values + c.values, bytes: n.bytes + c.bytes };
            },
            { values: 0, bytes: 0 },
          );
        for (const key of [...cache.keys()]) {
          const used = totals();
          if (
            used.values + incoming.values <= maxValues &&
            used.bytes + incoming.bytes <= maxCacheBytes
          )
            break;
          if (!pinned.has(key)) cache.delete(key);
        }
        const used = totals();
        if (
          used.values + incoming.values > maxValues ||
          used.bytes + incoming.bytes > maxCacheBytes
        )
          throw Error(
            'Emote yang aktif bersamaan melebihi cache playback. Pilih lebih sedikit emote berat; library tetap tersimpan.',
          );
        cache.set(prefix, decoded);
      }
      const decoded = cache.get(prefix);
      cache.delete(prefix);
      cache.set(prefix, decoded);
      for (const entry of decoded.entries) loaded.set(entry.id, entry);
    }
    return loaded;
  }
  function peek(selected) {
    const prefixes = new Set(selected.map((c) => c.lazyPrefix).filter(Boolean));
    if ([...prefixes].some((prefix) => !cache.has(prefix))) return null;
    const loaded = new Map();
    for (const prefix of prefixes) {
      const decoded = cache.get(prefix);
      cache.delete(prefix);
      cache.set(prefix, decoded);
      for (const entry of decoded.entries) loaded.set(entry.id, entry);
    }
    return loaded;
  }
  return {
    add,
    load,
    peek,
    sources,
    entries,
    stats: () => ({
      files: sources.length,
      clips: entries.length,
      sourceBytes,
      residentFiles: cache.size,
    }),
  };
}
