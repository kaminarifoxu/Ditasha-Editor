// Decode the next grid model while the shared WebGL renderer draws the
// current model. Limit lookahead in the UI to avoid retaining hundreds of
// decoded meshes/textures for a page of 250 YDDs.
export async function prepareThumbnailModel(file, api, decode) {
  if (!/\.(ydd|ydr|yft)$/i.test(file.name)) return null;
  const data = await api.read(file.id);
  const kind = file.name.split('.').at(-1).toLowerCase();
  const ids = [...new Set((file.textures || []).map((t)=>t.id).filter(Boolean))];
  const firstId = ids[0] || data.companion?.id;
  const modelPromise = decode(kind,new Uint8Array(data.data).buffer);
  const texturePromise = firstId ? api.read(firstId)
    .then((t)=>decode('ytd',new Uint8Array(t.data).buffer))
    .then((t)=>t.textures)
    .catch(()=>null) : Promise.resolve(null);
  const [drawables, firstTextures] = await Promise.all([modelPromise,texturePromise]);
  const textures = new Map();
  if (firstTextures) textures.set(firstId,firstTextures);
  return {data:{name:data.name,companion:data.companion},drawables,textures};
}
