export const MAX_CODE_BYTES = 2 * 1024 * 1024;
export function decodeCode(data) {
  if (data.length > MAX_CODE_BYTES) throw Error('Code editor limit: 2 MB.');
  if (data.includes(0)) throw Error('Binary files cannot be edited as text.');
  const bom = data[0] === 239 && data[1] === 187 && data[2] === 191;
  return {
    text: new TextDecoder('utf-8', { fatal: true }).decode(data.subarray(bom ? 3 : 0)),
    bom,
  };
}
export function encodeCode(text, bom) {
  const data = new TextEncoder().encode((bom ? '\ufeff' : '') + text);
  if (data.length > MAX_CODE_BYTES) throw Error('Code editor limit: 2 MB.');
  return data;
}
export function codeLanguage(name) {
  const ext = name.split('.').at(-1).toLowerCase();
  return (
    {
      lua: 'lua',
      js: 'javascript',
      ts: 'typescript',
      json: 'json',
      xml: 'xml',
      meta: 'xml',
      html: 'html',
      css: 'css',
      ini: 'ini',
      cfg: 'ini',
    }[ext] || 'plaintext'
  );
}
