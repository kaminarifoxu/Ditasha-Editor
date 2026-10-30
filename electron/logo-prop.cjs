'use strict';
function validateLogo(logo) {
  if (!logo || typeof logo !== 'object' || Array.isArray(logo))
    throw Error('Data logo tidak valid.');
  const { positions, uvs, materials, texture, sideColor } = logo;
  if (
    !Array.isArray(positions) ||
    !positions.length ||
    positions.length > 540000 ||
    positions.length % 9 ||
    positions.some((n) => !Number.isFinite(n) || Math.abs(n) > 25) ||
    !Array.isArray(uvs) ||
    uvs.length !== (positions.length / 3) * 2 ||
    uvs.some((n) => !Number.isFinite(n) || Math.abs(n) > 4) ||
    !Array.isArray(materials) ||
    materials.length !== positions.length / 9 ||
    materials.some((n) => n !== 0 && n !== 1) ||
    !Array.isArray(sideColor) ||
    sideColor.length !== 3 ||
    sideColor.some((n) => !Number.isFinite(n) || n < 0 || n > 1)
  )
    throw Error('Mesh logo melebihi batas atau tidak valid.');
  if (
    typeof texture !== 'string' ||
    texture.length > 12 * 1024 ** 2 ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(texture)
  )
    throw Error('PNG logo tidak valid atau terlalu besar.');
  const png = Buffer.from(texture, 'base64');
  if (
    png.length < 33 ||
    png.length > 8 * 1024 ** 2 ||
    png.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a' ||
    png.subarray(12, 16).toString() !== 'IHDR'
  )
    throw Error('Tekstur logo harus PNG.');
  const w = png.readUInt32BE(16),
    h = png.readUInt32BE(20);
  if (w < 1 || h < 1 || w > 2048 || h > 2048) throw Error('Tekstur logo maksimal 2048 px.');
  return { positions, uvs, materials, texture, sideColor };
}
module.exports = { validateLogo };
