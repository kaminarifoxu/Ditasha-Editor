'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs/promises');
const os = require('node:os');
const { execFileSync } = require('node:child_process');
const {
  nativeAssets, createPropManifest, managedExecutable, validateNativeReport, buildPropResource,
} = require('../electron/creators/prop-build.cjs');
const { createAssetTokens } = require('../electron/creators/asset-tokens.cjs');
const { validatePropRequest } = require('../electron/creators/prop-schema.cjs');

test('M1c Blender worker source compiles on the GitHub Windows test runner', () => {
  const script = path.join(__dirname, '../electron/creators/prop-native.py');
  const cmd = process.platform === 'win32' ? 'python' : 'python3';
  const check = 'import ast, pathlib, sys; ast.parse(pathlib.Path(sys.argv[1]).read_text(encoding="utf-8")); print("PROP_PY_SYNTAX_OK")';
  const log = execFileSync(cmd, ['-c', check, script], { encoding: 'utf8', timeout: 10000 });
  assert.match(log, /PROP_PY_SYNTAX_OK/);
});

test('M1c validates native export names, manifest and required collisions', () => {
  const files = nativeAssets('ditasha_prop', 'box');
  assert.deepEqual(files, [
    'stream/ditasha_prop.ydr',
    'stream/ditasha_prop.ytd',
    'stream/ditasha_prop.ytyp',
    'stream/ditasha_prop_col.ybn',
  ]);
  assert.equal(nativeAssets('ditasha_prop', 'none').includes('stream/ditasha_prop.ybn'), false);
  const fx = createPropManifest('ditasha_prop');
  assert.match(fx, /DLC_ITYP_REQUEST/);
  assert.match(fx, /stream\/ditasha_prop\.ytyp/);
  assert.throws(() => createPropManifest("x'; os.execute('bad')"));
});

async function prepare(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ditasha-m1c-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const nativeRoot = path.join(root, 'native');
  const outputRoot = path.join(root, 'output');
  await fs.mkdir(nativeRoot);
  await fs.mkdir(outputRoot);
  const engine = path.join(nativeRoot, 'blender.exe');
  await fs.writeFile(engine, 'synthetic executable, never launched in stub tests');
  await fs.writeFile(path.join(nativeRoot, 'ready.json'), JSON.stringify({ version: 1, engine }));
  const source = path.join(root, 'crate.glb');
  await fs.writeFile(source, 'synthetic GLB source token fixture');
  const tokens = createAssetTokens();
  const input = await tokens.issue({ kind: 'input', selectedPath: source });
  const output = await tokens.issue({ kind: 'output', selectedPath: outputRoot });
  const request = {
    schemaVersion: 1, sourceToken: input.token, outputToken: output.token,
    projectName: 'ditasha_crate', sourceName: 'crate.glb', edition: 'legacy',
    collision: 'box', drawDistance: 100, lodDistances: [20, 50], scale: [1.5, 0.75, 2],
  };
  return { nativeRoot, outputRoot, source, tokens, request };
}
function simulatedProvider({ fail, reportRoundTrip = true, invalidSignature = false, textureCount = 1, emptyYtd = false } = {}) {
  return async ({ args, executable }) => {
    assert.equal(path.basename(executable).toLowerCase(), 'blender.exe');
    assert.ok(args.includes('--disable-autoexec'));
    assert.ok(!args.includes('--factory-startup'));
    const jobFile = args[args.length - 1];
    const job = JSON.parse(await fs.readFile(jobFile, 'utf8'));
    assert.equal(job.edition, 'legacy');
    assert.deepEqual(job.scale, [1.5, 0.75, 2]);
    assert.equal(await fs.readFile(args[args.indexOf('--python') + 1], 'utf8').then(s=>s.includes('def main')), true);
    assert.match(await fs.readFile(path.join(path.dirname(jobFile), 'prop_dds.py'), 'utf8'), /def encode_dds_rgba/);
    const staging = path.dirname(jobFile);
    const stream = path.join(staging, 'stream');
    await fs.mkdir(stream);
    if (fail) throw Error('Simulated PyMateria export failure');
    const assets = [];
    for (const relativePath of nativeAssets(job.name, job.collision)) {
      const file = path.join(staging, relativePath);
      if (relativePath.endsWith('.ytd') && !emptyYtd && !invalidSignature) {
        const { createYtd } = await import('../src/asset-tools.js');
        const data = createYtd([{ name: 'diffuse_test', w: 4, h: 4, out: new Uint8Array(64).fill(255) }]);
        await fs.writeFile(file, Buffer.from(data));
      } else {
        await fs.writeFile(file, Buffer.concat([Buffer.from(invalidSignature ? 'FAIL' : 'RSC7'), Buffer.alloc(48, 0)]));
      }
      assets.push({ relativePath });
    }
    await fs.writeFile(path.join(staging, 'native-report.json'), JSON.stringify({
      schema: 1, ok: true, roundTrip: reportRoundTrip, textureCount, assets,
    }));
    return { log: 'synthetic provider test' };
  };
}
test('M1c commits a staged, validated FiveM resource without overwriting originals', async t => {
  const f = await prepare(t);
  const selected = validatePropRequest(f.request);
  assert.equal(selected.collision, 'box');
  const installed = await managedExecutable(f.nativeRoot);
  assert.equal(path.basename(installed.engine), 'blender.exe');
  const result = await buildPropResource({
    request: validatePropRequest(f.request), tokens: f.tokens, providerRoot: f.nativeRoot,
    runner: simulatedProvider(),
  });
  assert.equal(result.nativeRoundTripPassed, true);
  assert.equal(JSON.parse(await fs.readFile(path.join(result.output, 'validation.json'), 'utf8')).scale[0], 1.5);
  assert.equal(result.gameTestPassed, null);
  assert.equal((await fs.readFile(path.join(result.output, 'stream/ditasha_crate.ydr'))).subarray(0,4).toString(), 'RSC7');
  assert.match(await fs.readFile(path.join(result.output, 'fxmanifest.lua'), 'utf8'), /DLC_ITYP_REQUEST/);
  assert.equal((await fs.readFile(path.join(result.output, 'validation.json'), 'utf8')).includes('"gameTestPassed": null'), true);
  assert.equal((await fs.readFile(f.source, 'utf8')), 'synthetic GLB source token fixture');
  const names = await fs.readdir(f.outputRoot);
  assert.equal(names.length, 1);
  assert.ok(!names.some(n => n.startsWith('ditasha-stage-')));
});
test('M1c native failure does not commit and cleans only its staging folder', async t => {
  const f = await prepare(t);
  await assert.rejects(buildPropResource({
    request: f.request, tokens: f.tokens, providerRoot: f.nativeRoot,
    runner: simulatedProvider({ fail: true }),
  }), /Simulated PyMateria/);
  assert.deepEqual(await fs.readdir(f.outputRoot), []);
  assert.equal((await fs.readFile(f.source, 'utf8')), 'synthetic GLB source token fixture');
});
test('M1c blocks forged reports, invalid native signatures, and unsupported collision modes', async t => {
  for (const settings of [{ reportRoundTrip: false }, { invalidSignature: true }, { textureCount: 0 }, { emptyYtd: true }]) {
    const f = await prepare(t);
    await assert.rejects(buildPropResource({
      request: f.request, tokens: f.tokens, providerRoot: f.nativeRoot,
      runner: simulatedProvider(settings),
    }), /roundtrip|roundTrip|Unverified|signature|YTD validation|YTD cannot be opened/i);
    assert.deepEqual(await fs.readdir(f.outputRoot), []);
  }
  const f = await prepare(t);
  await assert.rejects(buildPropResource({
    request: { ...f.request, collision: 'authored' }, tokens: f.tokens,
    providerRoot: f.nativeRoot, runner: simulatedProvider(),
  }), /Authored collision/);
});
test('M1c refuses user-provided native executable outside the managed installation', async t => {
  const f = await prepare(t);
  await fs.writeFile(path.join(f.nativeRoot, 'ready.json'), JSON.stringify({ version: 1, engine: process.execPath }));
  await assert.rejects(managedExecutable(f.nativeRoot), /Untrusted native engine/);
});
