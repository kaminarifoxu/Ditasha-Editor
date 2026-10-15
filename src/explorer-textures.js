// Prefer the exact dictionary, then nearby dictionaries. Never extract unlimited archives for a preview.
export function companionTextures(model, entries, explicit = '') {
  const path = model.replace(/\\/g, '/').toLowerCase();
  const folder = path.includes('/') ? path.slice(0, path.lastIndexOf('/') + 1) : '';
  const stem = path.replace(/\.[^.]+$/, '').replace(/_hi$/, '');
  const ytds = entries.filter((entry) => !entry.encrypted && /\.ytd$/i.test(entry.name));
  if (explicit) return ytds.filter((entry) => entry.name === explicit);
  const ranked = ytds
    .map((entry) => {
      const name = entry.name.replace(/\\/g, '/').toLowerCase();
      const parent = name.includes('/') ? name.slice(0, name.lastIndexOf('/') + 1) : '';
      return {
        entry,
        rank:
          name.replace(/\.ytd$/, '') === stem
            ? 0
            : parent === folder
              ? 1
              : name.startsWith(folder)
                ? 2
                : 3,
      };
    })
    .filter((value) => value.rank < 3)
    .sort((a, b) => a.rank - b.rank || a.entry.name.localeCompare(b.entry.name));
  const result = [];
  let total = 0;
  for (const { entry } of ranked) {
    if (result.length >= 8) break;
    if (entry.size > 64 * 1024 * 1024 || total + entry.size > 96 * 1024 * 1024) continue;
    result.push(entry);
    total += entry.size;
  }
  return result;
}
