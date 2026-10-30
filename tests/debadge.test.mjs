import test from 'node:test';
import assert from 'node:assert/strict';
import { deflateRaw } from 'pako';
import { Resource, readYft } from '../src/resource.js';
import { analyzeDebadge, connectedParts, removeVehicleParts } from '../src/vehicle-debadge.js';
import { viewerModel } from './viewer-format.test.mjs';
export function debadgeFixture() {
  const r = new Resource(viewerModel, 165),
    v = r.v;
  v.setBigUint64(48, 0x50000080n, true);
  v.setUint16(520, 1, true); // One geometry in High.
  v.setBigUint64(128 + 88, 0n, true); // No Medium in this compact fixture.
  const points = [
    [0, 0, 0],
    [1, 0, 0],
    [1, 1, 0],
    [0, 1, 0],
    [3, 0, 0],
    [3.3, 0, 0],
    [3, 0.3, 0],
  ];
  v.setUint32(1408 + 24, points.length, true);
  points.forEach(([x, y, z], i) => {
    const at = 4096 + i * 20;
    v.setFloat32(at, x, true);
    v.setFloat32(at + 4, -z, true);
    v.setFloat32(at + 8, y, true);
    v.setFloat32(at + 12, 0, true);
    v.setFloat32(at + 16, 0, true);
  });
  const indices = [0, 1, 2, 0, 2, 3, 4, 5, 6];
  v.setUint32(1600 + 8, indices.length, true);
  indices.forEach((n, i) => v.setUint16(4096 + 256 + i * 2, n, true));
  const zipped = deflateRaw(r.bytes),
    out = new Uint8Array(16 + zipped.length);
  out.set(r.header);
  new DataView(out.buffer).setUint32(4, 162, true);
  out.set(zipped, 16);
  return out.buffer;
}
test('Position welding connects UV seams but leaves a separate unnamed badge selectable', () => {
  const g = {
    sourceGeometry: 17,
    indexOffset: 123,
    positions: new Float32Array([
      0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 4, 0, 0, 5, 0, 0, 4, 1, 0,
    ]),
    indices: new Uint16Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 0, 0, 0]),
  };
  const parts = connectedParts(g);
  assert.deepEqual(
    parts.map((p) => p.triangles),
    [[0, 1], [2]],
  );
  assert.equal(parts[1].id, '17:2');
});
test('Selected badge changes only its native index bytes; body, shaders, rig data and headers survive', () => {
  const input = debadgeFixture(),
    before = new Resource(input, 162),
    g = analyzeDebadge(input)[0].geometries[0];
  assert.deepEqual(
    g.parts.map((p) => p.triangles),
    [[0, 1], [2]],
  );
  const output = removeVehicleParts(input, [g.parts[1].id]),
    after = new Resource(output.bytes.buffer, 162);
  assert.equal(output.removedTriangles, 1);
  assert.equal(output.removedParts, 1);
  assert.deepEqual(after.header, before.header);
  const changed = [];
  before.bytes.forEach((b, i) => {
    if (b !== after.bytes[i]) changed.push(i);
  });
  assert.deepEqual(changed, [g.indexOffset + 14, g.indexOffset + 16]);
  assert.deepEqual(
    [...readYft(output.bytes.buffer)[0].geometries[0].indices],
    [0, 1, 2, 0, 2, 3, 4, 4, 4],
  );
  assert.deepEqual(
    analyzeDebadge(output.bytes.buffer)[0].geometries[0].parts.map((p) => p.triangles),
    [[0, 1]],
  );
});
test('Unknown selections, blank vehicles and unsafe shared native index buffers are refused', () => {
  const input = debadgeFixture(),
    parts = analyzeDebadge(input)[0].geometries[0].parts;
  assert.throws(() => removeVehicleParts(input, []), /Select/);
  assert.throws(() => removeVehicleParts(input, ['0:0']), /original YFT/);
  assert.throws(
    () =>
      removeVehicleParts(
        input,
        parts.map((p) => p.id),
      ),
    /every visible part/,
  );
  const r = new Resource(viewerModel, 165);
  r.v.setBigUint64(48, 0x50000080n, true);
  const zipped = deflateRaw(r.bytes),
    out = new Uint8Array(16 + zipped.length);
  out.set(r.header);
  new DataView(out.buffer).setUint32(4, 162, true);
  out.set(zipped, 16);
  const p = analyzeDebadge(out.buffer)[0].geometries[0].parts[0];
  assert.throws(() => removeVehicleParts(out.buffer, [p.id]), /shares an index buffer/);
});
test('Unreadable fragment geometry blocks export, while missing texture decode keeps visual editing available', () => {
  const pack = (r) => {
    const c = deflateRaw(r.bytes),
      o = new Uint8Array(16 + c.length);
    o.set(r.header);
    o.set(c, 16);
    return o.buffer;
  };
  const r = new Resource(debadgeFixture(), 162);
  r.v.setUint32(2688 + 88, 999999, true);
  let input = pack(r),
    data = analyzeDebadge(input);
  assert.ok(data[0].warnings.length);
  assert.ok(!data[0].geometryWarnings);
  assert.equal(removeVehicleParts(input, [data[0].geometries[0].parts[1].id]).removedTriangles, 1);
  const ptr = (at, to) => r.v.setBigUint64(at, BigInt(0x50000000 + to), true);
  ptr(240, 3000);
  ptr(3016, 3056);
  ptr(3056 + 208, 3376);
  r.bytes[3056 + 285] = 1;
  ptr(3376, 3392);
  ptr(3392 + 160, 3680);
  r.v.setBigUint64(3680 + 80, 0x90000000n, true);
  input = pack(r);
  data = analyzeDebadge(input);
  assert.ok(data[0].geometryWarnings.length);
  assert.throws(
    () => removeVehicleParts(input, [data[0].geometries[0].parts[1].id]),
    /drawables could not be read/,
  );
});
