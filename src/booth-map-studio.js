import * as T from 'three';
import { openArchive } from './archives.js';
import { hashName } from './asset-tools.js';
import {
  textureNameMatches,
  resolveModelTexture,
  modelPreviewAlpha,
  modelAlphaMode,
} from './model-material.js';
import { modelTextureReferences } from './vehicle-textures.js';
import { createModelMaterial, resolveSurfaceMaps, setSurfaceMaps } from './vehicle-surface.js';
const stem = (n) =>
  n
    .split(/[\\/]/)
    .at(-1)
    .replace(/\.[^.]+$/, '')
    .toLowerCase();
const allowed = /\.(ymap|ytyp|ydr|ydd|ytd)$/i;
export async function expandStudioFiles(inputs) {
  const files = [];
  let size = 0;
  for (const f of inputs) {
    if (/\.zip$/i.test(f.name)) {
      if (f.size > 512 * 1024 ** 2) throw Error('ZIP studio maksimal 512 MB.');
      const zip = await openArchive(f),
        entries = zip.entries.filter((e) => !e.directory && allowed.test(e.name));
      if (
        entries.length + files.length > 2000 ||
        entries.reduce((n, e) => n + e.size, 0) + size > 512 * 1024 ** 2
      )
        throw Error('Studio maksimal 2000 file / 512 MB.');
      for (const e of entries) {
        if (e.size > (/\.ytd$/i.test(e.name) ? 256 : 64) * 1024 ** 2)
          throw Error(e.name + ': file studio terlalu besar.');
        const data = await zip.extract(e);
        files.push(new File([data], e.name));
        size += e.size;
      }
    } else if (allowed.test(f.name)) {
      if (f.size > (/\.ytd$/i.test(f.name) ? 256 : 64) * 1024 ** 2)
        throw Error(f.name + ': file studio terlalu besar.');
      const name = f.webkitRelativePath || f.name;
      files.push(new File([f], name));
      size += f.size;
    }
  }
  if (!files.length || files.length > 2000 || size > 512 * 1024 ** 2)
    throw Error('Pilih resource studio dengan YMAP/YTYP, model dan YTD (maksimal 512 MB).');
  return files;
}
export async function prepareStudioPack(pack, decode) {
  const maps = [],
    archetypes = [];
  for (const f of pack.files.filter((f) => /\.(ymap|ytyp)$/i.test(f.name))) {
    const meta = await decode('map-meta', await f.arrayBuffer());
    if (meta.kind === 'ymap') maps.push({ name: stem(f.name), entities: meta.entities });
    else archetypes.push(...meta.archetypes);
  }
  if (maps.length > 256 || archetypes.length > 50000)
    throw Error('Studio melebihi batas map/archetype.');
  if (!maps.length) throw Error('Resource tidak memiliki YMAP yang dapat dibaca.');
  return { ...pack, maps, archetypes };
}
export function studioEntityMatrix(e) {
  const q = new T.Quaternion(...e.rotation).normalize();
  if (!e.isMlo) q.invert();
  const basis = new T.Matrix4().makeRotationX(-Math.PI / 2);
  return new T.Matrix4()
    .compose(new T.Vector3(...e.position), q, new T.Vector3(...e.scale))
    .premultiply(basis)
    .multiply(basis.clone().invert());
}
export async function buildMapStudio(
  pack,
  index,
  decode,
  { maxTextureBytes = 256 * 1024 ** 2, cutawayPlane } = {},
) {
  const map = pack.maps[index];
  if (!map) throw Error('Studio tidak ditemukan dalam resource.');
  const warnings = [],
    instances = [],
    models = new Map(),
    textures = [],
    texLoaded = new Set();
  let vertices = 0,
    bytes = 0;
  const types = new Map();
  for (const a of pack.archetypes) {
    const old = types.get(a.hash);
    if (old && old.asset !== a.asset) throw Error('Archetype studio ambigu.');
    types.set(a.hash, a);
  }
  const sources = pack.files.filter((f) => /\.(ydr|ydd)$/i.test(f.name)),
    ytds = pack.files.filter((f) => /\.ytd$/i.test(f.name));
  function visit(e, parent = new T.Matrix4(), seen = new Set()) {
    if (instances.length >= 2048) throw Error('Studio melebihi 2048 instance.');
    const a = types.get(e.hash),
      m = parent.clone().multiply(studioEntityMatrix(e));
    const matches = sources.filter(
      (f) =>
        hashName(stem(f.name)) === (a?.asset || e.hash) ||
        (a?.drawableDictionary && hashName(stem(f.name)) === a.drawableDictionary),
    );
    if (matches.length === 1)
      instances.push({ file: matches[0], matrix: m, archetype: a, hash: e.hash });
    else
      warnings.push(
        'Model ' + e.hash.toString(16) + (matches.length ? ' ambigu' : ' belum tersedia'),
      );
    if (a?.isMlo) {
      if (seen.has(e.hash) || seen.size >= 8) throw Error('Cyclic MLO hierarchy.');
      const next = new Set(seen).add(e.hash);
      for (const child of a.entities) visit(child, m, next);
      if (a.hasEntitySets) warnings.push('Entity set dinamis belum disertakan.');
    }
  }
  for (const e of map.entities.filter((e) => e.lod === 0 || e.lod === 5)) visit(e);
  if (!instances.length)
    throw Error('Model studio tidak ditemukan. Sertakan model/dependensi YDR atau YDD.');
  let sourceVertices = 0;
  for (const { file } of instances)
    if (!models.has(file.name)) {
      const d = await decode(
        file.name.toLowerCase().endsWith('.ydd') ? 'ydd' : 'ydr',
        await file.arrayBuffer(),
      );
      sourceVertices += d.reduce(
        (n, d) =>
          n +
          (d.lods.find((l) => l.name === 'High') || d.lods[0]).geometries.reduce(
            (n, g) => n + g.positions.length / 3,
            0,
          ),
        0,
      );
      if (sourceVertices > 4000000) throw Error('Studio melebihi 4 juta vertex sumber.');
      models.set(file.name, d);
    }
  const refs = modelTextureReferences([...models.values()].flat());
  const embeddedBytes = [...models.values()]
    .flat()
    .reduce((n, d) => n + (d.embeddedTextures || []).reduce((n, t) => n + t.out.length, 0), 0);
  bytes += embeddedBytes;
  for (const { file, archetype: a } of instances) {
    const dicts = ytds.filter(
      (f) => hashName(stem(f.name)) === a?.texture || stem(f.name) === stem(file.name),
    );
    for (const f of dicts) {
      if (texLoaded.has(f.name)) continue;
      texLoaded.add(f.name);
      const metadata = await decode('texture-index', await f.arrayBuffer()),
        names = metadata
          .filter((t) => refs.some((n) => textureNameMatches(n, t)))
          .map((t) => t.name);
      if (!names.length) continue;
      const result = await decode('texture-set', await f.arrayBuffer(), {
        names,
        maxDecodedBytes: Math.max(0, maxTextureBytes - bytes),
      });
      warnings.push(...result.warnings.map((w) => f.name + ': ' + w));
      for (const t of result.textures) {
        textures.push({ ...t, dictionary: f.name });
        bytes += t.out.length;
      }
    }
  }
  if (bytes > maxTextureBytes) throw Error('Tekstur studio melebihi batas decoded 256 MB.');
  const root = new T.Group(),
    content = new T.Group();
  root.add(content);
  const origin = new T.Vector3().setFromMatrixPosition(instances[0].matrix),
    textureCache = new Map(),
    geometryCache = new Map(),
    materialCache = new Map();
  const textureMap = (t, role = 'color') => {
    if (!t) return null;
    let roles = textureCache.get(t);
    if (!roles) {
      roles = new Map();
      textureCache.set(t, roles);
    }
    if (roles.has(role)) return roles.get(role);
    const map = new T.DataTexture(new Uint8Array(t.out), t.w, t.h, T.RGBAFormat);
    map.colorSpace = role === 'color' ? T.SRGBColorSpace : T.NoColorSpace;
    map.flipY = false;
    map.wrapS = map.wrapT = T.RepeatWrapping;
    map.needsUpdate = true;
    roles.set(role, map);
    return map;
  };
  try {
    for (const instance of instances) {
      const holder = new T.Group();
      holder.matrix.copy(instance.matrix);
      holder.matrix.elements[12] -= origin.x;
      holder.matrix.elements[13] -= origin.y;
      holder.matrix.elements[14] -= origin.z;
      holder.matrix.decompose(holder.position, holder.quaternion, holder.scale);
      content.add(holder);
      for (const d of models.get(instance.file.name))
        for (const g of (d.lods.find((l) => l.name === 'High') || d.lods[0]).geometries) {
          vertices += g.positions.length / 3;
          if (vertices > 4000000) throw Error('Studio melebihi 4 juta vertex.');
          let geom = geometryCache.get(g);
          if (!geom) {
            geom = new T.BufferGeometry();
            geom.setAttribute('position', new T.BufferAttribute(g.positions, 3));
            if (g.uvs) geom.setAttribute('uv', new T.BufferAttribute(g.uvs, 2));
            geom.setIndex(new T.BufferAttribute(g.indices, 1));
            if (g.normals) geom.setAttribute('normal', new T.BufferAttribute(g.normals, 3));
            else geom.computeVertexNormals();
            geometryCache.set(g, geom);
          }
          let material = materialCache.get(g);
          if (!material) {
            const own = textures.filter(
              (t) =>
                hashName(stem(t.dictionary)) === instance.archetype?.texture ||
                stem(t.dictionary) === stem(instance.file.name),
            );
            const t = resolveModelTexture(
              g.diffuseTexture,
              own,
              d.embeddedTextures || [],
              instance.file.name,
            );
            if (g.diffuseTexture && !t)
              warnings.push('Tekstur ' + g.diffuseTexture + ' belum tersedia.');
            const alpha = modelPreviewAlpha(g) || { mode: modelAlphaMode(g), cutoff: 0.02 };
            material = createModelMaterial(g, {
              color: t ? 0xffffff : 0xa7b1c0,
              map: textureMap(t),
              side: T.DoubleSide,
              transparent: alpha.mode === 'blend',
              alphaTest: alpha.mode === 'opaque' ? 0 : alpha.cutoff,
            });
            setSurfaceMaps(
              material,
              resolveSurfaceMaps(g, own, d.embeddedTextures || [], instance.file.name),
              textureMap,
            );
            if (
              ['emissive', 'emissive_alpha', 'emissive_additive'].some(
                (n) => hashName(n) === g.shaderHash,
              )
            ) {
              material.emissive = new T.Color(0xffffff);
              material.emissiveMap = material.map;
              material.emissiveIntensity = 0.8;
            }
            if (cutawayPlane) {
              material.clippingPlanes = [cutawayPlane];
              material.clipShadows = true;
            }
            materialCache.set(g, material);
          }
          const mesh = new T.Mesh(geom, material);
          mesh.receiveShadow = mesh.castShadow = true;
          holder.add(mesh);
        }
    }
    content.updateMatrixWorld(true);
    const box = new T.Box3().setFromObject(content);
    if (box.isEmpty() || ![...box.min, ...box.max].every(Number.isFinite))
      throw Error('Studio tidak memiliki batas valid.');
    content.position.set(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2);
    root.name = pack.label + ' / ' + map.name;
    root.userData = {
      decodedBytes: bytes,
      vertices,
      warnings: [...new Set(warnings)],
      studioMap: true,
    };
    return root;
  } catch (e) {
    geometryCache.forEach((g) => g.dispose());
    materialCache.forEach((m) => m.dispose());
    textureCache.forEach((roles) => roles.forEach((t) => t.dispose()));
    throw e;
  }
}
