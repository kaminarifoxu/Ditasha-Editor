// Read only the vehicle/mod relationship needed by the offline photo preview.
const stem = (name) =>
  String(name)
    .split(/[\\/]/)
    .at(-1)
    .replace(/\.[^.]+$/, '')
    .toLowerCase();
function xml(source) {
  if (source.length > 2 * 1024 ** 2 || /<!DOCTYPE|<!ENTITY/i.test(source))
    throw Error('Metadata kendaraan terlalu besar / tidak didukung.');
  const root = { name: '', text: '', children: [] },
    stack = [root];
  let count = 0;
  for (const m of source.matchAll(/<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<[^>]+>|[^<]+/g)) {
    const t = m[0];
    if (t.startsWith('<?') || t.startsWith('<!--')) continue;
    if (t.startsWith('</')) {
      const n = stack.pop();
      if (!n || n.name !== t.slice(2, -1).trim() || !stack.length)
        throw Error('XML kendaraan tidak valid.');
    } else if (t.startsWith('<')) {
      const name = t.match(/^<([\w:.-]+)/)?.[1];
      if (!name || ++count > 50000 || stack.length > 64) throw Error('XML kendaraan tidak valid.');
      const n = { name, text: '', children: [] };
      stack.at(-1).children.push(n);
      if (!t.endsWith('/>')) stack.push(n);
    } else stack.at(-1).text += t;
  }
  if (stack.length !== 1) throw Error('XML kendaraan terpotong.');
  return root.children[0];
}
const child = (n, name) => n?.children.find((c) => c.name === name);
const children = (n, name) => n?.children.filter((c) => c.name === name) || [];
const text = (n, name) => child(n, name)?.text.trim().toLowerCase() || '';
export function vehicleModManifest(sources) {
  const kits = new Map(),
    vehicles = new Map();
  for (const source of new Set(sources)) {
    const root = xml(source);
    if (root?.name === 'CVehicleModelInfoVarGlobal')
      for (const kit of children(child(root, 'Kits'), 'Item')) {
        const id = text(kit, 'kitName');
        const mods = children(child(kit, 'visibleMods'), 'Item')
          .map((n) => ({
            model: text(n, 'modelName'),
            bone: text(n, 'bone'),
            slot: text(n, 'type'),
            off: children(child(n, 'turnOffBones'), 'Item').map((n) => n.text.trim().toLowerCase()),
          }))
          .filter((n) => n.model);
        if (id) kits.set(id, mods);
      }
    if (root?.name === 'CVehicleModelInfoVariation')
      for (const vehicle of children(child(root, 'variationData'), 'Item')) {
        const name = text(vehicle, 'modelName');
        if (name)
          vehicles.set(
            name,
            children(child(vehicle, 'kits'), 'Item').map((n) => n.text.trim().toLowerCase()),
          );
      }
  }
  return [...vehicles].flatMap(([vehicle, ids]) =>
    ids.flatMap((id) => (kits.get(id) || []).map((m) => ({ ...m, vehicle }))),
  );
}
export function groupBoothVehicles(pending, existing, manifest) {
  const models = new Set(manifest.map((m) => m.model));
  const roots = [...existing, ...pending].filter(
    (a) =>
      a.kind === 'vehicle' &&
      !models.has(stem(a.name)) &&
      (!/_hi$/i.test(stem(a.name)) ||
        ![...existing, ...pending].some((b) => stem(b.name) === stem(a.name).replace(/_hi$/, ''))),
  );
  for (const a of pending) {
    if (a.kind !== 'vehicle') continue;
    const name = stem(a.name),
      mod = manifest.filter((m) => m.model === name),
      base = name.replace(/_hi$/, '');
    const matches = roots.filter(
      (b) =>
        b !== a &&
        (mod.length
          ? mod.some((m) => m.vehicle === (b.vehicleModel || stem(b.name).replace(/_hi$/, '')))
          : /_hi$/.test(name) && stem(b.name) === base),
    );
    if (matches.length === 1) {
      const owner = matches[0],
        info = mod.find(
          (m) => m.vehicle === (owner.vehicleModel || stem(owner.name).replace(/_hi$/, '')),
        );
      Object.assign(a, {
        kind: 'vehicle-part',
        category: 'vehicle-part',
        owner: owner.id,
        offset: [0, 0, 0],
        attach: 'auto',
        vehicleAlt: !info,
        vehicleSlot: info?.slot || 'lod',
        vehicleBone: info?.bone || 'chassis',
        vehicleOffBones: info?.off || [],
        visible: !!info,
      });
    } else a.vehicleModel = base;
  }
  // Multiple alternatives in one mod slot must never be enabled together.
  for (const a of pending.filter((a) => a.kind === 'vehicle-part' && !a.vehicleAlt))
    if (
      [...existing, ...pending].filter(
        (b) => b.kind === 'vehicle-part' && b.owner === a.owner && b.vehicleSlot === a.vehicleSlot,
      ).length > 1
    )
      a.visible = false;
  pending
    .filter((a) => a.kind === 'vehicle')
    .forEach(
      (a, i) =>
        (a.offset[0] =
          (existing.filter((b) => ['ped', 'vehicle'].includes(b.kind)).length + i) * 1.5),
    );
  return pending;
}
export function vehiclePreviewIndices(g, rig, hiddenNames) {
  if (!hiddenNames.size || !g.skin) return g.indices;
  const hidden = new Set(rig.flatMap((b, i) => (hiddenNames.has(b.name.toLowerCase()) ? [i] : [])));
  if (!hidden.size) return g.indices;
  const off = (v) => {
    let weight = 0;
    for (let k = 0; k < 4; k++)
      if (hidden.has(g.skin.indices[v * 4 + k])) weight += g.skin.weights[v * 4 + k];
    return weight > 0.999;
  };
  const kept = [];
  for (let i = 0; i < g.indices.length; i += 3)
    if (![0, 1, 2].every((k) => off(g.indices[i + k])))
      kept.push(g.indices[i], g.indices[i + 1], g.indices[i + 2]);
  return new g.indices.constructor(kept);
}
