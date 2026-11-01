import references from './freemode-reference.json' with { type: 'json' };
const normalized = (name) => String(name || '').toLowerCase();
export function freemodeFamily(name) {
  return /mp_f_freemode/i.test(name) ? 'female' : /mp_m_freemode/i.test(name) ? 'male' : null;
}
export function nativeSkinRequirement(skin) {
  let max = -1;
  for (let i = 0; i < (skin?.indices.length || 0); i++)
    if (skin.weights[i] > 0) max = Math.max(max, skin.indices[i]);
  return max + 1;
}
export function selectBoothRig(ownRig, skin, candidates = [], { family, choice = 'auto' } = {}) {
  const required = nativeSkinRequirement(skin),
    own = ownRig || [];
  if (!skin)
    return {
      rig: own.length ? own : candidates.find((c) => c.rig?.length)?.rig || [],
      indices: null,
      source: 'rigid',
    };
  const options = [];
  if (choice === 'auto' && own.length) options.push({ rig: own, label: 'Skeleton dalam model' });
  if (choice === 'auto' || choice === 'reference')
    options.push(...candidates.filter((c) => choice !== 'reference' || c.referenceOnly));
  const gender =
    choice === 'freemode-male' ? 'male' : choice === 'freemode-female' ? 'female' : family;
  if (gender && choice !== 'reference' && (choice === 'auto' || choice.startsWith('freemode-')))
    options.push({ rig: references[gender], label: 'Acuan freemode ' + gender });
  for (const option of options) {
    const rig = option.rig;
    if (!rig?.length) continue;
    let mapped = null,
      valid = true;
    const byTag = new Map(rig.map((b, i) => [b.tag, i])),
      byName = new Map(rig.map((b, i) => [normalized(b.name), i]));
    // An unrelated skeleton with enough bones is not proof that numeric indices match.
    // Without original bone names/tags only the mesh's own rig is safe to bind.
    if (own !== rig && !own.length) continue;
    for (let i = 0; i < skin.indices.length; i++) {
      if (skin.weights[i] <= 0) continue;
      const old = skin.indices[i],
        source = own[old];
      let index = old;
      if (own !== rig) {
        if (!source) { valid = false; break; }
        index = byName.get(normalized(source.name));
        if (index === undefined && source.tag !== 0) index = byTag.get(source.tag);
        if (index === undefined) {
          valid = false;
          break;
        }
      }
      if (!Number.isInteger(index) || index < 0 || index >= rig.length) {
        valid = false;
        break;
      }
      if (index !== old) {
        mapped ||= skin.indices.slice();
        mapped[i] = index;
      }
    }
    if (valid)
      return {
        rig,
        indices: mapped || skin.indices,
        source: option.label || 'Skeleton acuan',
        required,
        warning: null,
      };
  }
  return {
    rig: [],
    indices: null,
    required,
    source: '',
    warning: required
      ? !own.length
        ? 'Skin memiliki bobot tetapi skeleton asli tidak tersedia. Impor YDD/YFT yang memuat bone names/tags; auto-rig berdasarkan indeks saja tidak aman.'
        : `Pemetaan bone gagal untuk ${required} indeks. Impor skeleton yang cocok dengan nama/tag bone model.`
      : 'Skin weights tidak tersedia.',
  };
}
