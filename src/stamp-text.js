// Local fonts only: stamps remain available without a network connection.
export const stampFonts = ['Arial', 'Georgia', 'Verdana', 'Courier New'];
export function validateStampText({ text, font, size, color, bold = false, italic = false }) {
  if (typeof text !== 'string' || !text.trim() || text.length > 500)
    throw Error('Teks stamp harus berisi 1–500 karakter.');
  if (
    !stampFonts.includes(font) ||
    !Number.isInteger(size) ||
    size < 12 ||
    size > 512 ||
    !/^#[0-9a-f]{6}$/i.test(color) ||
    typeof bold !== 'boolean' ||
    typeof italic !== 'boolean'
  )
    throw Error('Pengaturan teks stamp tidak valid.');
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  if (lines.length > 8) throw Error('Maksimum 8 baris teks.');
  return { text, font, size, color, bold, italic, lines };
}
export function drawStampText(canvas, options) {
  const value = validateStampText(options);
  const context = canvas.getContext('2d');
  const font = `${value.italic ? 'italic ' : ''}${value.bold ? 'bold ' : ''}${value.size}px "${value.font}"`;
  context.font = font;
  const metrics = value.lines.map((line) => context.measureText(line || ' '));
  const pad = Math.ceil(value.size * 0.3);
  const left = Math.max(0, ...metrics.map((m) => m.actualBoundingBoxLeft || 0));
  const right = Math.max(...metrics.map((m) => Math.max(m.width, m.actualBoundingBoxRight || 0)));
  const lineHeight = Math.ceil(value.size * 1.4);
  const width = Math.ceil(left + right + pad * 2),
    height = lineHeight * value.lines.length + pad * 2;
  if (width > 8192 || height > 8192 || width * height > 16777216)
    throw Error('Teks terlalu besar. Kurangi ukuran atau panjang baris.');
  canvas.width = width;
  canvas.height = height;
  context.font = font;
  context.textBaseline = 'alphabetic';
  context.fillStyle = value.color;
  value.lines.forEach((line, i) =>
    context.fillText(line, pad + left, pad + value.size + i * lineHeight),
  );
  return value;
}
