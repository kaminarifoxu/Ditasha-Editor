import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeCode, encodeCode, codeLanguage, MAX_CODE_BYTES } from '../src/code-text.js';
test('Code editor preserves UTF-8, BOM and CRLF without executing source', () => {
  const source = '\ufeff-- nama 日本語\r\nprint("hello")\r\n';
  const bytes = new TextEncoder().encode(source),
    decoded = decodeCode(bytes);
  assert.equal(decoded.bom, true);
  assert.deepEqual(encodeCode(decoded.text, decoded.bom), bytes);
  assert.equal(decodeCode(new Uint8Array()).text, '');
  assert.equal(codeLanguage('vehicles.meta'), 'xml');
  assert.equal(codeLanguage('fxmanifest.lua'), 'lua');
  assert.equal(codeLanguage('unknown.txt'), 'plaintext');
});
test('Code editor rejects binary, malformed UTF-8 and oversized documents', () => {
  assert.throws(() => decodeCode(new Uint8Array([65, 0, 66])), /Binary/);
  assert.throws(() => decodeCode(new Uint8Array([255])), /encoded|encoding/i);
  assert.throws(() => decodeCode(new Uint8Array(MAX_CODE_BYTES + 1)), /2 MB/);
  assert.throws(() => encodeCode('a'.repeat(MAX_CODE_BYTES), true), /2 MB/);
});
