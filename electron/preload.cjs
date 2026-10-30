const { contextBridge, ipcRenderer, webUtils } = require('electron');
contextBridge.exposeInMainWorld('ditashaGtaInstall', {
  state: () => ipcRenderer.invoke('ditasha:gta-install-state'),
  choose: () => ipcRenderer.invoke('ditasha:gta-install-choose'),
  scan: () => ipcRenderer.invoke('ditasha:gta-install-scan'),
  read: (id, start, length) => ipcRenderer.invoke('ditasha:gta-install-read', id, start, length),
  reveal: () => ipcRenderer.invoke('ditasha:gta-install-reveal'),
});
contextBridge.exposeInMainWorld('ditashaCraft', {
  state: () => ipcRenderer.invoke('ditasha:craft-state'),
  start: (id) => ipcRenderer.invoke('ditasha:craft-start', id),
  layout: (bounds) => ipcRenderer.invoke('ditasha:craft-layout', bounds),
  close: (id) => ipcRenderer.invoke('ditasha:craft-close', id),
});
contextBridge.exposeInMainWorld('ditashaFiles', {
  state: () => ipcRenderer.invoke('ditasha:files-state'),
  filesApp: (value) => ipcRenderer.invoke('ditasha:files-filesApp', value),
  choose: (refresh = false) => ipcRenderer.invoke('ditasha:files-choose', refresh),
  list: (query) => ipcRenderer.invoke('ditasha:files-list', query),
  read: (id) => ipcRenderer.invoke('ditasha:files-read', id),
  plan: (query) => ipcRenderer.invoke('ditasha:files-plan', query),
  sort: (id) => ipcRenderer.invoke('ditasha:files-sort', id),
  cancel: () => ipcRenderer.invoke('ditasha:files-cancel'),
  reveal: (id) => ipcRenderer.invoke('ditasha:files-reveal', id),
  subscribe: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('ditasha:files-progress', listener);
    return () => ipcRenderer.removeListener('ditasha:files-progress', listener);
  },
});
contextBridge.exposeInMainWorld('ditashaIDE', {
  state: () => ipcRenderer.invoke('ditasha:embedded-ide-state'),
  choose: () => ipcRenderer.invoke('ditasha:embedded-ide-choose'),
  start: () => ipcRenderer.invoke('ditasha:embedded-ide-start'),
  layout: (bounds) => ipcRenderer.invoke('ditasha:embedded-ide-layout', bounds),
});
contextBridge.exposeInMainWorld('ganoUpdates', {
  getState: () => ipcRenderer.invoke('gano:update-state'),
  check: () => ipcRenderer.invoke('gano:update-check'),
  download: () => ipcRenderer.invoke('gano:update-download'),
  install: () => ipcRenderer.invoke('gano:update-install'),
  updateNow: () => ipcRenderer.invoke('gano:update-now'),
  setAutoDownload: (enabled) => ipcRenderer.invoke('gano:update-auto', enabled),
  subscribe: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('gano:update-state', listener);
    return () => ipcRenderer.removeListener('gano:update-state', listener);
  },
});

contextBridge.exposeInMainWorld('ditashaDesktop', {
  ready: () => ipcRenderer.send('ditasha:ready'),
  openIconCredits: () => ipcRenderer.invoke('ditasha:open-icon-credits'),
  openDonation: () => ipcRenderer.invoke('ditasha:open-donation'),
  saveExport: (payload) => ipcRenderer.invoke('ditasha:save-export', payload),
});

contextBridge.exposeInMainWorld('ditashaNative', {
  state: () => ipcRenderer.invoke('ditasha:native-state'),
  setup: () => ipcRenderer.invoke('ditasha:native-setup'),
  save: (id) => ipcRenderer.invoke('ditasha:native-save', id),
  discard: (id) => ipcRenderer.invoke('ditasha:native-discard', id),
  preview: (id, pose = 'rest') => ipcRenderer.invoke('ditasha:native-preview', id, pose),
  saveReview: (id) => ipcRenderer.invoke('ditasha:native-save-review', id),
  pick: (kind) => ipcRenderer.invoke('ditasha:native-pick', kind),
  docs: (kind) => ipcRenderer.invoke('ditasha:native-doc', kind),
  start: (payload) => ipcRenderer.invoke('ditasha:native-start', payload),
  cancel: () => ipcRenderer.invoke('ditasha:native-cancel'),
  reveal: () => ipcRenderer.invoke('ditasha:native-reveal'),
});

contextBridge.exposeInMainWorld('ditashaDiscord', {
  state: () => ipcRenderer.invoke('ditasha:discord-state'),
  configure: (value) => ipcRenderer.invoke('ditasha:discord-configure', value),
  workspace: (value) => ipcRenderer.invoke('ditasha:discord-workspace', value),
  project: (value) => ipcRenderer.invoke('ditasha:discord-project', value),
  docs: () => ipcRenderer.invoke('ditasha:discord-docs'),
});

contextBridge.exposeInMainWorld('ditashaCompressor', {
  begin: (entries) =>
    ipcRenderer.invoke(
      'ditasha:compressor-begin',
      entries.map((e) => ({ path: e.path, source: webUtils.getPathForFile(e.file) })),
    ),
  write: (value) => ipcRenderer.invoke('ditasha:compressor-write', value),
  finish: (value) => ipcRenderer.invoke('ditasha:compressor-finish', value),
  reveal: (id) => ipcRenderer.invoke('ditasha:compressor-reveal', id),
});

contextBridge.exposeInMainWorld('ditashaGtaTools', {
  state: () => ipcRenderer.invoke('ditasha:gta-tools-state'),
  install: (id, download = false) => ipcRenderer.invoke('ditasha:gta-tools-install', id, download),
  choose: (kind) => ipcRenderer.invoke('ditasha:gta-tools-choose', kind),
  run: (request) => ipcRenderer.invoke('ditasha:gta-tools-run', request),
  cancel: () => ipcRenderer.invoke('ditasha:gta-tools-cancel'),
  gui: (id) => ipcRenderer.invoke('ditasha:gta-tools-gui', id),
  output: (id) => ipcRenderer.invoke('ditasha:gta-tools-output', id),
  subscribe: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('ditasha:gta-tools-progress', listener);
    return () => ipcRenderer.removeListener('ditasha:gta-tools-progress', listener);
  },
});

contextBridge.exposeInMainWorld('ditashaClothing', Object.freeze({
  list: () => ipcRenderer.invoke('ditasha:clothing-list'),
  import: (pack) => ipcRenderer.invoke('ditasha:clothing-import', pack),
  remove: (id) => ipcRenderer.invoke('ditasha:clothing-remove', id),
  previewRead: (id, relativePath) => ipcRenderer.invoke('ditasha:clothing-preview-read', id, relativePath),
}));
