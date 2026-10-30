export const COMPRESSOR_MAX_BYTES = 25 * 1024 ** 3;
export const COMPRESSOR_MAX_FILES = 50000;
export const COMPRESSOR_YTD_BYTES = 256 * 1024 ** 2;
export const COMPRESSOR_SIZES = [256, 512, 1024, 2048, 4096];
export function assetKind(path, fallback = 'vehicle') {
  if (/mp_[mf]_freemode|(?:^|[/_ -])(clothes|clothing|pakaian)(?:[/_ -]|$)/i.test(path))
    return 'clothing';
  if (/(?:^|[/_ -])(mlo|interior|maps?)(?:[/_ -]|$)/i.test(path) || /\.(ymap|ytyp)$/i.test(path))
    return 'mlo';
  if (/(?:^|[/_ -])(peds?|player|character)(?:[/_ -]|$)/i.test(path)) return 'ped';
  if (/\.yft$/i.test(path) || /(?:^|[/_ -])(vehicles?|cars?)(?:[/_ -]|$)/i.test(path))
    return 'vehicle';
  return fallback;
}
export function textureCap(entry, profiles) {
  return entry.maxSize || profiles[entry.kind];
}
export function previewCompanions(entry, entries) {
  const path = entry.path,
    dir = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '',
    base = path
      .split('/')
      .at(-1)
      .replace(/\.(ydd|ydr|yft)$/i, '')
      .replace(/_hi$/i, '');
  const cloth = base.match(/^(.*\^)((?:p_)?[a-z]+)_(\d{3})_/i);
  return entries
    .filter((e) => {
      if (!/\.ytd$/i.test(e.path)) return false;
      const d = e.path.includes('/') ? e.path.slice(0, e.path.lastIndexOf('/')) : '';
      if (d !== dir) return false;
      const b = e.path
        .split('/')
        .at(-1)
        .replace(/\.ytd$/i, '');
      return cloth
        ? b
            .toLowerCase()
            .startsWith((cloth[1] + cloth[2] + '_diff_' + cloth[3] + '_').toLowerCase())
        : b.toLowerCase().replace(/_hi$/i, '') === base.toLowerCase();
    })
    .sort((a, b) => a.path.localeCompare(b.path));
}
