import { ICON_CODES } from './ui-icons.js';

const actions = {
  brush: 'brush',
  eraser: 'eraser',
  move: 'arrows',
  crop: 'tool-crop',
  addImage: 'layers',
  replace: 'exchange',
  undo: 'undo',
  redo: 'redo',
  zoomIn: 'zoom-in',
  zoomOut: 'zoom-out',
  canvasSize: 'resize',
  duplicateLayer: 'copy',
  layerUp: 'arrow-up',
  layerDown: 'arrow-down',
  deleteLayer: 'trash',
  reset: 'refresh',
  wire: 'cube',
  snapshot: 'camera',
  photoshoot: 'camera',
  mvPhotoshoot: 'camera',
  addPng3d: 'picture',
  mvAddModels: 'plus',
  stickerBake: 'check',
  stickerMove: 'arrows',
  editTexture2d: 'picture',
  editTexture3d: 'cube',
  stickerRemove: 'trash',
  stickerClear: 'trash',
  psExport: 'download',
  psReset: 'refresh',
  psBackground: 'picture',
  psLogo: 'picture',
  psClearBackground: 'trash',
  psClearLogo: 'trash',
  expand3d: 'expand',
  rotateLeft: 'rotate-left',
  rotateRight: 'rotate-right',
  mirrorX: 'reflect-horizontal',
  mirrorY: 'reflect-vertical',
  fitImage: 'expand',
  applyCrop: 'check',
  cancelCrop: 'cross',
  help: 'interrogation',
  openUpdates: 'refresh',
  donate: 'heart',
  open: 'folder-open',
  drop: 'folder-open',
  addImageSidebar: 'layers',
  pngExport: 'file-export',
  ytdExport: 'disk',
  newTab: 'plus',
  openTexture: 'picture',
  toolAdd: 'plus',
  toolFolder: 'folder',
  toolClear: 'trash',
  packPreview: 'cube',
  toolRun: 'exchange',
  saveAll: 'file-zipper',
  tvOpen: 'picture',
  tvExport: 'download',
  tvExportAll: 'file-zipper',
  tvFit: 'expand',
  tvOriginal: 'resize',
  tvZoomIn: 'zoom-in',
  tvZoomOut: 'zoom-out',
  mvOpen: 'cube',
  mvAddTextures: 'picture',
  mvShowAll: 'eye',
  mvHideAll: 'eye-crossed',
  mvFit: 'expand',
  mvFront: 'cube',
  mvSide: 'cube',
  mvTop: 'cube',
  mvSnapshot: 'camera',
  archiveOpen: 'folder-open',
  archiveOpenFolder: 'folder',
  archiveNew: 'plus',
  archiveBack: 'arrow-left',
  archivePreview: 'layers',
  archiveTextureViewer: 'picture',
  archiveModelViewer: 'cube',
  archiveInspect: 'document',
  archiveCopyName: 'copy',
  archiveCopyPath: 'copy',
  archiveNested: 'folder-open',
  archiveExtract: 'download',
  archiveReplace: 'exchange',
  archiveRemove: 'trash',
  archiveAdd: 'plus',
  archiveExport: 'disk',
  archiveExtractAll: 'file-zipper',
  inspectorPrevious: 'arrow-left',
  inspectorNext: 'arrow-right',
  inspectorClose: 'cross',
};
const pages = {
  editor: 'layers',
  converter: 'exchange',
  pack: 'tshirt',
  textureviewer: 'picture',
  modelviewer: 'cube',
  archives: 'folder',
};
const labels = {
  'Ganti YTD rambut': 'picture',
  'Hapus YTD rambut': 'trash',
  'Reset posisi': 'refresh',
  'Hapus rambut': 'trash',
  Simpan: 'disk',
  Tersimpan: 'check',
};
const keepLabels = new Set([
  'open',
  'drop',
  'addImageSidebar',
  'openTexture',
  'pngExport',
  'ytdExport',
  'toolRun',
  'saveAll',
  'tvOpen',
  'tvExport',
  'tvExportAll',
  'mvOpen',
  'photoshoot',
  'addPng3d',
  'stickerBake',
  'stickerMove',
  'editTexture2d',
  'editTexture3d',
  'mvAddModels',
  'mvPhotoshoot',
  'psExport',
  'psBackground',
  'psLogo',
  'archiveOpen',
  'archiveNew',
  'archiveExport',
  'archiveExtractAll',
]);
function icon(name) {
  const el = document.createElement('i');
  el.className = 'di-icon';
  el.setAttribute('aria-hidden', 'true');
  el.dataset.icon = name;
  el.dataset.glyph = String.fromCodePoint(parseInt(ICON_CODES[name], 16));
  return el;
}

export function mountMinimalUi() {
  function decorate(el) {
    const text = el.textContent.trim().replace(/\s+/g, ' ');
    let name = pages[el.dataset.page] || actions[el.id] || labels[text];
    if (/AddHair$/.test(el.id)) name = 'plus';
    if (/AddHairTextures$/.test(el.id)) name = 'picture';
    if (/RemoveHair$|ClearHair$/.test(el.id)) name = 'trash';
    if (/MaterialReset$/.test(el.id)) name = 'refresh';
    if (el.classList.contains('filedelete')) name = 'trash';
    if (text === '×' || el.classList.contains('tabclose')) name = 'cross';
    if (!name) return;
    if (el.id === 'expand3d')
      name = el.getAttribute('aria-expanded') === 'true' ? 'compress' : 'expand';
    const oldIcon = el.querySelector(':scope > .di-icon');
    const oldLabel = el.querySelector(':scope > .control-label');
    if (oldIcon && oldLabel) {
      if (oldIcon.dataset.icon !== name) oldIcon.replaceWith(icon(name));
      const nextLabel = oldLabel.textContent.trim().replace(/\s+/g, ' ');
      if (el.dataset.autoLabel === 'true' && el.getAttribute('aria-label') !== nextLabel) {
        el.setAttribute('aria-label', nextLabel);
        el.title = nextLabel;
      }
      return;
    }
    const accessible =
      el.dataset.autoLabel === 'true' ? text : el.getAttribute('aria-label') || el.title || text;
    if (!el.hasAttribute('aria-label') || el.dataset.autoLabel === 'true') {
      el.setAttribute('aria-label', accessible);
      el.dataset.autoLabel = 'true';
    }
    el.title = accessible;
    el.querySelectorAll(':scope > svg').forEach((svg) => svg.remove());
    const badge = el.id === 'openUpdates' ? document.getElementById('updateBadge') : null;
    badge?.remove();
    const label = document.createElement('span');
    label.className = 'control-label';
    while (el.firstChild) label.append(el.firstChild);
    el.append(icon(name), label);
    if (badge) el.append(badge);
    const compact = !el.dataset.page && !keepLabels.has(el.id) && !/AddHair$/.test(el.id);
    el.classList.toggle('compact-icon', compact);
    el.classList.add('icon-control');
  }
  function arrange(root) {
    root.querySelectorAll('.hair-card').forEach((card) => {
      const buttons = [...card.querySelectorAll(':scope > button')];
      if (!buttons.length) return;
      const row = document.createElement('div');
      row.className = 'hair-actions';
      card.append(row);
      buttons.forEach((button) => row.append(button));
    });
  }
  function hint(root, selectors, label) {
    const paragraphs = [...root.querySelectorAll(selectors)];
    if (!paragraphs.length) return;
    const details = document.createElement('details');
    details.className = 'hint-details';
    const summary = document.createElement('summary');
    summary.append(icon('info'), document.createTextNode(label));
    details.append(summary, ...paragraphs);
    root.append(details);
  }
  document
    .querySelectorAll('.ped-attachments')
    .forEach((root) => hint(root, ':scope > p:not([id])', 'Tentang preview rambut'));
  document
    .querySelectorAll('.material-preview')
    .forEach((root) => hint(root, ':scope > p', 'Tentang alpha'));
  for (const id of ['convertSettings', 'packSettings']) {
    const root = document.getElementById(id);
    if (root) hint(root, ':scope > p', 'Petunjuk format');
  }
  document
    .querySelectorAll('.asset-viewer.model-viewer .tool-sidebar')
    .forEach((root) => hint(root, ':scope > p', 'Tentang model'));
  document.querySelectorAll('button, #donate').forEach(decorate);
  arrange(document);
  new MutationObserver((records) => {
    const targets = new Set(),
      containers = new Set();
    for (const record of records) {
      const parent = record.target.nodeType === 1 ? record.target : record.target.parentElement;
      const button = parent?.closest('button, #donate');
      if (button) targets.add(button);
      for (const node of record.addedNodes) {
        if (node.nodeType !== 1) continue;
        if (node.matches('button, #donate')) targets.add(node);
        node.querySelectorAll('button, #donate').forEach((b) => targets.add(b));
        if (node.matches('.hair-card') && node.parentElement) containers.add(node.parentElement);
      }
    }
    targets.forEach(decorate);
    containers.forEach(arrange);
  }).observe(document.body, { childList: true, subtree: true, characterData: true });
  document.querySelectorAll('[data-icon-credits]').forEach((link) => {
    link.onclick = async (event) => {
      if (!window.ditashaDesktop?.openIconCredits) return;
      event.preventDefault();
      await window.ditashaDesktop.openIconCredits();
    };
  });
}
