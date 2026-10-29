import { BOOTH_POSES } from './photo-booth-pose.js';
export function createActorMotion() {
  return { pose: 'relaxed', clip: '', time: 0, playing: false, speed: 1 };
}
export function actorForAsset(assets, asset) {
  if (['ped', 'vehicle'].includes(asset.kind)) return asset;
  return assets.find((a) => a.id === asset.owner && a.kind === 'ped') || asset;
}
export function advanceActorMotion(motion, delta, duration = 4) {
  if (!Number.isFinite(delta) || delta < 0 || !Number.isFinite(duration) || duration <= 0)
    throw Error('Waktu animasi tidak valid.');
  if (motion.playing) motion.time = (motion.time + Math.min(delta, 0.1) * motion.speed) % duration;
  return motion.time;
}
export function validateActorMotion(motion) {
  if (
    ![...BOOTH_POSES.map(([id]) => id), 'clip'].includes(motion.pose) ||
    !Number.isFinite(motion.time) ||
    motion.time < 0 ||
    !Number.isFinite(motion.speed) ||
    motion.speed < 0.1 ||
    motion.speed > 3
  )
    throw Error('Pengaturan emote tidak valid.');
  return motion;
}
