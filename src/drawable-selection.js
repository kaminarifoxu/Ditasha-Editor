// Component dictionaries describe one ped in separate drawable slots. Repeated
// slots are clothing alternatives and must remain individually selected by default.
export function defaultDrawableSelection(drawables) {
  const slots = drawables.map((d) => d.componentSlot);
  return slots.length > 1 &&
    slots.includes('head') &&
    slots.every(Boolean) &&
    new Set(slots).size === slots.length
    ? -1
    : 0;
}
export function selectedDrawables(drawables, index) {
  return drawables.flatMap((data, i) => (index === -1 || i === index ? [{ data, index: i }] : []));
}
export function drawableLevel(drawable, name) {
  return drawable.lods.find((l) => l.name === name) || drawable.lods[0];
}
export function drawableView(drawables, index) {
  if (index !== -1) return drawables[index];
  if (!drawables.length) return null;
  const names = [...new Set(drawables.flatMap((d) => d.lods.map((l) => l.name)))];
  names.sort(
    (a, b) =>
      ['High', 'Medium', 'Low', 'Very low'].indexOf(a) -
      ['High', 'Medium', 'Low', 'Very low'].indexOf(b),
  );
  const lods = names.map((name) => ({
    name,
    geometries: drawables.flatMap((d, i) =>
      (drawableLevel(d, name)?.geometries || []).map((g) => ({
        ...g,
        drawableLabel: d.name,
        sourceDrawableIndex: i,
        sourceEmbeddedTextures: d.embeddedTextures || [],
      })),
    ),
  }));
  return {
    name: 'Semua drawable',
    geometries: lods[0]?.geometries || [],
    lods,
    embeddedTextures: drawables.flatMap((d) => d.embeddedTextures || []),
    warnings: drawables.flatMap((d) => d.warnings || []),
  };
}
