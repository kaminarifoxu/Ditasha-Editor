// Repair only a missing saved external animation source. Never invent
// animation tracks or alter an available per-ped clip.
export function recoverSavedExternalEmote(actor, knownClipIds, warnings = []) {
  const clip = actor?.motion?.clip;
  if (typeof clip !== 'string' || !clip.startsWith('external:') ||
      knownClipIds.has(clip)) return false;
  warnings.push(
    String(actor.name || 'Ped') + ': emote tersimpan ' + clip +
    ' tidak ditemukan atau gagal dibaca. Pose diganti Relaxed; impor ulang file YCD/GLB.'
  );
  actor.motion.clip = '';
  actor.motion.pose = 'relaxed';
  actor.motion.time = 0;
  actor.motion.playing = false;
  return true;
}
