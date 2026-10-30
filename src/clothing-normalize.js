import { safePath, hashName } from './asset-tools.js';

export function normalizeCollectionName(input) {
  let name = String(input)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  if (!name) throw Error('Isi nama collection.');
  if (!/^[a-z]/.test(name) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/.test(name))
    name = 'ditasha_' + name;
  name = name.slice(0, 40).replace(/_$/, '');
  return safePath(name);
}
const compare = (a, b) =>
  a.localeCompare(b, 'en', { numeric: true, sensitivity: 'base' }) || (a < b ? -1 : a > b ? 1 : 0);
const textureKey = (name) =>
  hashName(
    name
      .split(/[\\/]/)
      .at(-1)
      .replace(/\.(dds|png|tga)$/i, '')
      .toLowerCase(),
  );

export function normalizeClothingEntries(entries, { gender, defaultSlot = 'auto', slots }) {
  if (!['auto', ...slots].includes(defaultSlot)) throw Error('Jenis clothing tidak valid.');
  const codes = slots.toSorted((a, b) => b.length - a.length).join('|');
  const modelRx = new RegExp(`(?:^|_)(${codes})_(\\d{1,9})(?:_([ur]))?(?:_(\\d{1,2}))?$`);
  const textureRx = new RegExp(
    `(?:^|_)(${codes})_(?:diff|tex|texture)_(\\d{1,9})(?:_([a-z]+|\\d+))?(?:_(uni|whi|bla|chi|lat|ara|kor|pak))?$`,
  );
  const slotRx = new RegExp(`(?:^|[\\s/_-])(${codes})(?=$|[\\s/_-]|\\d)`, 'i');
  const errors = [],
    rows = [],
    seen = new Set();
  const parse = (text) => {
    const stem = text
      .toLowerCase()
      .split(/[\\/]/)
      .at(-1)
      .split('^')
      .at(-1)
      .replace(/\.[a-z0-9]+$/, '')
      .replace(/[ -]+/g, '_');
    const t = stem.match(textureRx),
      m = stem.match(modelRx);
    return t
      ? { slot: t[1], index: Number(t[2]), variant: t[3], race: t[4] }
      : m
        ? { slot: m[1], index: Number(m[2]), suffix: m[3], alternate: Number(m[4] || 0) }
        : {};
  };
  for (const entry of entries) {
    try {
      const path = safePath(entry.path.replace(/\\/g, '/')),
        key = path.toLowerCase();
      if (seen.has(key))
        throw Error('Path sumber duplikat; gunakan impor Folder untuk membedakan asal: ' + path);
      seen.add(key);
      const base = key.split('/').at(-1),
        ext = base.match(/\.(ydd|ytd|yld)$/)?.[1];
      if (!ext) continue;
      const prefix = base.includes('^') ? base.split('^')[0] : '',
        dir = key.split('/').slice(0, -1).join('/');
      if (/^(?:a_[mf]_|s_[mf]_|u_[mf]_|ig_)/.test(prefix))
        throw Error('Prefix ped tidak didukung: ' + path);
      const sex =
        /mp_f_freemode_01/.test(key) || /(?:^|\/)female(?:\/|$)/.test(key)
          ? 'f'
          : /mp_m_freemode_01/.test(key) || /(?:^|\/)male(?:\/|$)/.test(key)
            ? 'm'
            : gender;
      // An explicit ped prefix wins even when the containing folder says otherwise.
      const resolvedSex = /mp_f_freemode_01/.test(base)
        ? 'f'
        : /mp_m_freemode_01/.test(base)
          ? 'm'
          : sex;
      const named = parse(base),
        hints = (entry.hints?.names || []).map(parse).filter((h) => h.slot);
      const hinted = hints.length && hints.every((h) => h.slot === hints[0].slot) ? hints[0] : {};
      const slot =
        entry.slot ||
        named.slot ||
        hinted.slot ||
        dir.match(slotRx)?.[1]?.toLowerCase() ||
        base.match(slotRx)?.[1]?.toLowerCase() ||
        (defaultSlot !== 'auto' ? defaultSlot : null);
      if (slot && !slots.includes(slot)) throw Error('Jenis clothing tidak valid: ' + path);
      rows.push({
        entry,
        path,
        base,
        ext,
        prefix,
        dir,
        scope: dir + '|' + prefix,
        sex: resolvedSex,
        sexKnown: /mp_[mf]_freemode_01|(?:^|\/)(?:male|female)(?:\/|$)/.test(key),
        slot,
        index: named.index ?? hinted.index,
        variant: named.variant ?? (ext === 'ytd' ? hinted.variant : undefined),
        race: named.race ?? hinted.race,
        suffix:
          named.suffix ||
          (named.race || hinted.race
            ? (named.race || hinted.race) === 'uni'
              ? 'u'
              : 'r'
            : undefined),
        alternate: named.alternate || 0,
        named,
        keys: new Set([
          ...(entry.hints?.keys || []),
          ...(entry.hints?.names || []).map(textureKey),
        ]),
      });
    } catch (e) {
      errors.push(e.message);
    }
  }
  for (const row of rows.filter((r) => r.ext === 'ydd' && !r.slot)) {
    const matches = rows.filter(
      (t) => t.ext === 'ytd' && t.slot && [...row.keys].some((k) => t.keys.has(k)),
    );
    if (matches.length && matches.every((t) => t.slot === matches[0].slot))
      row.slot = matches[0].slot;
  }
  const groups = rows
    .filter((r) => r.ext === 'ydd' && !r.alternate && r.slot)
    .sort((a, b) => compare(a.path, b.path))
    .map((model) => ({ model, textures: [], alternatives: [], cloth: null }));
  const family = (row) =>
    groups.filter(
      (g) => (!row.sexKnown || g.model.sex === row.sex) && (!row.slot || g.model.slot === row.slot),
    );
  const intersection = (a, b) => [...a].some((v) => b.has(v));
  const attach = (row) => {
    let candidates = family(row),
      chosen = [];
    if (row.entry.modelPath) return groups.filter((g) => g.model.path === row.entry.modelPath);
    if (row.ext === 'ytd' && row.keys.size) {
      const content = candidates.filter((g) => intersection(row.keys, g.model.keys));
      if (content.length) {
        const local = content.filter((g) => g.model.scope === row.scope);
        const pool = local.length ? local : content;
        if (row.index !== undefined) {
          const indexed = pool.filter((g) => g.model.index === row.index);
          if (indexed.length) return indexed;
        }
        return pool;
      }
    }
    if (row.index !== undefined) {
      chosen = candidates.filter(
        (g) =>
          g.model.index === row.index &&
          g.model.scope === row.scope &&
          (!row.suffix || !g.model.suffix || row.suffix === g.model.suffix),
      );
      if (chosen.length) return chosen;
      if (row.prefix) {
        chosen = candidates.filter(
          (g) => g.model.index === row.index && g.model.prefix === row.prefix,
        );
        if (chosen.length) return chosen;
      } else {
        chosen = candidates.filter((g) => g.model.index === row.index && g.model.dir === row.dir);
        if (chosen.length) return chosen;
      }
    }
    const stem = (r) =>
      r.base
        .split('^')
        .at(-1)
        .replace(/\.(ydd|ytd|yld)$/, '')
        .replace(/_(?:diff|texture|tex|albedo)(?=_|$)/g, '')
        .replace(/_[a-z]_(?:uni|whi|bla|chi|lat|ara|kor|pak)$/, '')
        .replace(/_[ur]$/, '');
    chosen = candidates.filter((g) => g.model.scope === row.scope && stem(g.model) === stem(row));
    if (chosen.length) return chosen;
    // One model in the source folder/namespace is unambiguous even if arbitrary numbers differ.
    return candidates.filter(
      (g) => g.model.dir === row.dir && (!row.prefix || g.model.prefix === row.prefix),
    );
  };
  for (const row of rows) {
    if (row.ext === 'ydd' && !row.alternate) {
      if (!row.slot)
        errors.push(
          'Pilih jenis clothing untuk ' + row.path + ' (Jenis tanpa nama atau pilihan pada baris).',
        );
      continue;
    }
    const matches = attach(row);
    if (matches.length !== 1) {
      errors.push(
        (matches.length
          ? 'Pasangan ambigu; pilih model untuk: '
          : 'Model pasangan belum ditemukan: ') + row.path,
      );
      continue;
    }
    const group = matches[0];
    row.slot = group.model.slot;
    row.sex = group.model.sex;
    if (row.ext === 'ytd') group.textures.push(row);
    else if (row.ext === 'yld') {
      if (group.cloth) errors.push('Lebih dari satu YLD untuk ' + group.model.path);
      else group.cloth = row;
    } else group.alternatives.push(row);
  }
  const normalized = [],
    counters = new Map();
  for (const group of groups) {
    const m = group.model,
      key = m.sex + '/' + m.slot,
      index = counters.get(key) || 0;
    counters.set(key, index + 1);
    const prop = m.slot.startsWith('p_'),
      suffix = prop
        ? ''
        : '_' + (m.suffix || (group.textures.some((t) => t.race && t.race !== 'uni') ? 'r' : 'u')),
      number = String(index).padStart(3, '0');
    const add = (row, local) =>
      normalized.push({
        ...row.entry,
        path: (m.sex === 'f' ? 'female/' : 'male/') + local,
        originalEntry: row.entry,
        sourcePath: row.path,
        sourceIndex: row.index,
        sourceVariant: row.variant,
        sourceModel: m.path,
      });
    add(m, `${m.slot}_${number}${suffix}.ydd`);
    group.textures.sort(
      (a, b) => compare(a.variant || a.path, b.variant || b.path) || compare(a.path, b.path),
    );
    if (group.textures.length > 26) errors.push('Maksimum 26 varian tekstur untuk ' + m.path);
    group.textures.forEach((t, i) =>
      add(
        t,
        `${m.slot}_diff_${number}_${String.fromCharCode(97 + i)}${prop ? '' : '_' + (t.race || (suffix === '_r' ? 'whi' : 'uni'))}.ytd`,
      ),
    );
    group.alternatives
      .sort((a, b) => a.alternate - b.alternate || compare(a.path, b.path))
      .forEach((a, i) => add(a, `${m.slot}_${number}${suffix}_${i + 1}.ydd`));
    if (group.cloth) add(group.cloth, `${m.slot}_${number}${suffix}.yld`);
  }
  return {
    entries: normalized,
    errors,
    models: groups.map((g) => ({ path: g.model.path, sex: g.model.sex, slot: g.model.slot })),
  };
}
