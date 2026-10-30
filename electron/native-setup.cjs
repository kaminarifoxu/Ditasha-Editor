'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const { createReadStream } = require('node:fs');
const { createHash } = require('node:crypto');
const PACKAGES = [
  {
    id: 'blender',
    name: 'Blender 5.2.2 LTS',
    file: 'blender.zip',
    size: 404453484,
    sha256: '3849d17a682cba006075aaa3f3597ecb5c9c30ec31035b2e092c53e40679b535',
    url: 'https://download.blender.org/release/Blender5.2/blender-5.2.2-windows-x64.zip',
  },
  {
    id: 'sollumz',
    name: 'Sollumz 2.9.0',
    file: 'sollumz.zip',
    size: 917827,
    sha256: 'c30f96d4c05ca74ca075eb5fdbcfbf08441498ca03328eb10fff595b4a4acd49',
    url: 'https://github.com/Sollumz/Sollumz/releases/download/v2.9.0/Sollumz.zip',
  },
  {
    id: 'muto',
    name: 'Muto Ped Rig 0.3.2',
    file: 'muto.zip',
    size: 3261088,
    sha256: '917b86b3501534c82fd0edf02a6d4b36359ea30430bdf408c643d08bc5a9ebec',
    url: 'https://github.com/B7Kompirine/muto-ped-rig/releases/download/v0.3.2/muto_ped_rig-0.3.2.zip',
  },
];
function managedEnv(root, inherited = process.env) {
  const env = {
    ...inherited,
    PYTHONUNBUFFERED: '1',
    BLENDER_USER_CONFIG: path.join(root, 'config'),
    BLENDER_USER_SCRIPTS: path.join(root, 'scripts'),
    BLENDER_USER_DATAFILES: path.join(root, 'datafiles'),
    BLENDER_USER_EXTENSIONS: path.join(root, 'extensions'),
  };
  // Never inherit a Python path or let Sollumz's CI hook trigger unsolicited downloads during builds.
  for (const key of ['PYTHONHOME', 'PYTHONPATH', 'CI']) delete env[key];
  return env;
}
async function validDownload(file, spec) {
  try {
    if ((await fs.stat(file)).size !== spec.size) return false;
    const hash = createHash('sha256');
    for await (const chunk of createReadStream(file)) hash.update(chunk);
    return hash.digest('hex') === spec.sha256;
  } catch {
    return false;
  }
}
async function download(spec, directory, signal, progress, fetcher = fetch) {
  await fs.mkdir(directory, { recursive: true });
  const file = path.join(directory, spec.file);
  if (await validDownload(file, spec)) {
    progress(spec.size, spec.size);
    return file;
  }
  const part = file + '.part';
  let handle;
  try {
    const response = await fetcher(spec.url, {
      signal: AbortSignal.any([signal, AbortSignal.timeout(15 * 60 * 1000)]),
    });
    if (!response.ok || !response.body)
      throw Error('Download ' + spec.name + ': HTTP ' + response.status);
    handle = await fs.open(part, 'w');
    const hash = createHash('sha256');
    let bytes = 0;
    for await (const chunk of response.body) {
      signal.throwIfAborted();
      bytes += chunk.length;
      if (bytes > spec.size) throw Error('Ukuran download tidak sesuai: ' + spec.name);
      hash.update(chunk);
      await handle.writeFile(chunk);
      progress(bytes, spec.size);
    }
    if (bytes !== spec.size || hash.digest('hex') !== spec.sha256)
      throw Error('Checksum download tidak cocok: ' + spec.name);
    await handle.close();
    handle = null;
    await fs.rm(file, { force: true });
    await fs.rename(part, file);
    return file;
  } finally {
    if (handle) await handle.close();
    await fs.rm(part, { force: true }).catch(() => {});
  }
}
function safeArchiveEntry(entry) {
  return (
    !entry.startsWith('/') &&
    !entry.includes('\\') &&
    !/^[a-z]:/i.test(entry) &&
    !entry.split('/').includes('..')
  );
}
async function setupNative({ root, signal, update, execute }) {
  const archives = {};
  for (const spec of PACKAGES) {
    archives[spec.id] = await download(spec, path.join(root, 'downloads'), signal, (done, total) =>
      update({
        message: `Mengunduh ${spec.name}… ${Math.floor((done / total) * 100)}%`,
        progress: { name: spec.name, done, total },
      }),
    );
  }
  signal.throwIfAborted();
  update({ message: 'Mengekstrak Blender portable…', progress: null });
  const list = await execute('tar.exe', ['-tf', archives.blender], { capture: true });
  if (!list.split(/\r?\n/).filter(Boolean).every(safeArchiveEntry))
    throw Error('Path arsip Blender tidak aman.');
  const folder = path.join(root, 'blender');
  await fs.mkdir(folder, { recursive: true });
  await execute('tar.exe', ['-xf', archives.blender, '-C', folder]);
  const engine = path.join(folder, 'blender-5.2.2-windows-x64', 'blender.exe');
  if (!(await fs.stat(engine)).isFile()) throw Error('Blender tidak ditemukan setelah ekstraksi.');
  const specFile = path.join(root, 'install.json');
  await fs.writeFile(specFile, JSON.stringify({ root, archives }));
  // Copy scripts out of app.asar before passing their names to an external process.
  const script = path.join(root, 'native_setup.py');
  await fs.copyFile(path.join(__dirname, 'native_setup.py'), script);
  update({
    message: 'Memasang Sollumz, Muto dan dependency native… (lihat Log engine)',
    progress: null,
  });
  await execute(
    engine,
    [
      '--background',
      '--factory-startup',
      '--disable-autoexec',
      '--python-exit-code',
      '2',
      '--python',
      script,
      '--',
      specFile,
    ],
    { env: managedEnv(root) },
  );
  await fs.writeFile(path.join(root, 'ready.json'), JSON.stringify({ version: 1, engine }));
  return engine;
}
module.exports = { PACKAGES, managedEnv, validDownload, download, safeArchiveEntry, setupNative };
