'use strict';
const path = require('node:path');
const { ClothingLibrary } = require('./clothing-library.cjs');

// Separate feature service: preserve all existing editor IPC and Creative Suite UI.
function registerClothingLibrary({ app, ipcMain, dialog, win, trusted }) {
  const library = new ClothingLibrary(path.join(app.getPath('userData'), 'clothing-library-v2'));
  const handle = (channel, action) => ipcMain.handle(channel, (event, ...args) => {
    trusted(event);
    return action(...args);
  });
  handle('ditasha:clothing-list', () => library.list());
  handle('ditasha:clothing-preview-read', (id, relativePath) => library.readAsset(id, relativePath));
  handle('ditasha:clothing-rename', (id, label) => library.rename(id, label));
  handle('ditasha:clothing-remove', id => library.remove(id));
  handle('ditasha:clothing-import', async pack => {
    const selection = await dialog.showOpenDialog(win, {
      title: 'Import custom clothing YDD/YTD',
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'GTA clothing files', extensions: ['ydd','ydr','yft','ytd','ymt','yld','meta','png','jpg','jpeg','webp'] }],
    });
    if (selection.canceled || !selection.filePaths.length) return null;
    return library.importFiles({ pack, files: selection.filePaths });
  });
  handle('ditasha:clothing-import-folder', async pack => {
    const selection = await dialog.showOpenDialog(win, {
      title: 'Import folder pakaian FiveM',
      properties: ['openDirectory'],
    });
    if (selection.canceled || !selection.filePaths.length) return null;
    return library.importDirectory({ pack, directory: selection.filePaths[0] });
  });
  handle('ditasha:freemode-import-folder', async () => {
    const selection = await dialog.showOpenDialog(win, {
      title: 'Pilih folder model freemode',
      properties: ['openDirectory'],
    });
    if (selection.canceled || !selection.filePaths.length) return null;
    const imported = await library.importDirectory({ pack: 'DITASHA Freemode Library', directory: selection.filePaths[0] });
    const heads = imported.files.filter(f => f.component === 'head' && /\.ydd$/i.test(f.name));
    if (!heads.some(f => f.gender === 'male' || f.gender === 'female')) {
      await library.remove(imported.id);
      throw Error('Folder tidak berisi head YDD freemode pria/wanita.');
    }
    return { id: imported.id, count: imported.files.length };
  });
  handle('ditasha:outfits-list', () => library.listOutfits());
  handle('ditasha:outfits-save', outfit => library.saveOutfit(outfit));
  handle('ditasha:outfits-remove', id => library.removeOutfit(id));
}
module.exports = { registerClothingLibrary };
