import { openArchive } from './archives.js';
export async function expandEmoteFiles(inputs) {
  const files = [];
  let total = 0;
  const add = (file) => {
    if (
      file.size > 64 * 1024 ** 2 ||
      (total += file.size) > 512 * 1024 ** 2 ||
      files.length >= 2000
    )
      throw Error('Impor emote maksimal 2000 file / 512 MB; satu file maksimal 64 MB.');
    files.push(file);
  };
  for (const file of inputs) {
    if (/\.(ycd|glb)$/i.test(file.name)) add(file);
    else if (/\.zip$/i.test(file.name)) {
      if (file.size > 512 * 1024 ** 2) throw Error('ZIP emote maksimal 512 MB.');
      const archive = await openArchive(file, file.name);
      for (const entry of archive.entries.filter((e) => /\.(ycd|glb)$/i.test(e.name))) {
        if (entry.size > 64 * 1024 ** 2 || entry.size + total > 512 * 1024 ** 2)
          throw Error('Isi ZIP emote melebihi batas sumber.');
        const data = await archive.extract(entry);
        add(new File([data], entry.name.split(/[\\/]/).pop()));
      }
    }
  }
  if (!files.length)
    throw Error('Tidak ada file animasi YCD/GLB. Daftar emote Lua saja tidak berisi animasi 3D.');
  return files;
}
