import { textureNameMatches } from './model-material.js';
import { MAX_DECODED_TEXTURE_BYTES } from './texture-memory.js';

const supported = /\.(ytd|dds|png|jpe?g|webp)$/i;
export const textureFilePath = (file) => file.webkitRelativePath || file.name;
const stem = (name) =>
  name
    .split(/[\\/]/)
    .at(-1)
    .replace(/\.[^.]+$/, '')
    .replace(/_hi$/i, '')
    .toLowerCase();
function check(signal) {
  if (signal?.aborted) throw new DOMException('Pencarian dihentikan.', 'AbortError');
}
// The caller supplies only files explicitly selected by the user. Never walk the host disk.
export async function indexTextureFiles(files, { decode, signal, progress = () => {} }) {
  const candidates = [...files].filter((f) => supported.test(f.name));
  if (candidates.length > 1000 || candidates.reduce((n, f) => n + f.size, 0) > 2 * 1024 ** 3)
    throw Error('Folder terlalu besar: pilih subfolder dengan maksimal 1.000 file tekstur / 2 GB.');
  const entries = [],
    errors = [];
  for (const [i, file] of candidates.entries()) {
    check(signal);
    progress(i + 1, candidates.length, textureFilePath(file));
    check(signal);
    try {
      if (file.size > 64 * 1024 ** 2) throw Error('File melebihi 64 MB.');
      const metadata = /\.ytd$/i.test(file.name)
        ? await decode('texture-index', await file.arrayBuffer())
        : [{ name: file.name.replace(/\.[^.]+$/, '') }];
      check(signal);
      if (entries.length + metadata.length > 100000)
        throw Error('Indeks melebihi 100.000 tekstur. Pilih folder lebih kecil.');
      entries.push(...metadata.map((t) => ({ ...t, file, dictionary: file.name })));
    } catch (error) {
      if (signal?.aborted) check(signal);
      errors.push({ path: textureFilePath(file), message: error.message });
    }
  }
  return { entries, errors, files: candidates.length };
}

export function planTextureSearch(requests, entries) {
  const selected = new Set(),
    ambiguous = [],
    absent = [];
  const unique = new Map(requests.map((r) => [JSON.stringify([r.name, r.source]), r]));
  for (const request of unique.values()) {
    const matches = entries.filter((t) => textureNameMatches(request.name, t.name));
    const owned = matches.filter(
      (t) => stem(t.dictionary) === stem(request.source.split(' · ')[0]),
    );
    const choices = owned.length ? owned : matches;
    if (choices.length === 1) selected.add(choices[0]);
    else if (choices.length)
      ambiguous.push({ ...request, paths: choices.map((t) => textureFilePath(t.file)) });
    else absent.push(request);
  }
  return { selected: [...selected], ambiguous, absent };
}

export async function loadSearchTextures(
  selected,
  { decode, image, signal, usedBytes = 0, progress = () => {} },
) {
  const grouped = new Map(),
    textures = [],
    errors = [];
  for (const t of selected) {
    if (!grouped.has(t.file)) grouped.set(t.file, []);
    grouped.get(t.file).push(t.name);
  }
  let bytes = usedBytes;
  for (const [file, names] of grouped) {
    check(signal);
    progress(textureFilePath(file));
    check(signal);
    try {
      const options = { names, maxDecodedBytes: MAX_DECODED_TEXTURE_BYTES - bytes };
      const decoded = /\.ytd$/i.test(file.name)
        ? await decode('textures', await file.arrayBuffer(), options)
        : await image(file, options);
      check(signal);
      const size = decoded.reduce((n, t) => n + t.out.length, 0);
      if (bytes + size > MAX_DECODED_TEXTURE_BYTES) throw Error('Model textures exceed 512 MB.');
      bytes += size;
      textures.push(
        ...decoded.map((t) => ({ ...t, dictionary: file.name, searchPath: textureFilePath(file) })),
      );
    } catch (error) {
      if (signal?.aborted) check(signal);
      errors.push({ path: textureFilePath(file), message: error.message });
    }
  }
  check(signal);
  return { textures, errors };
}
