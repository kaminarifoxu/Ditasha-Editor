'use strict';
const fs = require('node:fs/promises');
const { createWriteStream, constants } = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { pipeline } = require('node:stream/promises');
const { CATEGORIES, classifyAssets } = require('./asset-sort.cjs');
const { pairTextureGroups } = require('./ytd-groups.cjs');
const { createFilesApp } = require('./files-app.cjs');
const MAX_ENTRIES = 100000;
const within = (root, target) => {
  const relative = path.relative(root, target);
  return (
    relative === '' ||
    (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative))
  );
};
function createFileManager({
  dialog,
  win,
  shell,
  app,
  filesApp = createFilesApp({ app, shell }),
  onState = () => {},
}) {
  async function networkSettings(next) {
    const settingsPath=path.join(app.getPath('userData'),'file-manager-network.json');
    if(next===undefined){
      try {const v=JSON.parse(await fs.readFile(settingsPath,'utf8'));return {networkPath:typeof v.networkPath==='string'?v.networkPath:''};}
      catch(e){if(e.code==='ENOENT')return {networkPath:''};throw e;}
    }
    if(typeof next.networkPath!=='string'||next.networkPath.length>1024)throw Error('Alamat SMB tidak valid.');
    const networkPath=next.networkPath.trim();
    if(networkPath && (process.platform!=='win32'||!/^\\\\[^\\/]+\\[^\\/]+(?:\\.*)?$/.test(networkPath)||networkPath.split('\\').includes('..')))
      throw Error('Masukkan path SMB Windows seperti \\\\NAS\\Assets.');
    await fs.mkdir(path.dirname(settingsPath),{recursive:true});
    await fs.writeFile(settingsPath,JSON.stringify({networkPath},null,2),'utf8');
    return {networkPath};
  }
  let session, plan, controller, lastOutput;
  let state = { busy: false, message: 'Buka folder aset untuk memulai.', processed: 0 };
  function emit(patch) {
    state = { ...state, ...patch };
    onState({ ...state });
  }
  const idle = () => {
    if (controller) throw Error('Tunggu proses yang sedang berjalan.');
  };
  const ready = () => {
    if (!session) throw Error('Buka folder terlebih dahulu.');
    return session;
  };
  async function job(task) {
    idle();
    controller = new AbortController();
    emit({ busy: true, processed: 0 });
    try {
      return await task(controller.signal);
    } catch (e) {
      emit({ message: e.name === 'AbortError' ? 'Proses dibatalkan.' : e.message });
      throw e;
    } finally {
      controller = null;
      emit({ busy: false });
    }
  }
  async function source(entry) {
    const current = ready();
    const target = path.join(current.root, entry.relative);
    if (
      !within(current.root, await fs.realpath(target)) ||
      (await fs.lstat(target)).isSymbolicLink()
    )
      throw Error('File berubah menjadi tautan atau berada di luar folder sumber.');
    const handle = await fs.open(target, constants.O_RDONLY | (constants.O_NOFOLLOW || 0));
    try {
      const stat = await handle.stat();
      if (
        !stat.isFile() ||
        stat.size !== entry.size ||
        stat.mtimeMs !== entry.modified ||
        stat.ino !== entry.ino
      )
        throw Error('File berubah sejak pemindaian. Refresh folder sebelum melanjutkan.');
      return handle;
    } catch (e) {
      await handle.close();
      throw e;
    }
  }
  function query(value = {}) {
    const current = ready();
    const folder = value.folder || '';
    if (typeof folder !== 'string' || !current.folders.has(folder))
      throw Error('Folder tidak valid.');
    const category = value.category || '';
    if (category && !Object.hasOwn(CATEGORIES, category)) throw Error('Kategori tidak valid.');
    const search = typeof value.search === 'string' ? value.search.slice(0, 250).toLowerCase() : '';
    const recursive = value.recursive === true || !!search;
    return current.files.filter(
      (f) =>
        (!folder || f.relative.startsWith(folder + '/')) &&
        (recursive || path.posix.dirname(f.relative) === (folder || '.')) &&
        (!category || f.category === category) &&
        (!search || f.relative.toLowerCase().includes(search)),
    );
  }
  const api = {
    networkSettings,
    state: () => ({
      ...state,
      root: session
        ? {
            name: path.basename(session.root),
            path: session.root,
            count: session.files.length,
            bytes: session.bytes,
            skipped: session.skipped,
          }
        : null,
    }),
    async choose(refresh = false) {
      idle();
      // SMB is accessed through Windows' authenticated UNC filesystem provider.
      // No passwords or SMB credentials are handled or stored by the Editor.
      const networkPath = refresh && typeof refresh === 'object' ? refresh.networkPath : null;
      if (networkPath !== null && (process.platform !== 'win32' ||
          typeof networkPath !== 'string' ||
          !/^\\\\[^\\/]+\\[^\\/]+(?:\\.*)?$/.test(networkPath) ||
          networkPath.includes('..') || networkPath.length > 1024)) {
        throw Error('SMB harus berupa path Windows \\\\server\\share tanpa kredensial.');
      }
      let root = networkPath || (refresh === true ? ready().root : null);
      if (!root) {
        const picked = await dialog.showOpenDialog(win, {
          title: 'Buka folder aset',
          properties: ['openDirectory'],
        });
        if (picked.canceled || !picked.filePaths[0]) return null;
        root = await fs.realpath(picked.filePaths[0]);
      }
      if (networkPath) root = await fs.realpath(root);
      return job(async (signal) => {
        emit({ message: 'Memindai folder…' });
        const files = [],
          folders = new Set(['']),
          stack = [''];
        let skipped = 0,
          visited = 0,
          bytes = 0;
        while (stack.length) {
          signal.throwIfAborted();
          const relative = stack.pop();
          const absolute = path.join(root, relative);
          if (
            !within(root, await fs.realpath(absolute)) ||
            (await fs.lstat(absolute)).isSymbolicLink()
          ) {
            skipped++;
            continue;
          }
          let directory;
          try {
            directory = await fs.opendir(absolute);
          } catch {
            skipped++;
            continue;
          }
          for await (const entry of directory) {
            signal.throwIfAborted();
            if (++visited > MAX_ENTRIES)
              throw Error('Batas pemindaian 100.000 entri. Pilih subfolder yang lebih kecil.');
            const rel = [relative, entry.name].filter(Boolean).join('/');
            if (entry.isSymbolicLink()) {
              skipped++;
              continue;
            }
            if (entry.isDirectory()) {
              folders.add(rel);
              stack.push(rel);
            } else if (entry.isFile()) {
              try {
                const stat = await fs.lstat(path.join(root, rel));
                if (!stat.isFile() || stat.isSymbolicLink()) {
                  skipped++;
                  continue;
                }
                files.push({
                  id: randomUUID(),
                  relative: rel,
                  name: entry.name,
                  size: stat.size,
                  modified: stat.mtimeMs,
                  ino: stat.ino,
                });
                bytes += stat.size;
              } catch {
                skipped++;
              }
            } else skipped++;
            if (visited % 100 === 0)
              emit({ processed: visited, message: `Memindai ${visited.toLocaleString()} entri…` });
          }
        }
        session = { root, files: classifyAssets(files), folders, bytes, skipped };
        plan = null;
        emit({
          message: `${files.length.toLocaleString()} file siap · ${skipped} entri dilewati.`,
          processed: files.length,
        });
        return api.state();
      });
    },
    list(value = {}) {
      idle();
      const key = ['name', 'size', 'modified', 'type'].includes(value.orderBy)
        ? value.orderBy
        : 'name';
      const direction = value.descending === true ? -1 : 1;
      const queried = query(value);
      const modelOnly=value.modelOnly===true;
      const visibleQuery=modelOnly?queried.filter(f=>/\\.(ydd|ydr|yft)$/i.test(f.name)):queried;
      const paired = pairTextureGroups(queried);
      const files = (modelOnly?visibleQuery:paired.visible).sort((a, b) => {
        const order =
          key === 'size' || key === 'modified'
            ? a[key] - b[key]
            : key === 'type'
              ? path.extname(a.name).localeCompare(path.extname(b.name))
              : a.name.localeCompare(b.name, undefined, { numeric: true });
        return (
          direction * (order || a.relative.localeCompare(b.relative, undefined, { numeric: true }))
        );
      });
      const offset = Number.isSafeInteger(value.offset) && value.offset >= 0 ? value.offset : 0;
      const folders =
        value.search || value.category || value.recursive
          ? []
          : [...ready().folders]
              .filter((f) => f && path.posix.dirname(f) === (value.folder || '.'))
              .sort()
              .map((relative) => ({ relative, name: path.posix.basename(relative) }));
      const counts = {};
      for (const file of files) counts[file.category] = (counts[file.category] || 0) + 1;
      const pageSize = value.previewPageSize === 250 ? 250 : 100;
      const pageFolders = folders.slice(offset, offset + pageSize);
      const fileOffset = Math.max(0, offset - folders.length);
      return {
        files:
          offset + pageSize > folders.length
            ? files
                .slice(fileOffset, fileOffset + pageSize - pageFolders.length)
                .map(({ ino, ...file }) => ({...file, textures:paired.groups.get(file.id)||[]}))
            : [],
        folders: pageFolders,
        // Raw count stays stable for reporting and sorting; the UI paginates grouped rows.
        total: queried.length,
        totalItems: files.length + folders.length,
        bytes: queried.reduce((n, f) => n + f.size, 0),
        counts,
        navigationFolders: [...ready().folders]
          .filter((f) => f && path.posix.dirname(f) === (value.folder || '.'))
          .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
          .slice(0, 200)
          .map((relative) => ({ relative, name: path.posix.basename(relative) })),
      };
    },
    async filesApp(value = {}) {
      idle();
      if (value.action === 'status') return filesApp.state();
      if (value.action === 'download') return filesApp.download();
      if (value.action !== 'open') throw Error('Aksi Files tidak valid.');
      const current = ready();
      const folder = value.folder || '';
      if (typeof folder !== 'string' || !current.folders.has(folder))
        throw Error('Folder tidak valid.');
      const target = path.join(current.root, folder);
      if (
        !within(current.root, await fs.realpath(target)) ||
        (await fs.lstat(target)).isSymbolicLink()
      )
        throw Error('Folder berubah menjadi tautan atau berada di luar sumber.');
      return filesApp.open(target);
    },
    async read(id) {
      idle();
      const entry = ready().files.find((f) => f.id === id);
      if (
        !entry ||
        !/\.(png|jpe?g|webp|gif|bmp|ytd|dds|ydd|ydr|yft|rpf|zip|oiv)$/i.test(entry.name)
      )
        throw Error('Format ini belum memiliki preview internal.');
      const previewLimit = /\.ytd$/i.test(entry.name) ? 384 : /\.(ydd|ydr|yft)$/i.test(entry.name) ? 128 : 64;
      if (entry.size > previewLimit * 1024 * 1024)
        throw Error(
          'Preview maksimum ' +
            previewLimit +
            ' MB per file. Sorting tetap dapat menyalin file besar.',
        );
      const handle = await source(entry);
      try {
        const paired = /\.(ydd|ydr|yft)$/i.test(entry.name)
          ? ready()
              .files.filter(
                (f) =>
                  /\.ytd$/i.test(f.name) &&
                  path.posix.dirname(f.relative) === path.posix.dirname(entry.relative) &&
                  ((entry.group && f.group === entry.group && f.category === entry.category) ||
                    f.name.toLowerCase() ===
                      entry.name.toLowerCase().replace(/(?:_hi)?\.[^.]+$/, '.ytd')),
              )
              .sort((a, b) => a.name.localeCompare(b.name))[0]
          : null;
        return {
          name: entry.name,
          data: new Uint8Array(await handle.readFile()),
          companion: paired ? { id: paired.id, name: paired.name } : null,
        };
      } finally {
        await handle.close();
      }
    },
    plan(value = {}) {
      idle();
      let files = query(value);
      if (value.ids !== undefined) {
        if (!Array.isArray(value.ids) || value.ids.length > MAX_ENTRIES)
          throw Error('Pilihan file tidak valid.');
        const ids = new Set(value.ids);
        files = files.filter((f) => ids.has(f.id));
        if (files.length !== ids.size) throw Error('Pilihan file sudah berubah. Pilih ulang file.');
      }
      if (!files.length) throw Error('Tidak ada file untuk disorting.');
      plan = { id: randomUUID(), files };
      const counts = {};
      for (const file of files) counts[file.category] = (counts[file.category] || 0) + 1;
      return {
        id: plan.id,
        count: files.length,
        bytes: files.reduce((n, f) => n + f.size, 0),
        counts,
        entries: files
          .slice(0, 100)
          .map((f) => ({ source: f.relative, destination: f.destination, note: f.note })),
      };
    },
    async sort(id) {
      idle();
      if (!plan || plan.id !== id)
        throw Error('Rencana sorting kedaluwarsa. Buat pratinjau ulang.');
      const snapshot = plan;
      return job(async (signal) => {
        const picked = await dialog.showOpenDialog(win, {
          title: 'Pilih folder output sorting',
          properties: ['openDirectory', 'createDirectory'],
        });
        if (picked.canceled || !picked.filePaths[0]) return null;
        signal.throwIfAborted();
        const parent = await fs.realpath(picked.filePaths[0]);
        if (within(ready().root, parent))
          throw Error('Pilih output di luar folder sumber agar hasil tidak ikut dipindai kembali.');
        const output = await fs.mkdtemp(path.join(parent, 'DITASHA-Sorted-'));
        lastOutput = output;
        const report = {
          version: 1,
          source: ready().root,
          output,
          created: new Date().toISOString(),
          copied: 0,
          failed: 0,
          cancelled: false,
          files: [],
        };
        for (const entry of snapshot.files) {
          if (signal.aborted) {
            report.cancelled = true;
            break;
          }
          const target = path.join(output, entry.destination);
          let handle,
            created = false;
          try {
            if (!within(output, target)) throw Error('Tujuan file tidak valid.');
            handle = await source(entry);
            await fs.mkdir(path.dirname(target), { recursive: true });
            if (!within(output, await fs.realpath(path.dirname(target))))
              throw Error('Folder output berubah menjadi tautan.');
            const writer = createWriteStream(target, { flags: 'wx' });
            writer.once('open', () => {
              created = true;
            });
            await pipeline(handle.createReadStream({ autoClose: false }), writer, { signal });
            const after = await handle.stat();
            if (after.size !== entry.size || after.mtimeMs !== entry.modified)
              throw Error('File berubah selama penyalinan. Refresh dan coba lagi.');
            report.copied++;
            report.files.push({
              source: entry.relative,
              destination: entry.destination,
              status: 'copied',
            });
          } catch (e) {
            if (created) await fs.rm(target, { force: true }).catch(() => {});
            if (signal.aborted) {
              report.cancelled = true;
              break;
            }
            report.failed++;
            report.files.push({
              source: entry.relative,
              destination: entry.destination,
              status: 'failed',
              error: e.message,
            });
          } finally {
            await handle?.close();
          }
          emit({
            processed: report.copied + report.failed,
            message: `Menyalin ${report.copied + report.failed}/${snapshot.files.length} · ${entry.name}`,
          });
        }
        await fs.writeFile(
          path.join(output, 'ditasha-sort-report.json'),
          JSON.stringify(report, null, 2),
          { flag: 'wx' },
        );
        plan = null;
        emit({
          message: `${report.cancelled ? 'Dibatalkan' : 'Selesai'} · ${report.copied} tersalin · ${report.failed} gagal. Laporan tersimpan di output.`,
        });
        return {
          output,
          copied: report.copied,
          failed: report.failed,
          cancelled: report.cancelled,
        };
      });
    },
    cancel() {
      controller?.abort();
    },
    async reveal(id) {
      idle();
      if (id === 'output' && lastOutput) return shell.openPath(lastOutput);
      const entry = ready().files.find((f) => f.id === id);
      if (!entry) throw Error('File tidak ditemukan.');
      const handle = await source(entry);
      await handle.close();
      shell.showItemInFolder(path.join(ready().root, entry.relative));
    },
  };
  return api;
}
function registerFileManager({ ipcMain, trusted, win, ...options }) {
  const manager = createFileManager({
    ...options,
    win,
    onState: (state) => {
      if (!win.isDestroyed()) win.webContents.send('ditasha:files-progress', state);
    },
  });
  for (const name of [
    'state',
    'choose',
    'list',
    'read',
    'plan',
    'sort',
    'cancel',
    'reveal',
    'filesApp',
    'networkSettings',
  ]) {
    ipcMain.handle('ditasha:files-' + name, (event, value) => {
      trusted(event);
      return manager[name](value);
    });
  }
  win.on('closed', () => manager.cancel());
  return manager;
}
module.exports = { createFileManager, registerFileManager };
