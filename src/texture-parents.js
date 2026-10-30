// Selected plain XML only: no external entities or binary YMT interpretation.
export const isTextureParentFile = (name) =>
  /^(vehicles\.meta|gtxd\.meta|gtxd\.xml|(?:vehicles\.meta|gtxd\.ymt)\.xml)$/i.test(name);
export function parseTextureParents(xml) {
  if (xml.length > 2 * 1024 * 1024 || /<!DOCTYPE|<!ENTITY/i.test(xml))
    throw Error('Metadata XML terlalu besar atau memakai entity yang tidak didukung.');
  const section = xml
    .replace(/<!--[\s\S]*?-->/g, '')
    .match(/<txdRelationships\b[^>]*>([\s\S]*?)<\/txdRelationships\s*>/i)?.[1];
  if (!section) return [];
  const parents = [];
  for (const match of section.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item\s*>/gi)) {
    const text = (tag) =>
      match[1].match(new RegExp('<' + tag + '\\s*>([^<]*)<\\/' + tag + '\\s*>', 'i'))?.[1]?.trim();
    const child = text('child'),
      parent = text('parent');
    if (!child || !parent || ![child, parent].every((v) => /^[a-z0-9_(). -]{1,128}$/i.test(v)))
      throw Error('Hubungan dictionary XML tidak valid.');
    parents.push({ child, parent });
    if (parents.length > 4096) throw Error('Metadata melebihi 4.096 hubungan dictionary.');
  }
  return parents;
}
