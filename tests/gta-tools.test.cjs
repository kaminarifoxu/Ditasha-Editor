'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { createHash } = require('node:crypto');
const {
  command,
  createGtaTools,
  execute,
  registerGtaTools,
  SPECS,
} = require('../electron/gta-tools.cjs');
const sha = (b) => createHash('sha256').update(b).digest('hex');
async function fixture(t, customRun) {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'ditasha-gta-tools-'));
  t.after(() => fs.rm(temp, { recursive: true, force: true }));
  const archive = Buffer.from('verified archive fixture'),
    exe = Buffer.from('verified executable fixture');
  const spec = {
    name: 'Test Weapons',
    version: '2',
    folder: 'Engine',
    gui: 'gui.exe',
    cli: 'cli.exe',
    bytes: archive.length,
    sha256: sha(archive),
    files: { 'gui.exe': sha(exe), 'cli.exe': sha(exe) },
    archive: 'zip',
    url: 'https://example.invalid/pinned.zip',
  };
  const calls = [];
  const run = async (file, args, options) => {
    calls.push({ file, args, options });
    if (file === 'tar.exe') {
      const dir = path.join(args[3], 'Engine');
      await fs.mkdir(dir);
      for (const n of ['gui.exe', 'cli.exe']) await fs.writeFile(path.join(dir, n), exe);
      return '';
    }
    if (args[0] === '--help') return 'help';
    if (customRun) return customRun(file, args, options);
    options.log('actual engine result\n');
    return '{}';
  };
  const tools = createGtaTools({
    root: path.join(temp, 'tools'),
    platform: 'win32',
    specs: { weapons: spec },
    run,
  });
  const file = path.join(temp, 'package.zip');
  await fs.writeFile(file, archive);
  const source = path.join(temp, 'source'),
    out = path.join(temp, 'out');
  await fs.mkdir(source);
  await fs.mkdir(out);
  await fs.writeFile(path.join(source, 'keep.bin'), 'unchanged');
  return { temp, tools, file, source, out, calls, exe, spec };
}

test('CLI commands preserve literal values and only export to explicit output folders', () => {
  assert.deepEqual(command('weapons', 'scan', {}, 'source', 'out', 'root'), [
    'scan',
    path.join('root', 'data', 'templates'),
    'source',
  ]);
  const args = command(
    'weapons',
    'build',
    { name: 'My weapon & thing', price: 0, edition: 'enhanced', model: 'new_pistol' },
    'source',
    'out',
    'root',
  );
  assert(args.includes('My weapon & thing'));
  assert(args.includes('enhanced'));
  assert(args.includes('0'));
  assert(!args.includes('--install-game-dir'));
  assert.deepEqual(
    command('moddrop', 'clothing', { female: true, name: 'clothes' }, 'source', 'out', 'root'),
    ['build-clothing', 'source', 'out', '--edition', 'legacy', '--name', 'clothes', '--female'],
  );
  for (const action of ['vehicle', 'ped', 'prop', 'clothing'])
    assert.equal(
      command('moddrop', action, { base: 'adder' }, 'src', 'out', 'root')[0],
      'build-' + action,
    );
  for (const [id, action, value] of [
    ['weapons', 'install', {}],
    ['moddrop', 'install', {}],
    ['weapons', 'build', { price: -1 }],
    ['weapons', 'build', { edition: 'invalid' }],
    ['weapons', 'build', { model: '--bad' }],
    ['moddrop', 'vehicle', {}],
    ['trium', 'build', {}],
  ])
    assert.throws(() => command(id, action, value, 'src', 'out', 'root'));
});

test('Verified package installation and builds preserve inputs, use unique outputs and reject source nesting', async (t) => {
  const f = await fixture(t);
  await f.tools.install('weapons', f.file);
  assert.equal((await f.tools.state()).tools[0].installed, true);
  const scan = await f.tools.run('weapons', 'scan', {}, f.source, null);
  assert.equal(scan.output, null);
  const a = await f.tools.run('weapons', 'build', {}, f.source, f.out),
    b = await f.tools.run('weapons', 'build', {}, f.source, f.out);
  assert.notEqual(a.output, b.output);
  assert.equal((await fs.readFile(path.join(f.source, 'keep.bin'))).toString(), 'unchanged');
  assert.equal(
    JSON.parse(await fs.readFile(path.join(a.output, 'ditasha-tool-report.json'))).success,
    true,
  );
  await assert.rejects(
    f.tools.run('weapons', 'build', {}, f.source, f.source),
    /luar folder sumber/,
  );
  const child = path.join(f.source, 'nested');
  await fs.mkdir(child);
  await assert.rejects(f.tools.run('weapons', 'build', {}, f.source, child), /luar folder sumber/);
  assert(f.calls.every((c) => !c.args.includes('--install-game-dir')));
});

test('Package mismatch never extracts or replaces a working installation; runtime tampering blocks execution', async (t) => {
  const f = await fixture(t);
  await f.tools.install('weapons', f.file);
  const before = f.calls.length;
  await fs.writeFile(f.file, Buffer.from('invalid archive fixture!'));
  await assert.rejects(f.tools.install('weapons', f.file), /Ukuran|Paket/);
  assert.equal(f.calls.length, before);
  assert.equal((await f.tools.state()).tools[0].installed, true);
  await fs.writeFile(
    path.join(f.temp, 'tools', 'weapons', 'current', 'Engine', 'cli.exe'),
    'changed',
  );
  await assert.rejects(f.tools.run('weapons', 'scan', {}, f.source, null), /Checksum/);
  assert.equal(f.calls.length, before);
  await assert.rejects(f.tools.install('__proto__', f.file), /tidak dikenal/);
});

test('Cancellation terminates the active command, releases the busy state and records failed output', async (t) => {
  let started;
  const ready = new Promise((r) => (started = r));
  const f = await fixture(t, async (_file, _args, { signal }) => {
    started();
    await new Promise((_r, reject) =>
      signal.addEventListener('abort', () => reject(Error('cancelled')), { once: true }),
    );
  });
  await f.tools.install('weapons', f.file);
  const running = f.tools.run('weapons', 'build', {}, f.source, f.out);
  await ready;
  await assert.rejects(f.tools.run('weapons', 'scan', {}, f.source, null), /proses aktif/);
  f.tools.cancel();
  await assert.rejects(running, /cancelled/);
  const state = await f.tools.state();
  assert.equal(state.busy, false);
  assert.equal(state.result.success, false);
  assert.equal(
    JSON.parse(await fs.readFile(path.join(state.result.output, 'ditasha-tool-report.json')))
      .success,
    false,
  );
});

test('Process invocation uses argument arrays, propagates failures and can be aborted', async () => {
  const literal = 'space & $(echo bad) ; `no`';
  const out = await execute(process.execPath, ['-e', 'console.log(process.argv[1])', literal]);
  assert.equal(out.trim(), literal);
  await assert.rejects(execute(process.execPath, ['-e', 'process.exit(7)']), /kode 7/);
  const controller = new AbortController();
  const p = execute(process.execPath, ['-e', 'setInterval(()=>{},1000)'], {
    signal: controller.signal,
  });
  controller.abort();
  await assert.rejects(p);
});

test('Every desktop tool IPC handler enforces the trusted renderer before doing work', async () => {
  const handlers = new Map();
  let checks = 0;
  registerGtaTools({
    app: { getPath: () => os.tmpdir() },
    ipcMain: { handle: (n, f) => handlers.set(n, f) },
    dialog: {},
    win: {},
    shell: {},
    trusted: () => {
      checks++;
      throw Error('untrusted');
    },
  });
  for (const fn of handlers.values()) await assert.rejects(fn({}), /untrusted/);
  assert.equal(checks, handlers.size);
  assert.equal(handlers.size, 7);
  assert.equal(Object.keys(SPECS).length, 2);
  assert.equal(SPECS.weapons.bytes, 66732285);
});
