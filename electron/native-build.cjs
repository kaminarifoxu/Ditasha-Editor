'use strict';
const fs = require('node:fs/promises'),
  path = require('node:path'),
  os = require('node:os');
const { spawn } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const PICK_TYPES = {
  engine: { name: 'Blender', extensions: process.platform === 'win32' ? ['exe'] : ['*'] },
  ped: { name: 'Humanoid model', extensions: ['glb', 'fbx', 'obj'] },
  vehicle: { name: 'Vehicle YFT', extensions: ['yft', 'xml'] },
  donor: { name: 'Siren donor YFT', extensions: ['yft', 'xml'] },
  carcols: { name: 'Donor carcols.meta', extensions: ['meta'] },
  variations: { name: 'Target carvariations.meta', extensions: ['meta'] },
  vehicles: { name: 'Target vehicles.meta', extensions: ['meta'] },
};
function validateJob(payload) {
  if (
    !payload ||
    !['probe', 'ped', 'debadge_analyze', 'debadge', 'strobo', 'strobo_preview'].includes(
      payload.mode,
    )
  )
    throw Error('Mode build tidak valid.');
  if (payload.mode === 'ped' && !/^[a-z][a-z0-9_]{2,31}$/.test(payload.name || ''))
    throw Error('Nama ped: 3–32 huruf kecil/angka/underscore, diawali huruf.');
  const selected = payload.selected || [];
  if (
    !Array.isArray(selected) ||
    selected.length > 512 ||
    selected.some((s) => typeof s !== 'string' || s.length > 256)
  )
    throw Error('Pilihan badge tidak valid.');
  const offset = payload.offset || [0, 0, 0];
  if (
    !Array.isArray(offset) ||
    offset.length !== 3 ||
    offset.some((n) => !Number.isFinite(n) || Math.abs(n) > 20)
  )
    throw Error('Offset strobo di luar batas ±20 meter.');
  const scale = payload.scale ?? 1;
  if (!Number.isFinite(scale) || scale < 0.1 || scale > 5) throw Error('Scale strobo 0,1–5.');
  const sirenId = payload.sirenId ?? 100;
  if (!Number.isInteger(sirenId) || sirenId < 1 || sirenId > 254)
    throw Error('ID siren harus 1–254.');
  const donorSirenId = payload.donorSirenId ?? 0;
  if (!Number.isInteger(donorSirenId) || donorSirenId < 0 || donorSirenId > 65534)
    throw Error('ID donor 0 (otomatis tunggal) atau 1–65534.');
  return { mode: payload.mode, name: payload.name, selected, offset, scale, sirenId, donorSirenId };
}
function blenderArgs(script, job) {
  return [
    '--background',
    '--disable-autoexec',
    '--python-exit-code',
    '2',
    '--python',
    script,
    '--',
    job,
  ];
}
function registerNativeBuild({ app, ipcMain, dialog, shell, win, trusted }) {
  const inputs = new Map();
  let engine = null,
    child = null,
    running = false,
    preview = null;
  let state = {
    status: 'idle',
    message: 'Pilih Blender dan periksa engine.',
    log: '',
    report: null,
    output: null,
  };
  const settings = path.join(app.getPath('userData'), 'native-engine.json');
  const readSettings = async () => {
    if (engine) return;
    try {
      const v = JSON.parse(await fs.readFile(settings, 'utf8'));
      if (typeof v.engine === 'string' && /^blender(?:\.exe)?$/i.test(path.basename(v.engine)))
        engine = v.engine;
    } catch {}
  };
  const cancel = () => {
    if (!child) return;
    const currentChild = child;
    if (process.platform === 'win32') {
      const killer = spawn(
        path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'taskkill.exe'),
        ['/PID', String(child.pid), '/T', '/F'],
        { windowsHide: true, stdio: 'ignore' },
      );
      killer.on('error', () => currentChild.kill());
    } else child.kill('SIGTERM');
  };
  app.on('before-quit', cancel);
  ipcMain.handle('ditasha:native-state', async (event) => {
    trusted(event);
    await readSettings();
    return { ...state, running, engine: engine ? path.basename(engine) : null };
  });
  ipcMain.handle('ditasha:native-pick', async (event, kind) => {
    trusted(event);
    if (running) throw Error('Tunggu build selesai.');
    if (kind === 'output') {
      const r = await dialog.showOpenDialog(win, {
        title: 'Folder hasil build baru',
        properties: ['openDirectory', 'createDirectory'],
      });
      if (r.canceled) return null;
      const id = randomUUID();
      inputs.set(id, { kind, path: r.filePaths[0] });
      return { id, name: r.filePaths[0] };
    }
    const type = PICK_TYPES[kind];
    if (!type) throw Error('Jenis input tidak valid.');
    const r = await dialog.showOpenDialog(win, {
      title: type.name,
      filters: [type],
      properties: ['openFile'],
    });
    if (r.canceled) return null;
    const file = r.filePaths[0],
      stat = await fs.stat(file);
    if (
      !stat.isFile() ||
      stat.size > (kind === 'ped' ? 256 : kind === 'engine' ? 1024 : 128) * 1024 * 1024
    )
      throw Error('Ukuran/tipe file tidak didukung.');
    if (kind !== 'engine' && !type.extensions.includes(path.extname(file).slice(1).toLowerCase()))
      throw Error('Ekstensi file tidak cocok dengan input.');
    if (kind === 'engine') {
      if (!/^blender(?:\.exe)?$/i.test(path.basename(file)))
        throw Error('Pilih blender.exe, bukan launcher.');
      engine = file;
      await fs.mkdir(path.dirname(settings), { recursive: true });
      await fs.writeFile(settings, JSON.stringify({ engine }));
      return { id: 'engine', name: file };
    }
    const id = randomUUID();
    inputs.set(id, { kind, path: file, size: stat.size, mtime: stat.mtimeMs });
    return { id, name: path.basename(file) };
  });
  ipcMain.handle('ditasha:native-preview', async (event, id) => {
    trusted(event);
    if (!preview || preview.id !== id) throw Error('Preview kedaluwarsa; muat ulang preview.');
    const stat = await fs.stat(preview.path);
    if (stat.size > 48 * 1024 * 1024) throw Error('Preview melebihi batas 48 MB.');
    return JSON.parse(await fs.readFile(preview.path, 'utf8'));
  });
  ipcMain.handle('ditasha:native-doc', async (event, kind) => {
    trusted(event);
    const url = {
      blender: 'https://www.blender.org/download/',
      sollumz: 'https://github.com/Sollumz/Sollumz/releases',
      muto: 'https://github.com/B7Kompirine/muto-ped-rig/releases',
    }[kind];
    if (!url) throw Error('Tautan tidak valid.');
    await shell.openExternal(url);
  });
  ipcMain.handle('ditasha:native-cancel', (event) => {
    trusted(event);
    if (running) {
      state.message = 'Membatalkan proses…';
      state.cancelled = true;
      cancel();
    }
    return true;
  });
  ipcMain.handle('ditasha:native-reveal', async (event) => {
    trusted(event);
    if (state.output) await shell.openPath(state.output);
    return true;
  });
  ipcMain.handle('ditasha:native-start', async (event, payload) => {
    trusted(event);
    if (running) throw Error('Satu build sudah berjalan.');
    await readSettings();
    if (!engine) throw Error('Pilih Blender terlebih dahulu.');
    const job = validateJob(payload),
      get = async (kind) => {
        const v = inputs.get(payload.inputs?.[kind]);
        if (!v || v.kind !== kind) throw Error('Pilih file ' + kind + ' dahulu.');
        const stat = await fs.stat(v.path);
        if (v.size !== undefined && (stat.size !== v.size || stat.mtimeMs !== v.mtime))
          throw Error('Input berubah. Pilih ulang file ' + kind + '.');
        return v.path;
      };
    if (job.mode === 'ped') job.source = await get('ped');
    else if (job.mode !== 'probe') job.source = await get('vehicle');
    if (job.mode === 'strobo_preview') job.donor = await get('donor');
    if (job.mode === 'strobo')
      for (const kind of ['donor', 'carcols', 'variations', 'vehicles'])
        job[kind] = await get(kind);
    const base = ['probe', 'debadge_analyze', 'strobo_preview'].includes(job.mode)
      ? os.tmpdir()
      : await get('output');
    const root = await fs.mkdtemp(path.join(base, 'ditasha-build-'));
    job.output = path.join(root, 'output');
    await fs.mkdir(job.output);
    const script = path.join(root, 'native_bridge.py'),
      spec = path.join(root, 'job.json');
    await fs.writeFile(script, await fs.readFile(path.join(__dirname, 'native_bridge.py')));
    await fs.writeFile(spec, JSON.stringify(job));
    state = {
      status: 'running',
      message: 'Menjalankan Blender…',
      log: '',
      report: null,
      output: job.mode === 'probe' ? null : root,
      cancelled: false,
    };
    running = true;
    const executable = engine;
    try {
      child = spawn(executable, blenderArgs(script, spec), {
        cwd: root,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: false,
        env: { ...process.env, PYTHONUNBUFFERED: '1' },
      });
    } catch (e) {
      running = false;
      state.status = 'error';
      state.message = e.message;
      throw e;
    }
    let settled = false;
    const append = (chunk) => {
      state.log = (state.log + chunk.toString()).slice(-24000);
    };
    child.stdout.on('data', append);
    child.stderr.on('data', append);
    const timer = setTimeout(
      () => {
        state.cancelled = true;
        state.message = 'Build melebihi 15 menit; dihentikan.';
        cancel();
      },
      15 * 60 * 1000,
    );
    const finish = async (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      child = null;
      try {
        const reportFile = path.join(job.output, 'report.json');
        if ((await fs.stat(reportFile)).size > 1024 * 1024)
          throw Error('Report engine terlalu besar.');
        const rep = JSON.parse(await fs.readFile(reportFile, 'utf8'));
        state.report = rep;
        if (rep.ok && rep.preview && !error && !state.cancelled) {
          const previewPath = path.join(job.output, 'preview.json');
          if ((await fs.stat(previewPath)).size > 48 * 1024 * 1024)
            throw Error('Preview terlalu besar.');
          preview = { id: randomUUID(), path: previewPath };
          state.previewId = preview.id;
        }
        state.status = rep.ok && !error && !state.cancelled ? 'success' : 'error';
        state.message = state.cancelled
          ? 'Build dibatalkan; hasil parsial jangan dipakai.'
          : rep.error ||
            error ||
            'Proses selesai. Periksa report dan hasil sebelum dipakai di game.';
      } catch {
        state.status = 'error';
        state.message = error || 'Engine tidak menghasilkan report. Periksa log.';
      }
      if (job.mode === 'probe') await fs.rm(root, { recursive: true, force: true }).catch(() => {});
      running = false;
    };
    child.once('error', (e) => finish(e.message));
    child.once('close', (code) => finish(code === 0 ? null : 'Blender keluar dengan kode ' + code));
    return { ...state, running };
  });
  return { cancel };
}
module.exports = { validateJob, blenderArgs, registerNativeBuild };
