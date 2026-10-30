export function boothHeight(points) {
  let min = Infinity,
    max = -Infinity;
  for (let i = 1; i < points.length; i += 3) {
    if (Number.isFinite(points[i])) {
      min = Math.min(min, points[i]);
      max = Math.max(max, points[i]);
    }
  }
  return Number.isFinite(max - min) && max > min ? max - min : 0;
}
export function setBoothHeight(actor, cm) {
  if (!Number.isFinite(cm) || cm < 1 || cm > 1000 || !(actor.baseHeight > 0))
    throw Error('Tinggi model harus 1–1000 cm dan model harus sudah terlihat.');
  const scale = cm / (actor.baseHeight * 100);
  if (scale < 0.01 || scale > 100) throw Error('Skala tinggi di luar rentang 0,01–100.');
  actor.scale = scale;
  actor.targetHeightCm = cm;
}
export function setBoothElevation(actor, cm) {
  if (!Number.isFinite(cm) || Math.abs(cm) > 10000)
    throw Error('Naik/turun harus -10000 sampai 10000 cm.');
  actor.offset[1] = cm / 100;
}
