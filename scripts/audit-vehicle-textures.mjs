// Local read-only audit: node scripts/audit-vehicle-textures.mjs <folder> <model stems...>
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { readYft, indexYtd, readYtd } from '../src/resource.js';
import { resolveModelTexture, textureDependency } from '../src/model-material.js';
import { liveryReference, hasVisibleLiveryPixels } from '../src/vehicle-livery.js';
import { surfaceReferences, surfaceProfile } from '../src/vehicle-surface.js';
import { MAX_YTD_INPUT_BYTES } from '../src/texture-memory.js';

const [folder, ...models] = process.argv.slice(2);
if (!folder || !models.length)
  throw Error('Usage: audit-vehicle-textures.mjs <folder> <model stems...>');
async function read(name) {
  const p = path.join(folder, name);
  if ((await stat(p)).size > (/\.ytd$/i.test(name) ? MAX_YTD_INPUT_BYTES : 64 * 1024 ** 2))
    throw Error('Input too large: ' + name);
  const bytes = await readFile(p);
  return {
    buffer: new Uint8Array(bytes).buffer,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  };
}
for (const name of models) {
  if (path.basename(name) !== name) throw Error('Model stems must not contain folders.');
  const model = await read(name + '.yft'),
    dictionary = await read(name + '.ytd');
  const drawables = readYft(model.buffer),
    metadata = indexYtd(dictionary.buffer).map((t) => ({ ...t, dictionary: name + '.ytd' }));
  const geometries = drawables.flatMap((d) => d.lods.flatMap((l) => l.geometries));
  const references = [
    ...new Set(geometries.flatMap((g) => [g.diffuseTexture, liveryReference(g)]).filter(Boolean)),
  ];
  const missing = references.filter(
    (ref) => !resolveModelTexture(ref, metadata, [], name + '.yft'),
  );
  const layerNames = [...new Set(geometries.map(liveryReference).filter(Boolean))];
  const present = layerNames
    .map((ref) => resolveModelTexture(ref, metadata, [], name + '.yft')?.name)
    .filter(Boolean);
  const layers = present.length ? readYtd(dictionary.buffer, { names: present }).textures : [];
  console.log(
    JSON.stringify({
      model: name,
      sourceSha256: { yft: model.sha256, ytd: dictionary.sha256 },
      drawables: drawables.length,
      textures: metadata.length,
      decodedMB: Math.round(metadata.reduce((n, t) => n + t.w * t.h * 4, 0) / 1048576),
      defaultLayerMeshes: drawables[0].lods[0].geometries.filter((g) => liveryReference(g)).length,
      layerReferences: layerNames,
      emptyLayers: layers.filter((t) => !hasVisibleLiveryPixels(t)).map((t) => t.name),
      missing: missing.map((ref) => ({ name: ref, source: textureDependency(ref) })),
      materialSurfaces: Object.fromEntries(
        ['normal', 'specular'].map((role) => {
          const refs = [
            ...new Set(
              drawables[0].lods[0].geometries
                .map((g) => surfaceReferences(g)[role])
                .filter(Boolean),
            ),
          ];
          return [
            role,
            {
              references: refs.length,
              available: refs.filter((ref) =>
                resolveModelTexture(
                  ref,
                  metadata,
                  drawables[0].embeddedTextures || [],
                  name + '.yft',
                ),
              ).length,
            },
          ];
        }),
      ),
      nativeMaterialParameters: drawables[0].lods[0].geometries.filter(
        (g) => g.shaderParameters?.length,
      ).length,
      warnings: drawables.flatMap((d) => d.warnings || []),
    }),
  );
}
