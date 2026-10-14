import test from 'node:test';
import assert from 'node:assert/strict';
import { Resource, readYdd, readYtd, writeYtd, readYft } from '../src/resource.js';
import { viewerModel } from './viewer-format.test.mjs';
import { fragmentYft } from './vehicle-preview.test.mjs';
import { maskResourceGeometry } from '../src/vehicle-resource.js';
import { createSlots, slotRect } from '../src/livery.js';
import { previewRatio, qualityProfiles } from '../src/performance.js';
import { performResourceJob, reviveResource } from '../src/resource-jobs.js';
import { createYtd } from '../src/asset-tools.js';
test('Native visual masking preserves all bytes except selected index ranges and round trips', () => {
  const before = new Resource(viewerModel, 165),
    original = before.bytes.slice();
  const [d] = readYdd(viewerModel),
    selected = d.lods[0].geometries;
  const out = maskResourceGeometry(
    viewerModel,
    selected.map((g) => g.sourceGeometry),
    'ydd',
  );
  const after = new Resource(out.buffer, 165),
    index = selected[0].indexOffset;
  assert.deepEqual(after.header, before.header);
  assert.equal(after.bytes.length, before.bytes.length);
  for (let i = 0; i < after.bytes.length; i++)
    assert.equal(after.bytes[i], i >= index && i < index + 6 ? 0 : original[i]);
  assert.deepEqual(new Resource(viewerModel, 165).bytes, original, 'Input must remain untouched');
  const parsed = readYdd(out.buffer)[0];
  assert.ok(parsed.lods[0].geometries.every((g) => g.indices.every((i) => i === 0)));
  assert.deepEqual([...parsed.lods[1].geometries[0].indices], [0, 1, 2]);
});
test('Native masking refuses partial shared buffers and unknown geometry', () => {
  const [d] = readYdd(viewerModel);
  assert.throws(
    () => maskResourceGeometry(viewerModel, [d.geometries[0].sourceGeometry], 'ydd'),
    /berbagi/,
  );
  assert.throws(() => maskResourceGeometry(viewerModel, [999999], 'ydd'), /tidak cocok/);
  assert.throws(() => maskResourceGeometry(viewerModel, [], 'ydd'), /minimal/);
  assert.throws(() => maskResourceGeometry(viewerModel, [1], 'glb'), /tidak valid/);
});
test('Worker resource hydration retains pointer methods required for editable YTD exports', () => {
  const bytes = createYtd([{ name: 'livery', w: 2, h: 2, out: new Uint8Array(16).fill(255) }]);
  const data = reviveResource('ytd', structuredClone(performResourceJob('ytd', bytes.buffer)));
  data.textures[0].out[0] = 25;
  const decoded = readYtd(writeYtd(data, data.textures).buffer);
  assert.equal(decoded.textures[0].out[0], 25);
  assert.equal(decoded.textures[0].out[1], 255);
  assert.throws(() => performResourceJob('unknown', new ArrayBuffer(32)), /didukung/);
});
test('Livery slot UV rectangles are bounded and never silently cropped', () => {
  const slots = createSlots();
  assert.equal(slots.length, 6);
  for (const s of slots) {
    const r = slotRect(s, 2048, 1024);
    assert.ok(r.x + r.w <= 2048.001);
    assert.ok(r.y + r.h <= 1024.001);
  }
  assert.throws(() => slotRect({ ...slots[0], x: 0.9 }, 1024, 1024), /UV/);
  assert.throws(() => slotRect({ ...slots[0], w: NaN }, 1024, 1024), /UV/);
});
test('Preview resolution is bounded on high-DPI displays and eco mode reduces the load', () => {
  for (const name of Object.keys(qualityProfiles)) {
    const ratio = previewRatio(name, 3840, 2160, 3);
    assert.ok(3840 * 2160 * ratio * ratio <= qualityProfiles[name].pixels + 1);
  }
  assert.ok(previewRatio('eco', 1920, 1080, 2) < previewRatio('high', 1920, 1080, 2));
  assert.equal(previewRatio('balanced', 800, 600, 1), 1);
});

test('YFT masking retains fragment layout and inherited materials after re-opening', () => {
  const input = fragmentYft(),
    parsed = readYft(input);
  const hidden = parsed.flatMap((d) =>
    d.lods.flatMap((l) => l.geometries.map((g) => g.sourceGeometry)),
  );
  const output = maskResourceGeometry(input, hidden, 'yft');
  const result = readYft(output.buffer);
  assert.equal(result.length, parsed.length);
  assert.ok(result.every((d) => d.geometries.every((g) => g.indices.every((i) => i === 0))));
  assert.deepEqual(
    result.map((d) => d.geometries[0].diffuseTexture),
    parsed.map((d) => d.geometries[0].diffuseTexture),
  );
});
