import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { parsePropModel } from '../src/creators/prop-workspace.js';

test('Prop Creator imports a standalone OBJ mesh without Texture & Model state', async () => {
  const obj = [
    'o testcrate',
    'v 0 0 0', 'v 1 0 0', 'v 0 1 0', 'vt 0 0', 'vt 1 0', 'vt 0 1',
    'f 1/1 2/2 3/3',
  ].join('\n');
  const file = {
    name: 'testcrate.obj',
    size: Buffer.byteLength(obj),
    async arrayBuffer() { return Uint8Array.from(Buffer.from(obj)).buffer; },
  };
  const result = await parsePropModel(file);
  assert.ok(result?.isObject3D);
  let meshes = 0;
  result.traverse(o => { if (o.isMesh) meshes += 1; });
  assert.equal(meshes, 1);
});
test('Prop Creator restricts imports and retains unmodified editor route', async () => {
  await assert.rejects(parsePropModel({ name: 'bad.exe', size: 3 }), /GLB, OBJ or FBX/);
  await assert.rejects(parsePropModel({ name: 'large.obj', size: 300 * 1024 * 1024 }), /256 MB/);
  const [app, tools, entry, stylesheet] = await Promise.all([
    fs.readFile(new URL('../src/app.js', import.meta.url), 'utf8'),
    fs.readFile(new URL('../src/tools-ui.js', import.meta.url), 'utf8'),
    fs.readFile(new URL('../src/creators/prop-entry.js', import.meta.url), 'utf8'),
    fs.readFile(new URL('../ui/prop-creator.css', import.meta.url), 'utf8'),
  ]);
  assert.match(app, /register:\s*tools\.registerExternalWorkspace/);
  assert.match(app, /tools\.activate\('propcreator'\)/);
  assert.doesNotMatch(entry, /activate\('editor'\)/);
  assert.match(tools, /editor\.hidden = next !== 'editor'/);
  assert.match(stylesheet, /prop-creator-workspace/);
  assert.match(stylesheet, /prop-viewport/);
});
