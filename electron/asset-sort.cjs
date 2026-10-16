'use strict';
const path = require('node:path');
const CATEGORIES = {
  images: 'Gambar',
  clothing: 'Pakaian',
  hair: 'Rambut',
  vehicles: 'Kendaraan',
  models: 'Model lain',
  textures: 'Tekstur lain',
  archives: 'Arsip',
  other: 'Lainnya',
};
const slots = new Set([
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
  'p_head',
  'p_eyes',
  'p_ears',
  'p_lwrist',
  'p_rwrist',
]);
function segment(value) {
  return value.replace(/[^a-z0-9_-]/gi, '_').slice(0, 100) || 'unknown';
}
function classifyAssets(files) {
  const vehicles = new Set(
    files
      .filter((f) => /\.yft$/i.test(f.relative))
      .map(
        (f) =>
          path.posix.dirname(f.relative).toLowerCase() +
          '/' +
          path.posix
            .basename(f.relative, path.posix.extname(f.relative))
            .toLowerCase()
            .replace(/_hi$/, ''),
      ),
  );
  return files.map((file) => {
    const relative = file.relative,
      name = path.posix.basename(relative),
      ext = path.posix.extname(name).toLowerCase();
    const stem = name.slice(0, -ext.length).toLowerCase();
    let category = 'other',
      group = '',
      note = '';
    const component = stem.match(/(?:^|\^)((?:p_)?[a-z]+)_(?:diff_)?(\d{3,4})(?:_|$)/);
    if (['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.tga', '.tif', '.tiff'].includes(ext)) {
      category = 'images';
      group = ext.slice(1).toUpperCase();
    } else if (['.ydd', '.ytd', '.yld'].includes(ext) && component && slots.has(component[1])) {
      category = component[1] === 'hair' ? 'hair' : 'clothing';
      const gender = /mp_f_freemode/i.test(relative)
        ? 'Female'
        : /mp_m_freemode/i.test(relative)
          ? 'Male'
          : 'Unknown';
      const collection = stem.includes('^') ? segment(stem.split('^')[0]) : 'unprefixed';
      group = [gender, collection, component[1] + '_' + component[2]].join('/');
      if (gender === 'Unknown')
        note = 'Ped/gender belum diketahui; periksa collection sebelum dipasang.';
    } else if (
      ext === '.yft' ||
      (['.ytd', '.ybn'].includes(ext) &&
        vehicles.has(path.posix.dirname(relative).toLowerCase() + '/' + stem.replace(/_hi$/, '')))
    ) {
      category = 'vehicles';
      group = segment(stem.replace(/_hi$/, ''));
    } else if (
      ['.ydd', '.ydr', '.ybn', '.obj', '.fbx', '.glb', '.gltf', '.blend', '.stl'].includes(ext)
    ) {
      category = 'models';
      note = 'Jenis model perlu diperiksa; tidak ditebak sebagai pakaian atau kendaraan.';
    } else if (['.ytd', '.dds'].includes(ext)) {
      category = 'textures';
      note = 'Pasangan model belum teridentifikasi.';
    } else if (['.rpf', '.oiv', '.zip', '.7z', '.rar'].includes(ext)) category = 'archives';
    else if (['.ymt', '.meta', '.lua'].includes(ext))
      note = 'Metadata/skrip asli dipertahankan. Hasil sorting bukan resource siap ensure.';
    // Preserve the source hierarchy under each group: duplicate basenames cannot overwrite.
    return {
      ...file,
      category,
      group,
      note,
      destination: [CATEGORIES[category], group, relative].filter(Boolean).join('/'),
    };
  });
}
module.exports = { CATEGORIES, classifyAssets };
