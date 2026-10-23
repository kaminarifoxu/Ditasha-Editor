import { safePath, zipFiles } from './asset-tools.js';
export function planPedFiles(files) {
  if (!files.length || files.length > 256) throw Error('Pilih 1–256 file ped.');
  const seen = new Set();
  let total = 0;
  const entries = files.map((file) => {
    const name = safePath(file.name);
    const extension = name.split('.').at(-1).toLowerCase();
    if (!['ydd', 'yft', 'ytd', 'ymt'].includes(extension))
      throw Error('Gunakan YDD, YFT, YTD atau YMT.');
    if (seen.has(name.toLowerCase())) throw Error('Nama file ped duplikat: ' + name);
    seen.add(name.toLowerCase());
    if (
      !Number.isSafeInteger(file.size) ||
      file.size < 1 ||
      file.size > (extension === 'ytd' ? 256 : 64) * 1048576
    )
      throw Error('File ped kosong atau melewati batas ukuran: ' + name);
    total += file.size;
    return { name, extension, file };
  });
  if (total > 128 * 1048576 - 1048576)
    throw Error('Bundle ped maksimal 127 MB untuk ekspor ZIP 128 MB.');
  const models = entries.filter((e) => e.extension === 'ydd');
  if (!models.length) models.push(...entries.filter((e) => e.extension === 'yft'));
  if (!models.length) throw Error('Pilih minimal satu YDD atau YFT untuk model.');
  return {
    entries,
    total,
    preview: [
      ...models.map((e) => e.file),
      ...entries.filter((e) => e.extension === 'ytd').map((e) => e.file),
    ],
  };
}
export async function packagePedFiles(plan) {
  const entries = [];
  for (const e of plan.entries)
    entries.push({ name: e.name, data: new Uint8Array(await e.file.arrayBuffer()) });
  return zipFiles(entries);
}
