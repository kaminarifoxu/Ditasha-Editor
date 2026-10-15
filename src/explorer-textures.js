// Preview one dictionary at a time: sibling YTDs often contain alternative ped skins.
export function companionTextures(model, entries, explicit = '') {
  const path = model.replace(/\\/g, '/').toLowerCase();
  const folder = path.includes('/') ? path.slice(0, path.lastIndexOf('/') + 1) : '';
  const stem = path.replace(/\.[^.]+$/, '').replace(/_hi$/, '');
  const component = stem
    .split(/[\/^]/)
    .at(-1)
    .match(/^([a-z]+)_(\d+)(?:_|$)/);
  const ytds = entries.filter((entry) => !entry.encrypted && /\.ytd$/i.test(entry.name));
  if (explicit) return ytds.filter((entry) => entry.name === explicit);
  const ranked = ytds
    .map((entry) => {
      const name = entry.name.replace(/\\/g, '/').toLowerCase();
      const parent = name.includes('/') ? name.slice(0, name.lastIndexOf('/') + 1) : '';
      const candidate = name.split(/[\/^]/).at(-1);
      const family = component && candidate.startsWith(component[1] + '_diff_');
      const matchingIndex =
        family && candidate.startsWith(component[1] + '_diff_' + component[2] + '_');
      return {
        entry,
        rank:
          name.replace(/\.ytd$/, '') === stem
            ? 0
            : parent === folder && matchingIndex
              ? 1
              : parent === folder && family
                ? 2
                : parent === folder
                  ? 3
                  : name.startsWith(folder)
                    ? 4
                    : 5,
      };
    })
    .filter((value) => value.rank < 5)
    .sort((a, b) => a.rank - b.rank || a.entry.name.localeCompare(b.entry.name));
  const result = [];
  let total = 0;
  for (const { entry } of ranked) {
    if (result.length >= 1) break;
    if (entry.size > 64 * 1024 * 1024 || total + entry.size > 96 * 1024 * 1024) continue;
    result.push(entry);
    total += entry.size;
  }
  return result;
}
