import { safePath, MAX_EXPORT } from './asset-tools.js';
export function folderArchive(files) {
  if (!files.length || files.length > 65534) throw Error('Choose a folder with 1–65534 files.');
  const seen = new Set();
  let root = '';
  const entries = files.map((file) => {
    const relative = file.webkitRelativePath || file.name,
      parts = relative.split('/');
    if (parts.length > 1) {
      if (!root) root = parts[0];
      if (root !== parts[0]) throw Error('Choose one folder at a time.');
      parts.shift();
    }
    const name = safePath(parts.join('/'));
    if (seen.has(name.toLowerCase())) throw Error('Duplicate folder path: ' + name);
    seen.add(name.toLowerCase());
    return { name, size: file.size, encrypted: false, directory: false, file };
  });
  return {
    name: root || 'Local folder',
    kind: 'Folder',
    entries,
    async extract(entry) {
      if (!entries.includes(entry) || entry.directory) throw Error('Select a folder file.');
      if (entry.size > MAX_EXPORT) throw Error('File exceeds extraction limit of 128 MB.');
      return new Uint8Array(await entry.file.arrayBuffer());
    },
  };
}
export function sortEntries(entries, field = 'name', descending = false) {
  if (!['name', 'type', 'size'].includes(field)) throw Error('Invalid sort field.');
  const type = (e) => (e.name.includes('.') ? e.name.split('.').at(-1).toLowerCase() : '');
  return [...entries].sort((a, b) => {
    const order =
      field === 'size'
        ? a.size - b.size
        : field === 'type'
          ? type(a).localeCompare(type(b), 'en')
          : a.name.localeCompare(b.name, 'en', { numeric: true, sensitivity: 'base' });
    return (order || a.name.localeCompare(b.name, 'en')) * (descending ? -1 : 1);
  });
}
export function hexPage(bytes, start = 0, count = 4096) {
  if (
    !(bytes instanceof Uint8Array) ||
    !Number.isInteger(start) ||
    start < 0 ||
    !Number.isInteger(count) ||
    count < 1 ||
    count > 4096
  )
    throw Error('Invalid hex preview.');
  const lines = [];
  for (let p = start; p < Math.min(bytes.length, start + count); p += 16) {
    const row = bytes.subarray(p, Math.min(p + 16, bytes.length, start + count));
    const hex = [...row]
        .map((b) => b.toString(16).padStart(2, '0'))
        .join(' ')
        .padEnd(47, ' '),
      ascii = [...row].map((b) => (b >= 32 && b < 127 ? String.fromCharCode(b) : '.')).join('');
    lines.push(p.toString(16).padStart(8, '0') + '  ' + hex + '  ' + ascii);
  }
  return lines.join('\n');
}
