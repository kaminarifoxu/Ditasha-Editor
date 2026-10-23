import test from 'node:test';
import assert from 'node:assert/strict';
import { planPedFiles, packagePedFiles } from '../src/ped-files.js';
const file = (name, bytes = [1, 2, 3]) => ({
  name,
  size: bytes.length,
  arrayBuffer: async () => new Uint8Array(bytes).buffer,
});
test('Ped import previews YDD components and preserves companion skeleton/metadata', async () => {
  const files = [
    file('ped.yft', [10, 11]),
    file('body.ydd'),
    file('top.ydd'),
    file('ped.ymt', [99, 42]),
    file('top.ytd'),
  ];
  const plan = planPedFiles(files);
  assert.deepEqual(
    plan.preview.map((f) => f.name),
    ['body.ydd', 'top.ydd', 'top.ytd'],
  );
  const zip = await packagePedFiles(plan);
  const view = new DataView(zip.buffer);
  let at = 0,
    index = 0;
  while (view.getUint32(at, true) === 0x04034b50) {
    const length = view.getUint32(at + 18, true),
      nameLength = view.getUint16(at + 26, true);
    const name = new TextDecoder().decode(zip.subarray(at + 30, at + 30 + nameLength));
    assert.equal(name, files[index].name);
    assert.deepEqual(
      zip.subarray(at + 30 + nameLength, at + 30 + nameLength + length),
      new Uint8Array(await files[index].arrayBuffer()),
    );
    at += 30 + nameLength + length;
    index++;
  }
  assert.equal(index, 5);
  assert.deepEqual(planPedFiles([files[0]]).preview, [files[0]]);
});
test('Ped imports reject unsafe names, duplicate files, missing models and memory excess', () => {
  for (const files of [
    [],
    [file('../ped.ydd')],
    [file('ped.ydd'), file('PED.ydd')],
    [file('ped.ymt')],
    [file('ped.ydd'), file('run.exe')],
    [{ ...file('ped.ydd'), size: 65 * 1048576 }],
    Array.from({ length: 3 }, (_, i) => ({ ...file(i + '.ydd'), size: 50 * 1048576 })),
  ])
    assert.throws(() => planPedFiles(files));
});
