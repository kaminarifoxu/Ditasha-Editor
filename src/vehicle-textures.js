import { textureNameMatches } from './model-material.js';
import { liveryReference } from './vehicle-livery.js';
import {
  MAX_DECODED_TEXTURE_BYTES,
  MAX_YTD_INPUT_BYTES,
  textureBudgetLabel,
} from './texture-memory.js';

// A shared dictionary must not delete a vehicle's identically named map.
// Only a map from the same dictionary is a replacement.
const textureKey = (t) =>
  JSON.stringify([(t.dictionary || '').toLowerCase(), t.name.toLowerCase()]);
export function mergeVehicleTextures(existing, incoming) {
  const replacements = new Set(incoming.map(textureKey));
  return [...existing.filter((t) => !replacements.has(textureKey(t))), ...incoming];
}

export function modelTextureReferences(drawables) {
  return [
    ...new Set(
      drawables
        .flatMap((d) =>
          d.lods.flatMap((l) =>
            l.geometries.flatMap((g) => [g.diffuseTexture, liveryReference(g)]),
          ),
        )
        .filter(Boolean),
    ),
  ];
}

// Keep readable maps when one dictionary entry is broken. Editing/export readers stay strict.
export async function loadVehicleTextures(files, references, { decode, image, existing = [] }) {
  const textures = [],
    warnings = [];
  for (const file of files) {
    try {
      const ytd = /\.ytd$/i.test(file.name);
      const maxInput = ytd ? MAX_YTD_INPUT_BYTES : 64 * 1024 ** 2;
      if (file.size > maxInput) throw Error('File maksimum ' + maxInput / 1048576 + ' MB.');
      let metadata;
      if (ytd) metadata = await decode('texture-index', await file.arrayBuffer());
      // Replacing a map releases its old budget; unrelated dictionaries remain counted.
      const incoming = (metadata || [{ name: file.name }]).map((t) => ({
        ...t,
        dictionary: file.name,
      }));
      const incomingKeys = new Set(incoming.map(textureKey));
      const retained = mergeVehicleTextures(existing, textures).filter(
        (t) => !incomingKeys.has(textureKey(t)),
      );
      const available = MAX_DECODED_TEXTURE_BYTES - retained.reduce((n, t) => n + t.out.length, 0);
      let names;
      if (metadata && metadata.reduce((n, t) => n + t.w * t.h * 4, 0) > available) {
        names = metadata
          .filter((t) => references.some((r) => textureNameMatches(r, t)))
          .map((t) => t.name);
        warnings.push(
          file.name +
            ': dictionary besar; hanya ' +
            names.length +
            '/' +
            metadata.length +
            ' map rujukan model dimuat.',
        );
        if (!names.length) continue;
      }
      const result = ytd
        ? await decode('texture-set', await file.arrayBuffer(), {
            names,
            maxDecodedBytes: available,
          })
        : { textures: await image(file, { maxDecodedBytes: available }), warnings: [] };
      if (result.textures.reduce((n, t) => n + t.out.length, 0) > available)
        throw Error('Model textures exceed ' + textureBudgetLabel + '.');
      const merged = mergeVehicleTextures(
        textures,
        result.textures.map((t) => ({ ...t, dictionary: file.name })),
      );
      textures.splice(0, textures.length, ...merged);
      warnings.push(...result.warnings.map((w) => file.name + ': ' + w));
    } catch (error) {
      warnings.push(file.name + ': ' + error.message);
    }
  }
  return { textures, warnings };
}
