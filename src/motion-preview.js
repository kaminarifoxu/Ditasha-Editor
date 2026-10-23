export function decodeMotion(motion, floatCount) {
  if (!motion) return null;
  if (
    motion.version !== 1 ||
    motion.floatCount !== floatCount ||
    !Number.isSafeInteger(floatCount) ||
    floatCount < 3 ||
    floatCount % 3 ||
    !Number.isFinite(motion.fps) ||
    motion.fps < 1 ||
    motion.fps > 60 ||
    !Array.isArray(motion.frames) ||
    motion.frames.length < 4 ||
    motion.frames.length > 16 ||
    motion.frames.length * floatCount * 4 > 16 * 1024 * 1024
  )
    throw Error('Buffer animasi preview tidak valid.');
  const frames = motion.frames.map((encoded) => {
    if (
      typeof encoded !== 'string' ||
      encoded.length !== Math.ceil((floatCount * 4) / 3) * 4 ||
      !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)
    )
      throw Error('Frame animasi tidak valid.');
    const bytes = Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0));
    if (bytes.length !== floatCount * 4) throw Error('Ukuran frame animasi tidak cocok.');
    const view = new DataView(bytes.buffer),
      frame = new Float32Array(floatCount);
    for (let i = 0; i < floatCount; i += 3) {
      const x = view.getFloat32(i * 4, true),
        y = view.getFloat32((i + 1) * 4, true),
        z = view.getFloat32((i + 2) * 4, true);
      if (![x, y, z].every(Number.isFinite)) throw Error('Koordinat animasi tidak valid.');
      frame.set([x, z, -y], i);
    }
    return frame;
  });
  return {
    frames,
    fps: motion.fps,
    label: motion.label || 'Walk test',
    kind: motion.kind === 'gta-ycd-xml' ? 'gta-ycd-xml' : 'procedural-weight-test',
  };
}
export function sampleMotion(motion, seconds, output) {
  const position =
    (((seconds * motion.fps) % motion.frames.length) + motion.frames.length) % motion.frames.length;
  const index = Math.floor(position),
    alpha = position - index;
  const a = motion.frames[index],
    b = motion.frames[(index + 1) % motion.frames.length];
  if (output.length !== a.length) throw Error('Buffer tujuan animasi tidak cocok.');
  for (let i = 0; i < output.length; i++) output[i] = a[i] + (b[i] - a[i]) * alpha;
}
