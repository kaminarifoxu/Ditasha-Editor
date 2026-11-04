'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { managedEnv } = require('../native-setup.cjs');
const { runNativeProcess, cleanupStaging } = require('./native-process.cjs');
const { validatePropRequest } = require('./prop-schema.cjs');
const { validateArtifacts, commitExport } = require('./export-validation.cjs');

function nativeAssets(name, collision) {
  const names = [name + '.ydr', name + '.ytd', name + '.ytyp'];
  if (collision !== 'none') names.push(name + '_col.ybn');
  return names.map(filename => 'stream/' + filename);
}
function createPropManifest(name) {
  if (!/^[a-z][a-z0-9_]{2,47}$/.test(name)) throw Error('Unsafe FiveM resource name');
  return [
    "fx_version 'cerulean'",
    "game 'gta5'",
    "author 'Ditasha-Workshop'",
    "files { 'stream/" + name + ".ytyp' }",
    "data_file 'DLC_ITYP_REQUEST' 'stream/" + name + ".ytyp'",
    '',
  ].join('\n');
}
async function managedExecutable(root) {
  if (typeof root !== 'string' || !path.isAbsolute(root)) throw Error('Managed engine root required');
  const realRoot = await fs.realpath(root);
  const ready = JSON.parse(await fs.readFile(path.join(realRoot, 'ready.json'), 'utf8'));
  if (ready.version !== 1 || typeof ready.engine !== 'string') throw Error('Invalid managed native installation');
  const engine = await fs.realpath(ready.engine);
  if (!engine.toLowerCase().startsWith((realRoot + path.sep).toLowerCase()) ||
      path.basename(engine).toLowerCase() !== 'blender.exe' ||
      !(await fs.stat(engine)).isFile()) throw Error('Untrusted native engine');
  return { engine, root: realRoot };
}
async function validateNativeReport(staging, spec) {
  const file = path.join(staging, 'native-report.json');
  const report = JSON.parse(await fs.readFile(file, 'utf8'));
  if (report.schema !== 1 || report.ok !== true || report.roundTrip !== true ||
      !Array.isArray(report.assets) || report.assets.length !== nativeAssets(spec.projectName, spec.collision).length)
    throw Error('Unverified native conversion report');
  const expected = nativeAssets(spec.projectName, spec.collision);
  if (new Set(report.assets.map(a => a.relativePath)).size !== expected.length ||
      expected.some(name => !report.assets.some(a => a.relativePath === name)))
    throw Error('Native export has missing or unexpected files');
  const verified = await validateArtifacts(staging, report.assets);
  for (const item of verified) {
    const magic = Buffer.alloc(4);
    const handle = await fs.open(path.join(staging, item.relativePath), 'r');
    try { await handle.read(magic, 0, 4, 0); } finally { await handle.close(); }
    if (magic.toString('ascii') !== 'RSC7') throw Error('Invalid GTA V Legacy native resource signature');
  }
  return verified;
}
async function buildPropResource({
  request, tokens, providerRoot, signal, runner = runNativeProcess,
} = {}) {
  const spec = validatePropRequest(request);
  if (!tokens || typeof tokens.resolve !== 'function') throw Error('Trusted asset grants required');
  // All path input comes from OS-selected, expiring scoped grants.
  const source = await tokens.resolve(spec.sourceToken, 'input');
  const output = await tokens.resolve(spec.outputToken, 'output');
  if (path.basename(source.path).toLowerCase() !== spec.sourceName.toLowerCase())
    throw Error('Selected model no longer matches requested source');
  if (spec.collision === 'authored')
    throw Error('Authored collision export is not supported yet');
  signal?.throwIfAborted();
  const { engine, root } = await managedExecutable(providerRoot);
  const parent = output.path;
  const staging = await fs.mkdtemp(path.join(parent, 'ditasha-stage-'));
  const target = path.join(parent, spec.projectName + '-ditasha-' + randomUUID().slice(0, 8));
  let committed = false;
  try {
    const script = await fs.realpath(path.join(__dirname, 'prop-native.py'));
    const jobFile = path.join(staging, 'prop-job.json');
    await fs.writeFile(jobFile, JSON.stringify({
      schema: 1, edition: spec.edition, source: source.path, name: spec.projectName,
      collision: spec.collision, drawDistance: spec.drawDistance,
      lodDistances: spec.lodDistances,
    }), { flag: 'wx', mode: 0o600 });
    await runner({
      executable: engine, cwd: root, signal, env: managedEnv(root),
      args: ['--background', '--disable-autoexec',
        '--python-exit-code', '2', '--python', script, '--', jobFile],
      timeoutMs: 15 * 60 * 1000, maxOutputBytes: 256 * 1024,
    });
    signal?.throwIfAborted();
    const validated = await validateNativeReport(staging, spec);
    const manifest = createPropManifest(spec.projectName);
    await fs.writeFile(path.join(staging, 'fxmanifest.lua'), manifest, { flag: 'wx' });
    await fs.writeFile(path.join(staging, 'validation.json'), JSON.stringify({
      schema: 1, tool: 'ditasha-prop', edition: 'legacy',
      nativeRoundTripPassed: true, gameTestPassed: null,
      model: spec.projectName, collision: spec.collision,
      files: validated,
    }, null, 2), { flag: 'wx' });
    const artifacts = [
      ...validated,
      { relativePath: 'fxmanifest.lua' },
      { relativePath: 'validation.json' },
      { relativePath: 'native-report.json' },
    ];
    await validateArtifacts(staging, artifacts);
    // Recheck selected scopes after the slow native operation.
    await tokens.resolve(spec.sourceToken, 'input');
    await tokens.resolve(spec.outputToken, 'output');
    signal?.throwIfAborted();
    const result = await commitExport({ stagingRoot: staging, destinationRoot: target, artifacts });
    committed = true;
    return { output: result.output, artifacts: result.artifacts, nativeRoundTripPassed: true, gameTestPassed: null };
  } finally {
    if (!committed) await cleanupStaging(staging, parent);
  }
}
module.exports = { nativeAssets, createPropManifest, managedExecutable, validateNativeReport, buildPropResource };
