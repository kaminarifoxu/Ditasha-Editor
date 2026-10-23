import test from 'node:test';
import assert from 'node:assert/strict';
import { drawStampText, validateStampText } from '../src/stamp-text.js';
const options = {
  text: 'DITASHA\nWORKSHOP',
  font: 'Arial',
  size: 128,
  color: '#ffffff',
  bold: true,
};
test('Text stamps validate multiline content, fonts and bounded bitmap size', () => {
  assert.deepEqual(validateStampText(options).lines, ['DITASHA', 'WORKSHOP']);
  for (const change of [
    { text: ' ' },
    { text: 'x'.repeat(501) },
    { text: 'a\n'.repeat(9) },
    { font: 'url(https://example.com)' },
    { size: 513 },
    { size: NaN },
    { color: 'red' },
  ])
    assert.throws(() => validateStampText({ ...options, ...change }));
  const drawn = [];
  const context = {
    measureText: (text) => ({
      width: text.length * 70,
      actualBoundingBoxLeft: 20,
      actualBoundingBoxRight: text.length * 70 + 10,
    }),
    fillText: (...args) => drawn.push(args),
  };
  const canvas = { getContext: () => context };
  drawStampText(canvas, options);
  assert.equal(drawn.length, 2);
  assert.ok(drawn[0][1] > 20, 'Italic overhang must stay inside canvas');
  assert.ok(canvas.height > drawn[1][2]);
  assert.match(context.font, /bold 128px "Arial"/);
  assert.throws(
    () => drawStampText(canvas, { ...options, text: 'x'.repeat(500) }),
    /Teks terlalu besar/,
  );
});
