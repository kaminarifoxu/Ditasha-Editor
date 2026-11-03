// Clearly-labelled visual fallback for facial-only GTA clips that do not
// contain skeletal tracks mappable to the currently loaded ped. It is not a
// decoder for native GTA facial morph channels or an accurate YCD retarget.
import { Quaternion, Vector3 } from 'three';

const forward = new Vector3(1, 0, 0);
const sideways = new Vector3(0, 0, 1);

export function emotePreviewKind(label = '') {
  return /(?:^|[\\/\s@_-])cough(?:ing)?(?:[_\s-]?\d+)?(?:\.|$|[\\/\s_-])/i.test(label)
    ? 'cough'
    : null;
}

export function canPreviewFacialEmote(bones, label) {
  return emotePreviewKind(label) === 'cough' &&
    bones.some(({ role }) => role === 'head' || role === 'chest');
}

export function applyFacialEmotePreview(bones, label, time) {
  if (!Number.isFinite(time) || !canPreviewFacialEmote(bones, label)) return false;
  // A subtle repeated cough gesture. Rest transforms are restored on each
  // sample, so scrubbing and exporting a paused frame remain deterministic.
  const phase = time * Math.PI * 5;
  const pulse = Math.pow(Math.max(0, Math.sin(phase)), 2);
  for (const { bone, role, rest } of bones) {
    if (role !== 'head' && role !== 'chest') continue;
    bone.quaternion.copy(rest);
    const bend = (role === 'head' ? 0.16 : 0.07) * pulse;
    bone.quaternion.multiply(new Quaternion().setFromAxisAngle(forward, bend));
    if (role === 'head')
      bone.quaternion.multiply(new Quaternion().setFromAxisAngle(sideways, 0.025 * Math.sin(phase)));
    bone.updateMatrix();
  }
  return true;
}
