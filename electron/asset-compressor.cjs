'use strict';
const fs = require('node:fs/promises');
const { constants } = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const LIMIT_BYTES = 25 * 1024 ** 3,
  LIMIT_FILES = 50000,
  LIMIT_YTD = 256 * 1024 ** 2;
function safeRelative(value) {
  if (typeof value !== 'string' || value.length > 2000 || value.includes('\\'))
    throw Error('Path tidak valid');
  const parts = value.split('/');
  if (
    parts.some(
      (p) =>
        !p ||
        p === '.' ||
        p === '..' ||
        /[\x00-\x1f<>:"|?*]/.test(p) ||
        /[. ]$/.test(p) ||
        /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(p),
    ) ||
    parts[0].toLowerCase() === '.ditasha-compressor'
  )
    throw Error('Nama/path file tidak aman: ' + value);
  return parts.join('/');
}
function createCompressor({ chooseFolder, revealFolder = async () => {} }) {
  const jobs = new Map();
  let starting = false;
  function jobFor(id) {
    const job = jobs.get(id);
    if (!job) throw Error('Sesi kompresi tidak ditemukan');
    return job;
  }
  async function destination(job, relative) {
    let current = job.root;
    if ((await fs.lstat(current)).isSymbolicLink() || (await fs.realpath(current)) !== job.root)
      throw Error('Folder output berubah');
    const parts = safeRelative(relative).split('/');
    for (const part of parts.slice(0, -1)) {
      current = path.join(current, part);
      await fs.mkdir(current).catch((e) => {
        if (e.code !== 'EEXIST') throw e;
      });
      const stat = await fs.lstat(current);
      if (!stat.isDirectory() || stat.isSymbolicLink()) throw Error('Folder output tidak aman');
    }
    return path.join(current, parts.at(-1));
  }
  async function source(entry) {
    const stat = await fs.stat(entry.source);
    if (!stat.isFile() || stat.size !== entry.inputBytes || stat.mtimeMs !== entry.mtime)
      throw Error('File sumber berubah; impor ulang: ' + entry.path);
    return entry.source;
  }
  return {
    async begin(entries) {
      if (starting || [...jobs.values()].some((j) => j.active))
        throw Error('Satu batch masih berjalan');
      starting = true;
      try {
        if (!Array.isArray(entries) || !entries.length || entries.length > LIMIT_FILES)
          throw Error('Batch maksimum 50.000 file');
        const records = [],
          seen = new Set();
        let total = 0;
        for (const item of entries) {
          const relative = safeRelative(item.path),
            key = relative.toLowerCase();
          if (seen.has(key)) throw Error('Path ganda: ' + relative);
          seen.add(key);
          if (typeof item.source !== 'string' || !path.isAbsolute(item.source))
            throw Error('Pilih file asli melalui File atau Folder');
          const absolute = await fs.realpath(item.source),
            stat = await fs.stat(absolute);
          if (!stat.isFile()) throw Error('Bukan file: ' + relative);
          total += stat.size;
          if (total > LIMIT_BYTES) throw Error('Batch maksimum 25 GB');
          records.push({
            path: relative,
            source: absolute,
            inputBytes: stat.size,
            mtime: stat.mtimeMs,
            status: 'pending',
          });
        }
        const parent = await chooseFolder();
        if (!parent) return { cancelled: true };
        const canonical = await fs.realpath(parent),
          root = await fs.mkdtemp(path.join(canonical, 'DITASHA-compressed-'));
        const id = randomUUID(),
          job = {
            id,
            root: await fs.realpath(root),
            records,
            active: true,
            busy: false,
            createdAt: new Date().toISOString(),
          };
        const manifestDir = path.join(job.root, '.ditasha-compressor');
        await fs.mkdir(manifestDir);
        await fs.writeFile(
          path.join(manifestDir, 'report.json'),
          JSON.stringify(
            {
              version: 1,
              status: 'processing',
              note: 'Incomplete until status is completed. Files can be partial after interruption.',
              inputBytes: total,
              files: records.map(({ source, mtime, ...r }) => r),
            },
            null,
            2,
          ),
          { flag: 'wx' },
        );
        jobs.set(id, job);
        for (const [key, old] of jobs) if (!old.active && key !== id) jobs.delete(key);
        return { id, folder: job.root, files: records.length, inputBytes: total };
      } finally {
        starting = false;
      }
    },
    async write({ id, index, bytes, reason = '', metrics = null }) {
      const job = jobFor(id),
        entry = job.records[index];
      if (!job.active || job.busy || !entry || entry.status !== 'pending')
        throw Error('File/job tidak siap');
      job.busy = true;
      let target,
        created = false;
      try {
        await source(entry);
        target = await destination(job, entry.path);
        if (bytes != null) {
          if (
            !/\.ytd$/i.test(entry.path) ||
            !(bytes instanceof Uint8Array) ||
            bytes.length > LIMIT_YTD ||
            bytes.length >= entry.inputBytes ||
            Buffer.from(bytes.subarray(0, 4)).toString() !== 'RSC7'
          )
            throw Error('Hasil optimasi YTD tidak valid');
        }
        const reservation = await fs.open(target, 'wx');
        created = true;
        await reservation.close();
        if (bytes != null) await fs.writeFile(target, bytes);
        else await fs.copyFile(entry.source, target);
        // Source changes during native copying must not produce a claimed successful result.
        await source(entry);
        entry.outputBytes = (await fs.stat(target)).size;
        entry.status = bytes ? 'optimized' : 'preserved';
        entry.reason = String(reason).slice(0, 1000);
        if (metrics && Number.isFinite(metrics.before) && Number.isFinite(metrics.after))
          entry.texturePayloadBytes = { before: metrics.before, after: metrics.after };
        return { path: entry.path, status: entry.status, outputBytes: entry.outputBytes };
      } catch (e) {
        // Only remove a partial file created by this attempt, never a pre-existing target.
        if (target && created) await fs.rm(target, { force: true }).catch(() => {});
        entry.status = 'failed';
        entry.reason = String(e.message).slice(0, 1000);
        throw e;
      } finally {
        job.busy = false;
      }
    },
    async finish({ id, cancelled = false }) {
      const job = jobFor(id);
      if (!job.active || job.busy) throw Error('Job belum dapat ditutup');
      try {
        const results = job.records.map(({ source, mtime, ...r }) => r),
          failed = results.filter((r) => r.status === 'failed').length;
        const report = {
          version: 1,
          createdAt: job.createdAt,
          finishedAt: new Date().toISOString(),
          status:
            cancelled || results.some((r) => r.status === 'pending')
              ? 'cancelled'
              : failed
                ? 'completed-with-errors'
                : 'completed',
          scope:
            'External Legacy YTD textures; model geometry, embedded textures, rigs and metadata are preserved.',
          files: results,
          inputBytes: results.reduce((n, r) => n + r.inputBytes, 0),
          outputBytes: results.reduce((n, r) => n + (r.outputBytes || 0), 0),
          failed,
        };
        if (
          (await fs.lstat(job.root)).isSymbolicLink() ||
          (await fs.realpath(job.root)) !== job.root
        )
          throw Error('Folder output berubah');
        const dir = path.join(job.root, '.ditasha-compressor');
        await fs.mkdir(dir, { recursive: true });
        if ((await fs.lstat(dir)).isSymbolicLink()) throw Error('Folder laporan tidak aman');
        const temp = path.join(dir, randomUUID() + '.tmp');
        await fs.writeFile(temp, JSON.stringify(report, null, 2), { flag: 'wx' });
        await fs.rename(temp, path.join(dir, 'report.json'));
        job.active = false;
        return { ...report, files: undefined, folder: job.root };
      } finally {
        job.active = false;
      }
    },
    async reveal(id) {
      return revealFolder(jobFor(id).root);
    },
  };
}
function registerAssetCompressor({ ipcMain, trusted, dialog, win, shell }) {
  const service = createCompressor({
    chooseFolder: async () => {
      const r = await dialog.showOpenDialog(win, {
        title: 'Pilih induk folder hasil kompresi',
        properties: ['openDirectory', 'createDirectory'],
      });
      return r.canceled ? null : r.filePaths[0];
    },
    revealFolder: (p) => shell.openPath(p),
  });
  for (const [name, method] of [
    ['begin', 'begin'],
    ['write', 'write'],
    ['finish', 'finish'],
    ['reveal', 'reveal'],
  ])
    ipcMain.handle('ditasha:compressor-' + name, (event, value) => {
      trusted(event);
      return service[method](value);
    });
  return service;
}
module.exports = {
  createCompressor,
  safeRelative,
  LIMIT_BYTES,
  LIMIT_FILES,
  LIMIT_YTD,
  registerAssetCompressor,
};
