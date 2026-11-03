'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const { runNativeProcess } = require('./native-process.cjs');
const { managedEnv } = require('../native-setup.cjs');
const { probePropCapabilities } = require('./prop-schema.cjs');
const PROBE_MARKER = 'DITASHA_PROP_PROBE=';
function extractProbe(log) {
  if (typeof log !== 'string' || log.length > 2 * 1024 * 1024) throw Error('Invalid native probe log');
  const matches = log.split(/\r?\n/).filter(l => l.startsWith(PROBE_MARKER));
  if (matches.length !== 1) throw Error('Native probe report missing or ambiguous');
  const data = JSON.parse(matches[0].slice(PROBE_MARKER.length));
  if (data.schema !== 1 || !Array.isArray(data.blenderVersion) || data.blenderVersion.length !== 3 ||
      data.blenderVersion.some(n => !Number.isInteger(n)) ||
      !Array.isArray(data.importers) || data.importers.some(i => !['glb','obj','fbx'].includes(i)) ||
      typeof data.sollumzLoaded !== 'boolean')
    throw Error('Invalid native probe schema');
  return data;
}
async function probeInstalledPropProvider({ root, script, signal, runner = runNativeProcess } = {}) {
  if (typeof root !== 'string' || !path.isAbsolute(root)) throw Error('Native provider root not approved');
  if (typeof script !== 'string' || !path.isAbsolute(script)) throw Error('Native probe path not approved');
  const installedRoot = await fs.realpath(root);
  const manifest = JSON.parse(await fs.readFile(path.join(installedRoot, 'ready.json'), 'utf8'));
  const blender = await fs.realpath(manifest.engine);
  if (!blender.startsWith(installedRoot + path.sep) || path.basename(blender).toLowerCase() !== 'blender.exe')
    throw Error('Blender executable outside verified native installation');
  if (manifest.version !== 1) throw Error('Unsupported managed native installation');
  const result = await runner({
    executable: blender, args: ['--background','--disable-autoexec','--python-exit-code','2','--python',script],
    cwd: installedRoot, signal, timeoutMs: 30 * 1000, maxOutputBytes: 128 * 1024,
    env: managedEnv(installedRoot),
  });
  const info = extractProbe(result.log);
  // Availability cannot be inferred from an installed addon. Until native YDR,
  // YBN and YTYP round-trip fixtures pass, all export writers are false.
  const status = probePropCapabilities({
    importers: info.importers,
    drawableWriter: false,
    collisionWriter: false,
    archetypeWriter: false,
  });
  return Object.freeze({
    ...status,
    blenderVersion: info.blenderVersion.join('.'),
    sollumzLoaded: info.sollumzLoaded,
    reason: 'Native exporters require separate verified fixture round trips',
  });
}
module.exports = { extractProbe, probeInstalledPropProvider };
