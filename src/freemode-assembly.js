// Character Maker/Photo Booth freemode assembly contract.
// A head, hair, and skeleton may arrive in arbitrary folder iteration order.
import { freemodePart } from './freemode-character.js';

export function planFreemodeActor(models) {
  const classified = models.map((entry) => {
    const name = String(entry?.name || entry?.file?.name || '');
    return { entry, name, part: freemodePart(entry?.file || entry)?.part || null,
      skeleton: /\.yft$/i.test(name) };
  });
  const heads = classified.filter((item) => item.part === 'head' && !item.skeleton);
  if (heads.length !== 1)
    throw Error('Karakter freemode memerlukan tepat satu model kepala; ditemukan ' + heads.length + '.');
  const primary = heads[0].entry;
  return { primary, attachments: classified.filter((item) => item.entry !== primary).map((item) => ({
    entry: item.entry,
    kind: item.skeleton || ['hair', 'teef'].includes(item.part) ? 'accessory' : 'clothing',
    category: item.skeleton ? 'other' : undefined,
  })) };
}
