'use strict';
const path = require('node:path');
const INPUT_FORMATS = Object.freeze(['glb', 'obj', 'fbx']);
const COLLISION_MODES = Object.freeze(['none', 'box', 'convex', 'authored']);
const REQUIRED_NATIVE_FEATURES = Object.freeze(['drawableWriter', 'collisionWriter', 'archetypeWriter']);
const TOKEN_RE = /^[a-f0-9-]{16,64}$/i;
const NAME_RE = /^[a-z][a-z0-9_]{2,47}$/;
function validateAssetToken(token) {
  if (typeof token !== 'string' || !TOKEN_RE.test(token)) throw Error('Invalid asset token');
  return token;
}
function validatePropRequest(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('Invalid prop request');
  const allowed = new Set(['schemaVersion', 'sourceToken', 'outputToken', 'projectName', 'sourceName', 'edition', 'collision', 'drawDistance', 'lodDistances', 'scale']);
  if (Object.keys(value).some(k => !allowed.has(k))) throw Error('Unsupported prop setting');
  if (value.schemaVersion !== 1) throw Error('Unsupported prop schema version');
  const sourceToken = validateAssetToken(value.sourceToken);
  const outputToken = validateAssetToken(value.outputToken);
  const projectName = value.projectName;
  if (typeof projectName !== 'string' || !NAME_RE.test(projectName) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/.test(projectName)) throw Error('Invalid prop project name');
  if (value.edition !== 'legacy') throw Error('Only Legacy output is supported');
  if (typeof value.sourceName !== 'string' || value.sourceName.length > 255 || value.sourceName.includes('/') || value.sourceName.includes('\\')) throw Error('Invalid source filename');
  const ext = path.extname(value.sourceName).slice(1).toLowerCase();
  if (!INPUT_FORMATS.includes(ext)) throw Error('Unsupported prop input format');
  const collision = value.collision;
  if (!COLLISION_MODES.includes(collision)) throw Error('Unsupported collision mode');
  const drawDistance = value.drawDistance;
  if (typeof drawDistance !== 'number' || !Number.isFinite(drawDistance) || drawDistance < 1 || drawDistance > 2000) throw Error('Invalid draw distance');
  const scale = value.scale ?? [1, 1, 1];
  if (!Array.isArray(scale) || scale.length !== 3 ||
      scale.some(v => typeof v !== 'number' || !Number.isFinite(v) || v < 0.01 || v > 100))
    throw Error('Invalid prop scale (each axis must be 0.01 to 100)');
  const lodDistances = value.lodDistances ?? [];
  if (!Array.isArray(lodDistances) || lodDistances.length > 4 || lodDistances.some(v => typeof v !== 'number' || !Number.isFinite(v) || v < 1 || v > drawDistance)) throw Error('Invalid LOD distances');
  if (lodDistances.some((v,i) => i > 0 && v <= lodDistances[i - 1])) throw Error('LOD distances must increase');
  return Object.freeze({ schemaVersion: 1, sourceToken, outputToken, projectName, sourceName: value.sourceName, format: ext, edition: 'legacy', collision, drawDistance, lodDistances: Object.freeze([...lodDistances]), scale: Object.freeze([...scale]) });
}
function probePropCapabilities(provider) {
  // This is provider negotiation, not a claim that native exporters already exist.
  const status = {};
  for (const feature of REQUIRED_NATIVE_FEATURES) status[feature] = provider?.[feature] === true;
  status.importer = Array.isArray(provider?.importers) && INPUT_FORMATS.every(ext => provider.importers.includes(ext));
  const ready = Object.values(status).every(Boolean);
  return Object.freeze({ ready, ...status });
}
function resolvePropInput(request, tokenResolver) {
  const schema = validatePropRequest(request);
  if (typeof tokenResolver !== 'function') throw Error('Asset token resolver missing');
  const input = tokenResolver(schema.sourceToken);
  const output = tokenResolver(schema.outputToken);
  if (!input || input.kind !== 'input' || !output || output.kind !== 'output') throw Error('Unrecognized asset token or wrong scope');
  if (path.basename(input.path).toLowerCase() !== schema.sourceName.toLowerCase()) throw Error('Source token does not match input file');
  return Object.freeze({ request: schema, inputPath: input.path, outputDirectory: output.path });
}
module.exports = { INPUT_FORMATS, COLLISION_MODES, REQUIRED_NATIVE_FEATURES, validateAssetToken, validatePropRequest, probePropCapabilities, resolvePropInput };
