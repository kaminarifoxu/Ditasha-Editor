import { hashName, safePath, zipFiles } from './asset-tools.js';
export const COMPONENTS = [
  'head',
  'berd',
  'hair',
  'uppr',
  'lowr',
  'hand',
  'feet',
  'teef',
  'accs',
  'task',
  'decl',
  'jbib',
];
export const PROPS = [
  'p_head',
  'p_eyes',
  'p_ears',
  'p_mouth',
  'p_lhand',
  'p_rhand',
  'p_lwrist',
  'p_rwrist',
  'p_hip',
  'p_lfoot',
  'p_rfoot',
];
const anchors = [
  'HEAD',
  'EYES',
  'EARS',
  'MOUTH',
  'LEFT_HAND',
  'RIGHT_HAND',
  'LEFT_WRIST',
  'RIGHT_WRIST',
  'HIP',
  'LEFT_FOOT',
  'RIGHT_FOOT',
];
const races = { uni: 0, whi: 1, bla: 2, chi: 3, lat: 4, ara: 5, kor: 8, pak: 10 };
export const YMT_MAX_BYTES = 128 * 1024 * 1024;
const value = (name, n) => `<${name} value="${n}" />`;
const array = (name, type, items) =>
  items.length
    ? `<${name} itemType="${type}">\n${items.map((i) => '<Item>' + i + '</Item>').join('\n')}\n</${name}>`
    : `<${name} itemType="${type}" />`;
export function collectionName(name) {
  if (!/^[a-z][a-z0-9_]{0,39}$/.test(name))
    throw Error('Collection: 1–40 karakter a–z, angka, underscore; mulai huruf.');
  safePath(name);
  return name;
}
export function hashValues(text) {
  if (text.length > 4096) throw Error('Nama hash maksimum 4.096 karakter.');
  const unsigned = hashName(text);
  return {
    unsigned,
    signed: unsigned | 0,
    hex: '0x' + unsigned.toString(16).padStart(8, '0').toUpperCase(),
  };
}
export function scanClothing(entries, { collection, gender = 'm' }) {
  collectionName(collection);
  if (!['m', 'f'].includes(gender)) throw Error('Pilih gender m atau f.');
  if (!entries.length || entries.length > 5000) throw Error('Pilih 1–5.000 file YDD/YTD/YLD.');
  const errors = [],
    warnings = [],
    parsed = [],
    seen = new Set(),
    groups = new Map();
  for (const entry of entries) {
    let path;
    try {
      path = safePath(entry.path.replace(/\\/g, '/'));
    } catch (e) {
      errors.push(e.message);
      continue;
    }
    const base = path.split('/').at(-1).toLowerCase(),
      local = base.split('^').at(-1);
    if (!/\.(ydd|ytd|yld)$/.test(base)) {
      warnings.push('Dilewati: ' + path);
      continue;
    }
    const prefix = base.includes('^') ? base.split('^')[0] : '';
    if (prefix && !/^mp_[mf]_freemode_01(?:_[a-z0-9_]+)?$/.test(prefix)) {
      errors.push('Prefix ped tidak didukung: ' + path);
      continue;
    }
    const sex = /mp_f_freemode_01/.test(prefix)
      ? 'f'
      : /mp_m_freemode_01/.test(prefix)
        ? 'm'
        : /(?:^|\/)female\//i.test(path)
          ? 'f'
          : /(?:^|\/)male\//i.test(path)
            ? 'm'
            : gender;
    const model = local.match(/^((?:p_)?[a-z]+)_(\d{3})(?:_([ur]))?(?:_([1-9]\d?))?\.(ydd|yld)$/),
      texture = local.match(
        /^((?:p_)?[a-z]+)_diff_(\d{3})_([a-z])(?:_(uni|whi|bla|chi|lat|ara|kor|pak))?\.ytd$/,
      );
    const match = model || texture;
    if (!match || ![...COMPONENTS, ...PROPS].includes(match[1])) {
      errors.push('Nama clothing tidak didukung: ' + path);
      continue;
    }
    const slot = match[1],
      prop = slot.startsWith('p_'),
      index = Number(match[2]);
    if (
      (model && (prop ? model[3] || model[4] || model[5] === 'yld' : !model[3])) ||
      (texture && (prop ? texture[4] : !texture[4]))
    ) {
      errors.push('Suffix komponen/prop tidak cocok: ' + path);
      continue;
    }
    const key = `${sex}/${slot}/${index}`,
      kind = texture
        ? 'texture'
        : model[5] === 'yld'
          ? 'cloth'
          : model[4]
            ? 'alternative'
            : 'model';
    const identity = key + '/' + kind + '/' + (texture ? texture[3] : model[4] || '');
    if (seen.has(identity)) {
      errors.push('Slot/varian duplikat; pisahkan collection sumber: ' + path);
      continue;
    }
    seen.add(identity);
    if (!groups.has(key))
      groups.set(key, {
        sex,
        slot,
        index,
        prop,
        textures: [],
        alternatives: [],
        model: null,
        cloth: null,
      });
    const group = groups.get(key),
      item = {
        entry,
        path,
        sex,
        slot,
        index,
        kind,
        local,
        suffix: texture ? texture[4] : model[3],
        variant: texture?.[3],
        alternate: Number(model?.[4] || 0),
      };
    if (kind === 'texture') group.textures.push(item);
    else if (kind === 'alternative') group.alternatives.push(item);
    else group[kind] = item;
    const namespace = `mp_${sex}_freemode_01_${prop ? 'p_' : ''}${collection}`;
    item.output = 'stream/' + namespace + '^' + local;
    parsed.push(item);
  }
  const ordered = [...groups.values()].sort(
    (a, b) =>
      a.sex.localeCompare(b.sex) ||
      [...COMPONENTS, ...PROPS].indexOf(a.slot) - [...COMPONENTS, ...PROPS].indexOf(b.slot) ||
      a.index - b.index,
  );
  for (const group of ordered) {
    const label = `${group.sex}/${group.slot}/${group.index}`;
    if (!group.model) errors.push('Model YDD utama tidak ada: ' + label);
    group.textures.sort((a, b) => a.variant.localeCompare(b.variant));
    if (!group.textures.length) errors.push('YTD varian a diperlukan: ' + label);
    group.textures.forEach((t, i) => {
      if (t.variant !== String.fromCharCode(97 + i))
        errors.push('Varian tekstur harus a, b, c tanpa celah: ' + t.path);
      if (!group.prop && group.model?.suffix === 'u' && t.suffix !== 'uni')
        errors.push('_u memerlukan _uni: ' + t.path);
      if (!group.prop && group.model?.suffix === 'r' && t.suffix === 'uni')
        errors.push('_r memerlukan suffix ras, misalnya _whi: ' + t.path);
    });
    group.alternatives
      .sort((a, b) => a.alternate - b.alternate)
      .forEach((a, i) => {
        if (a.alternate !== i + 1 || a.suffix !== group.model?.suffix)
          errors.push('Alternative harus _1, _2 berurutan dan suffix sama: ' + a.path);
      });
    if (group.cloth && group.cloth.suffix !== group.model?.suffix)
      errors.push('Suffix YLD tidak sama dengan YDD: ' + label);
  }
  for (const sex of ['m', 'f']) {
    for (const slot of [...COMPONENTS, ...PROPS]) {
      const drawables = ordered.filter((g) => g.sex === sex && g.slot === slot);
      if (drawables.length > 128)
        errors.push(`${sex}/${slot}: maksimum 128 drawable per collection.`);
      if (drawables.some((g, i) => g.index !== i))
        errors.push(
          `${sex}/${slot}: indeks harus 000, 001, 002 tanpa celah. Nama/internal model tidak diubah otomatis.`,
        );
    }
    if (ordered.filter((g) => g.sex === sex && g.prop).length > 255)
      errors.push(`${sex}: maksimum 255 prop per collection.`);
  }
  if (!ordered.length) errors.push('Tidak ada clothing yang dikenali.');
  warnings.push(
    'Output YMT masih XML. Konversi dengan CodeWalker/YMTEditor sebelum dipasang di FiveM.',
  );
  return {
    collection,
    groups: ordered,
    files: parsed,
    errors: [...new Set(errors)],
    warnings: [...new Set(warnings)],
  };
}
function variationXml(plan, sex) {
  const groups = plan.groups.filter((g) => g.sex === sex),
    components = COMPONENTS.map((slot) => groups.filter((g) => g.slot === slot)).filter(
      (g) => g.length,
    ),
    props = groups.filter((g) => g.prop);
  const avail = COMPONENTS.map((slot) => {
    const i = components.findIndex((g) => g[0].slot === slot);
    return i < 0 ? 255 : i;
  });
  const blocks = components.map(
    (group) =>
      value('numAvailTex', group.reduce((n, g) => n + g.textures.length, 0) & 255) +
      array(
        'aDrawblData3',
        'CPVDrawblData',
        group.map(
          (g) =>
            value('propMask', g.model.suffix === 'r' ? 17 : 1) +
            value('numAlternatives', g.alternatives.length) +
            array(
              'aTexData',
              'CPVTextureData',
              g.textures.map((t) => value('texId', races[t.suffix]) + value('distribution', 255)),
            ) +
            '<clothData>' +
            value('ownsCloth', !!g.cloth) +
            '</clothData>',
        ),
      ),
  );
  const infos = groups
    .filter((g) => !g.prop)
    .map(
      (g) =>
        '<pedXml_audioID>hash_00000000</pedXml_audioID><pedXml_audioID2>hash_00000000</pedXml_audioID2><pedXml_expressionMods>0 0 0 0 0</pedXml_expressionMods>' +
        value('flags', 0) +
        '<inclusions>0</inclusions><exclusions>0</exclusions><pedXml_vfxComps>0</pedXml_vfxComps>' +
        value('pedXml_flags', 0) +
        value('pedXml_compIdx', COMPONENTS.indexOf(g.slot)) +
        value('pedXml_drawblIdx', g.index),
    );
  const propData = props.map(
    (g) =>
      '<audioId>hash_00000000</audioId><expressionMods>0 0 0 0 0</expressionMods>' +
      array(
        'texData',
        'CPedPropTexData',
        g.textures.map(
          (t, i) =>
            '<inclusions>0</inclusions><exclusions>0</exclusions>' +
            value('texId', i) +
            value('inclusionId', 0) +
            value('exclusionId', 0) +
            value('distribution', 255),
        ),
      ) +
      '<renderFlags>0</renderFlags>' +
      value('propFlags', 0) +
      value('flags', 0) +
      value('anchorId', PROPS.indexOf(g.slot)) +
      value('propId', g.index) +
      value('stickyness', 0),
  );
  const anchorData = PROPS.flatMap((slot, i) => {
    const list = props.filter((g) => g.slot === slot);
    return list.length
      ? [
          `<props>${list.map((g) => g.textures.length).join(' ')}</props><anchor>ANCHOR_${anchors[i]}</anchor>`,
        ]
      : [];
  });
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n<CPedVariationInfo name="${plan.collection}">\n` +
    ['bHasTexVariations', 'bHasDrawblVariations', 'bHasLowLODs', 'bIsSuperLOD']
      .map((n) => value(n, false))
      .join('') +
    `<availComp>${avail.join(' ')}</availComp>` +
    array('aComponentData3', 'CPVComponentData', blocks) +
    array('aSelectionSets', 'CPedSelectionSet', []) +
    array('compInfos', 'CComponentInfo', infos) +
    '<propInfo>' +
    value('numAvailProps', props.length) +
    array('aPropMetaData', 'CPedPropMetaData', propData) +
    array('aAnchors', 'CAnchorProps', anchorData) +
    '</propInfo><dlcName>hash_' +
    hashName(plan.collection).toString(16).padStart(8, '0').toUpperCase() +
    '</dlcName>\n</CPedVariationInfo>\n'
  );
}
function formatXml(text) {
  let depth = 0;
  return (
    text
      .replace(/>\s*</g, '>\n<')
      .trim()
      .split('\n')
      .map((line) => {
        if (/^<\//.test(line)) depth--;
        const formatted = '  '.repeat(Math.max(0, depth)) + line;
        if (/^<[^!?/][^>]*>$/.test(line) && !/\/>$/.test(line) && !line.includes('</')) depth++;
        return formatted;
      })
      .join('\n') + '\n'
  );
}
export function buildYmtDocuments(plan) {
  if (plan.errors.length) throw Error(plan.errors.join('\n'));
  const docs = [],
    metas = [];
  for (const sex of ['m', 'f']) {
    if (!plan.groups.some((g) => g.sex === sex)) continue;
    const ped = `mp_${sex}_freemode_01`,
      full = ped + '_' + plan.collection;
    docs.push({ name: 'stream/' + full + '.ymt.xml', data: variationXml(plan, sex) });
    const meta = full + '.meta';
    metas.push(meta);
    docs.push({
      name: meta,
      data: `<?xml version="1.0" encoding="UTF-8"?>\n<ShopPedApparel><pedName>${ped}</pedName><dlcName>${plan.collection}</dlcName><fullDlcName>${full}</fullDlcName><eCharacter>${sex === 'f' ? 'SCR_CHAR_MULTIPLAYER_F' : 'SCR_CHAR_MULTIPLAYER'}</eCharacter><creatureMetaData /><pedOutfits /><pedComponents /><pedProps /></ShopPedApparel>\n`,
    });
  }
  docs.push({
    name: 'fxmanifest.lua',
    data:
      "fx_version 'cerulean'\ngame 'gta5'\nauthor 'Ditasha-Workshop'\nfiles {\n" +
      metas.map((m) => `  '${m}',`).join('\n') +
      '\n}\n' +
      metas.map((m) => `data_file 'SHOP_PED_APPAREL_META_FILE' '${m}'`).join('\n') +
      '\n',
  });
  docs.push({
    name: 'README.txt',
    data: `DITASHA YMT Creator · ${plan.collection}\n© 2026 Ditasha-Workshop\n\nREQUIRES CONVERSION BEFORE USE\nConvert each stream/*.ymt.xml with CodeWalker RPF Explorer Import XML (or compatible YMTEditor XML import) to its binary .ymt; place that binary in stream/. Renaming XML to .ymt does not convert it.\nAfter conversion, add ensure ${plan.collection} to server.cfg and reconnect. Test on a development server.\n\nOnly freemode component/prop metadata is generated. Heels/hair-hiding creature metadata, custom ped skeletons, binary YMT generation and internal drawable/material/texture-name rewriting are not included. Original asset bytes are preserved.\n\n${plan.warnings.join('\n')}\n`,
  });
  docs.push({
    name: 'ditasha-ymt-report.json',
    data: JSON.stringify(
      {
        collection: plan.collection,
        requiresBinaryConversion: true,
        mapping: plan.files.map((f) => ({ source: f.path, output: f.output })),
        warnings: plan.warnings,
      },
      null,
      2,
    ),
  });
  return docs.map((doc) =>
    /\.(xml|meta)$/.test(doc.name) ? { ...doc, data: formatXml(doc.data) } : doc,
  );
}
export async function buildYmtResource(plan) {
  const docs = buildYmtDocuments(plan),
    files = [];
  const total = plan.files.reduce(
    (n, f) => n + (f.entry.file?.size ?? f.entry.data?.length ?? 0),
    0,
  );
  if (total > YMT_MAX_BYTES - 1024 * 1024)
    throw Error('ZIP YMT maksimum 128 MB termasuk metadata.');
  for (const f of plan.files) {
    if (!f.entry.file && !f.entry.data)
      throw Error('Nama saja tidak memiliki data file; pilih file asli untuk ZIP resource.');
    const data = f.entry.data || new Uint8Array(await f.entry.file.arrayBuffer());
    files.push({ name: plan.collection + '/' + f.output, data });
  }
  return zipFiles(
    [...files, ...docs.map((d) => ({ name: plan.collection + '/' + d.name, data: d.data }))],
    { maxBytes: YMT_MAX_BYTES },
  );
}
export function resourceManifest({
  client = '',
  server = '',
  shared = '',
  nui = '',
  dependencies = '',
}) {
  const lines = ["fx_version 'cerulean'", "game 'gta5'", "author 'Ditasha-Workshop'"];
  const list = (text) =>
    text
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
  for (const [key, text] of [
    ['client_scripts', client],
    ['server_scripts', server],
    ['shared_scripts', shared],
    ['dependencies', dependencies],
  ]) {
    const values = list(text);
    if (values.length > 200) throw Error('Maksimum 200 entri per bagian.');
    if (values.length)
      lines.push(
        key + ' {',
        ...values.map((p) => {
          safePath(p.replace(/\*/g, 'wildcard'));
          if (!/^[a-zA-Z0-9_./@+*-]+$/.test(p)) throw Error('Path manifest tidak valid: ' + p);
          return `  '${p}',`;
        }),
        '}',
      );
  }
  if (nui.trim()) {
    const path = safePath(nui.trim());
    if (!/^[a-zA-Z0-9_./-]+$/.test(path)) throw Error('Path NUI tidak valid.');
    lines.push(
      `ui_page '${path}'`,
      "files { '" + path + "' }",
      '-- Tambahkan aset JS/CSS/gambar NUI lainnya ke files.',
    );
  }
  return lines.join('\n') + '\n';
}
