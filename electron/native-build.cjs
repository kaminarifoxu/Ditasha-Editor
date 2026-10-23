'use strict';
const fs = require('node:fs/promises'),
  path = require('node:path'),
  os = require('node:os');
const { spawn } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const { setupNative, managedEnv } = require('./native-setup.cjs');
const PED_POSES = { rest: 'preview.json', arms: 'preview-arms.json', legs: 'preview-legs.json' };
const PICK_TYPES = {
  engine: { name: 'Blender', extensions: process.platform === 'win32' ? ['exe'] : ['*'] },
  ped: { name: 'Humanoid model', extensions: ['glb', 'fbx', 'obj'] },
  reference: { name: 'Rigged body template', extensions: ['blend'] },
  clip: { name: 'CodeWalker YCD XML', extensions: ['xml'] },
  vehicle: { name: 'Vehicle YFT', extensions: ['yft', 'xml'] },
  donor: { name: 'Siren donor YFT', extensions: ['yft', 'xml'] },
  carcols: { name: 'Donor carcols.meta', extensions: ['meta'] },
  variations: { name: 'Target carvariations.meta', extensions: ['meta'] },
  vehicles: { name: 'Target vehicles.meta', extensions: ['meta'] },
};
function validateJob(payload) {
  if (
    !payload ||
    ![
      'probe',
      'ped',
      'ped_preview',
      'debadge_analyze',
      'debadge',
      'strobo',
      'strobo_preview',
      'parts',
      'parts_preview',
      'garment',
    ].includes(payload.mode)
  )
    throw Error('Mode build tidak valid.');
  if (payload.mode === 'ped' && !/^[a-z][a-z0-9_]{2,31}$/.test(payload.name || ''))
    throw Error('Nama ped: 3–32 huruf kecil/angka/underscore, diawali huruf.');
  if (
    payload.pedOptions !== undefined &&
    (!payload.pedOptions ||
      typeof payload.pedOptions !== 'object' ||
      Array.isArray(payload.pedOptions))
  )
    throw Error('Opsi rig tidak valid.');
  const pedOptions = {
    reference: 'auto',
    height: 0,
    fingers: true,
    face: true,
    handTemplate: true,
    faceTemplate: true,
    headParts: true,
    ...payload.pedOptions,
  };
  if (payload.mode === 'ped') {
    if (
      !['auto', 'mp_m', 'mp_f'].includes(pedOptions.reference) ||
      !Number.isFinite(pedOptions.height) ||
      (pedOptions.height !== 0 && (pedOptions.height < 0.5 || pedOptions.height > 3))
    )
      throw Error('Referensi tubuh tidak valid atau tinggi di luar 0,5–3 meter (0 = otomatis).');
    for (const key of ['fingers', 'face', 'handTemplate', 'faceTemplate', 'headParts'])
      if (typeof pedOptions[key] !== 'boolean')
        throw Error('Opsi rig harus bernilai aktif/nonaktif.');
  }
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
  const maxDistance = payload.maxDistance ?? 0.25;
  if (!Number.isFinite(maxDistance) || maxDistance < 0.005 || maxDistance > 1)
    throw Error('Batas jarak transfer 0,005–1 meter.');
  const clothing = {
    source: 'import',
    body: '',
    lower: 0.45,
    upper: 0.85,
    gap: 0.005,
    color: [0.12, 0.24, 0.45],
    native: false,
    slot: 'mp_m_freemode_01^jbib_000_u',
    ...payload.clothing,
  };
  if (
    payload.mode === 'garment' &&
    ((payload.clothing !== undefined &&
      (!payload.clothing ||
        typeof payload.clothing !== 'object' ||
        Array.isArray(payload.clothing))) ||
      !['import', 'generate'].includes(clothing.source) ||
      typeof clothing.body !== 'string' ||
      clothing.body.length > 128 ||
      !Number.isFinite(clothing.lower) ||
      !Number.isFinite(clothing.upper) ||
      clothing.lower < 0 ||
      clothing.upper > 1 ||
      clothing.lower >= clothing.upper ||
      !Number.isFinite(clothing.gap) ||
      clothing.gap < 0.001 ||
      clothing.gap > 0.05 ||
      !Array.isArray(clothing.color) ||
      clothing.color.length !== 3 ||
      clothing.color.some((v) => !Number.isFinite(v) || v < 0 || v > 1) ||
      typeof clothing.native !== 'boolean' ||
      typeof clothing.slot !== 'string' ||
      clothing.slot.length > 100 ||
      (clothing.native &&
        !/^(?:[a-z0-9_]+\^)?(?:jbib|uppr|lowr|feet|hand|accs|task|decl|hair|berd|teef)_\d{3}_[ur]$/.test(
          clothing.slot,
        )))
  )
    throw Error('Pengaturan generator/slot clothing tidak valid.');
  const useClip = payload.useClip ?? false,
    clipIndex = payload.clipIndex ?? 0;
  if (
    typeof useClip !== 'boolean' ||
    !Number.isInteger(clipIndex) ||
    clipIndex < 0 ||
    clipIndex > 255
  )
    throw Error('Pilihan animasi tidak valid.');
  const rotation = payload.rotation ?? [0, 0, 0];
  if (
    !Array.isArray(rotation) ||
    rotation.length !== 3 ||
    rotation.some((n) => !Number.isFinite(n) || Math.abs(n) > 360)
  )
    throw Error('Rotasi part di luar batas ±360 derajat.');
  const targetBone = payload.targetBone ?? 'chassis';
  if (typeof targetBone !== 'string' || !/^[a-zA-Z0-9_. -]{1,64}$/.test(targetBone))
    throw Error('Nama bone target tidak valid.');
  if (payload.mode === 'parts' && (!selected.length || new Set(selected).size !== selected.length))
    throw Error('Pilih part donor sebelum build.');
  return {
    clothing,
    useClip,
    clipIndex,
    maxDistance,
    rotation,
    targetBone,
    mode: payload.mode,
    name: payload.name,
    selected,
    offset,
    scale,
    sirenId,
    donorSirenId,
    pedOptions: Object.fromEntries(
      ['reference', 'height', 'fingers', 'face', 'handTemplate', 'faceTemplate', 'headParts'].map(
        (k) => [k, pedOptions[k]],
      ),
    ),
  };
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
function registerNativeBuild({ app, ipcMain, dialog, shell, win, trusted, spawnProcess = spawn }) {
  const inputs = new Map();
  let engine = null,
    child = null,
    running = false,
    preview = null,
    reviewFile = null,
    managedRoot = null,
    setupController = null,
    stagedPed = null;
  let sourcePreviewRoot = null;
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
      if (v.managedRoot === path.join(app.getPath('userData'), 'native-tools'))
        managedRoot = v.managedRoot;
    } catch {}
  };
  const cancel = () => {
    setupController?.abort();
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
    if (running) throw Error('Tunggu setup/build selesai.');
    if (['ped', 'reference', 'clip'].includes(kind) && stagedPed)
      throw Error('Simpan atau buang hasil rig sebelumnya dahulu.');
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
    if (kind === 'clip' && (!file.toLowerCase().endsWith('.ycd.xml') || stat.size > 8 * 1024 ** 2))
      throw Error(
        'Pilih CodeWalker .ycd.xml maksimal 8 MB; binary YCD perlu diekspor ke XML dahulu.',
      );
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
      managedRoot = null;
      await fs.mkdir(path.dirname(settings), { recursive: true });
      await fs.writeFile(settings, JSON.stringify({ engine }));
      return { id: 'engine', name: file };
    }
    const id = randomUUID();
    inputs.set(id, { kind, path: file, size: stat.size, mtime: stat.mtimeMs });
    if (kind === 'ped') {
      preview = null;
      reviewFile = null;
      state = {
        status: 'idle',
        message: 'Model sumber dipilih. Periksa sebelum rig.',
        log: '',
        report: null,
        output: null,
      };
    }
    return { id, name: path.basename(file) };
  });
  ipcMain.handle('ditasha:native-setup', async (event) => {
    trusted(event);
    if (running) throw Error('Satu setup/build sudah berjalan.');
    if (stagedPed) throw Error('Simpan atau buang hasil rig dahulu.');
    if (process.platform !== 'win32' || process.arch !== 'x64')
      throw Error(
        'Setup otomatis memerlukan Windows x64. Pilih Blender manual pada platform lain.',
      );
    const root = path.join(app.getPath('userData'), 'native-tools');
    const controller = new AbortController();
    setupController = controller;
    running = true;
    state = {
      status: 'installing',
      message: 'Menyiapkan download engine…',
      log: '',
      report: null,
      output: null,
      progress: null,
    };
    const execute = (executable, args, options = {}) =>
      new Promise((resolve, reject) => {
        if (controller.signal.aborted) return reject(Error('Setup dibatalkan.'));
        let captured = '';
        child = spawn(executable, args, {
          windowsHide: true,
          shell: false,
          stdio: ['ignore', 'pipe', 'pipe'],
          env: options.env || process.env,
        });
        const current = child;
        const append = (chunk) => {
          const text = chunk.toString();
          state.log = (state.log + text).slice(-24000);
          if (options.capture) captured += text;
        };
        current.stdout.on('data', append);
        current.stderr.on('data', append);
        const timeout = setTimeout(
          () => {
            cancel();
          },
          20 * 60 * 1000,
        );
        current.once('error', (error) => {
          clearTimeout(timeout);
          child = null;
          reject(error);
        });
        current.once('close', (code) => {
          clearTimeout(timeout);
          child = null;
          if (controller.signal.aborted)
            reject(Error('Setup dibatalkan. Klik Download & set up untuk mencoba lagi.'));
          else if (code !== 0)
            reject(Error('Setup engine keluar dengan kode ' + code + '. Periksa Log engine.'));
          else resolve(captured);
        });
      });
    setupNative({
      root,
      signal: controller.signal,
      update: (value) => Object.assign(state, value),
      execute,
    })
      .then(async (selected) => {
        controller.signal.throwIfAborted();
        await fs.writeFile(settings, JSON.stringify({ engine: selected, managedRoot: root }));
        engine = selected;
        managedRoot = root;
        state.status = 'success';
        state.message =
          'Engine terpasang. Pilih model humanoid, nama ped dan Folder hasil, lalu Build native.';
      })
      .catch((error) => {
        state.status = 'error';
        state.message = controller.signal.aborted
          ? 'Setup dibatalkan. Download yang selesai akan digunakan lagi saat mencoba ulang.'
          : error.message;
      })
      .finally(() => {
        running = false;
        setupController = null;
        state.progress = null;
      });
    return { ...state, running, engine: engine ? path.basename(engine) : null };
  });
  ipcMain.handle('ditasha:native-preview', async (event, id, pose = 'rest') => {
    trusted(event);
    if (!preview || preview.id !== id) throw Error('Preview kedaluwarsa; muat ulang preview.');
    if (!Object.hasOwn(PED_POSES, pose) || (pose !== 'rest' && !preview.poses?.includes(pose)))
      throw Error('Pose preview tidak tersedia.');
    const file = path.join(path.dirname(preview.path), PED_POSES[pose]);
    const stat = await fs.stat(file);
    if (stat.size > 48 * 1024 * 1024) throw Error('Preview melebihi batas 48 MB.');
    return JSON.parse(await fs.readFile(file, 'utf8'));
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
  ipcMain.handle('ditasha:native-discard', async (event, id) => {
    trusted(event);
    if (running || !stagedPed || stagedPed.id !== id)
      throw Error('Hasil sementara tidak tersedia.');
    await fs.rm(stagedPed.root, { recursive: true, force: true });
    stagedPed = null;
    preview = null;
    reviewFile = null;
    state = {
      status: 'idle',
      message: 'Hasil sementara dibuang.',
      log: '',
      report: null,
      output: null,
    };
    return true;
  });
  ipcMain.handle('ditasha:native-save', async (event, id) => {
    trusted(event);
    if (running || !stagedPed || stagedPed.id !== id || !preview)
      throw Error('Buat preview rig dahulu.');
    const choice = await dialog.showOpenDialog(win, {
      title: 'Simpan hasil rig / clothing',
      properties: ['openDirectory', 'createDirectory'],
    });
    if (choice.canceled || !choice.filePaths[0]) return false;
    const pending = stagedPed;
    running = true;
    let destination;
    try {
      destination = await fs.mkdtemp(
        path.join(
          choice.filePaths[0],
          pending.kind === 'garment' ? 'ditasha-clothing-' : 'ditasha-ped-',
        ),
      );
      for (const entry of await fs.readdir(pending.output))
        await fs.cp(path.join(pending.output, entry), path.join(destination, entry), {
          recursive: true,
          errorOnExist: true,
          force: false,
        });
      preview.path = path.join(destination, 'preview.json');
      if (reviewFile) reviewFile.path = path.join(destination, 'ditasha-result.blend');
      state.output = destination;
      delete state.stagedId;
      state.message =
        pending.kind === 'garment'
          ? 'Hasil clothing dan report disimpan. Periksa format ekspor dan slot pada report.'
          : 'Resource ped disimpan. Uji spawn dan animasi pada server FiveM.';
      stagedPed = null;
      await fs.rm(pending.root, { recursive: true, force: true }).catch(() => {});
      return true;
    } catch (error) {
      if (destination) await fs.rm(destination, { recursive: true, force: true }).catch(() => {});
      throw error;
    } finally {
      running = false;
    }
  });
  ipcMain.handle('ditasha:native-reveal', async (event) => {
    trusted(event);
    if (state.output) await shell.openPath(state.output);
    return true;
  });
  ipcMain.handle('ditasha:native-save-review', async (event, id) => {
    trusted(event);
    if (running || !reviewFile || reviewFile.id !== id)
      throw Error('Proyek koreksi tidak tersedia.');
    const source = reviewFile.path;
    const stat = await fs.stat(source);
    if (!stat.isFile() || stat.size > 1024 * 1024 * 1024)
      throw Error('Proyek koreksi melebihi 1 GB.');
    const choice = await dialog.showSaveDialog(win, {
      title: 'Salin proyek Blender untuk koreksi',
      defaultPath: 'ditasha-ped-review.blend',
      filters: [{ name: 'Blender project', extensions: ['blend'] }],
    });
    if (choice.canceled || !choice.filePath) return false;
    if (path.extname(choice.filePath).toLowerCase() !== '.blend')
      throw Error('Gunakan ekstensi .blend.');
    if (running || !reviewFile || reviewFile.id !== id || reviewFile.path !== source)
      throw Error('Proyek koreksi berubah; coba lagi.');
    running = true;
    try {
      if (path.resolve(source) !== path.resolve(choice.filePath))
        await fs.copyFile(source, choice.filePath);
      return true;
    } finally {
      running = false;
    }
  });
  ipcMain.handle('ditasha:native-start', async (event, payload) => {
    trusted(event);
    if (running) throw Error('Satu build sudah berjalan.');
    if (stagedPed) throw Error('Simpan atau buang hasil rig sebelumnya dahulu.');
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
    if (job.mode === 'garment' && job.clothing.source === 'generate') job.source = null;
    else if (['ped', 'ped_preview', 'garment'].includes(job.mode)) job.source = await get('ped');
    else if (job.mode !== 'probe') job.source = await get('vehicle');
    if (job.mode === 'garment') job.reference = await get('reference');
    if (job.useClip && ['ped', 'garment'].includes(job.mode)) job.clip = await get('clip');
    if (['strobo_preview', 'parts_preview', 'parts'].includes(job.mode))
      job.donor = await get('donor');
    if (job.mode === 'strobo')
      for (const kind of ['donor', 'carcols', 'variations', 'vehicles'])
        job[kind] = await get(kind);
    if (sourcePreviewRoot) {
      await fs.rm(sourcePreviewRoot, { recursive: true, force: true }).catch(() => {});
      sourcePreviewRoot = null;
    }
    const base = [
      'probe',
      'ped',
      'ped_preview',
      'debadge_analyze',
      'strobo_preview',
      'parts_preview',
      'garment',
    ].includes(job.mode)
      ? os.tmpdir()
      : await get('output');
    const root = await fs.mkdtemp(path.join(base, 'ditasha-build-'));
    if (job.mode === 'ped_preview') sourcePreviewRoot = root;
    job.output = path.join(root, 'output');
    await fs.mkdir(job.output);
    const script = path.join(root, 'native_bridge.py'),
      spec = path.join(root, 'job.json');
    await fs.writeFile(script, await fs.readFile(path.join(__dirname, 'native_bridge.py')));
    await fs.writeFile(
      path.join(root, 'ped_review.py'),
      await fs.readFile(path.join(__dirname, 'ped_review.py')),
    );
    await fs.copyFile(path.join(__dirname, 'garment_skin.py'), path.join(root, 'garment_skin.py'));
    for (const name of ['clothing_workflow.py', 'clip_review.py', 'native_dds.py'])
      await fs.copyFile(path.join(__dirname, name), path.join(root, name));
    await fs.writeFile(spec, JSON.stringify(job));
    preview = null;
    reviewFile = null;
    state = {
      status: 'running',
      message: 'Menjalankan Blender…',
      log: '',
      report: null,
      output: ['probe', 'ped', 'ped_preview', 'garment'].includes(job.mode) ? null : root,
      cancelled: false,
    };
    running = true;
    const executable = engine;
    try {
      child = spawnProcess(executable, blenderArgs(script, spec), {
        cwd: root,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: false,
        env: managedRoot ? managedEnv(managedRoot) : { ...process.env, PYTHONUNBUFFERED: '1' },
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
        reviewFile = null;
        if (['ped', 'garment'].includes(job.mode)) {
          const project = path.join(job.output, 'ditasha-result.blend');
          const projectStat = await fs.stat(project).catch(() => null);
          if (projectStat?.isFile() && projectStat.size <= 1024 * 1024 * 1024) {
            reviewFile = { id: randomUUID(), path: project };
            state.reviewId = reviewFile.id;
          }
        }
        if (rep.ok && rep.preview && !error && !state.cancelled) {
          const previewPath = path.join(job.output, 'preview.json');
          if ((await fs.stat(previewPath)).size > 48 * 1024 * 1024)
            throw Error('Preview terlalu besar.');
          preview = {
            id: randomUUID(),
            path: previewPath,
            poses: ['ped', 'garment'].includes(job.mode)
              ? (rep.preview.poses || [])
                  .map((p) => p.id)
                  .filter((p) => Object.hasOwn(PED_POSES, p))
              : [],
          };
          state.previewId = preview.id;
        }
        if (['ped', 'garment'].includes(job.mode) && rep.ok && !error && !state.cancelled) {
          if (!state.previewId) throw Error('Engine tidak menghasilkan preview ped.');
          stagedPed = { id: randomUUID(), root, output: job.output, kind: job.mode };
          state.stagedId = stagedPed.id;
        }
        state.status = rep.ok && !error && !state.cancelled ? 'success' : 'error';
        state.message = state.cancelled
          ? 'Build dibatalkan; hasil parsial jangan dipakai.'
          : rep.error ||
            error ||
            (job.mode === 'ped_preview'
              ? 'Model sumber siap diperiksa. Belum ada proses rig atau ekspor game.'
              : ['ped', 'garment'].includes(job.mode)
                ? 'Preview rig siap. Periksa model 3D, lalu Simpan hasil ped.'
                : 'Proses selesai. Periksa report dan hasil sebelum dipakai di game.');
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
