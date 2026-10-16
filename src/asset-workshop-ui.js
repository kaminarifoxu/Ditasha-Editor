// Arrange existing controls without replacing nodes, IDs, listeners or editor state.
export function mountAssetWorkshopUi() {
  const $ = (id) => document.getElementById(id);
  document
    .querySelectorAll(
      'main, .tool-workspace, .archive-workspace, .asset-viewer, .native-build-workspace, .debadge-workspace, .vehicle-workspace, .embedded-ide-workspace',
    )
    .forEach((root) => root.classList.add('asset-workshop-surface'));
  function group(title, nodes, className = '') {
    nodes = nodes.filter(Boolean);
    if (!nodes.length) return;
    const box = document.createElement('section');
    box.className = 'workshop-control-group ' + className;
    box.setAttribute('aria-label', title);
    const heading = document.createElement('h3');
    heading.textContent = title;
    nodes[0].before(box);
    box.append(heading, ...nodes);
    return box;
  }
  function cluster(title, nodes) {
    nodes = nodes.filter(Boolean);
    if (!nodes.length) return;
    const box = document.createElement('div');
    box.className = 'workshop-tool-cluster';
    box.dataset.label = title;
    box.setAttribute('role', 'group');
    box.setAttribute('aria-label', title);
    nodes[0].before(box);
    box.append(...nodes);
  }
  cluster('Paint', ['brush', 'eraser', 'eyedropper', 'fillLayer', 'color', 'size'].map($));
  cluster('Transform', ['move', 'crop', 'addImage', 'replace'].map($));
  cluster('History / zoom', ['undo', 'redo', 'zoomOut', 'zoomLabel', 'zoomIn'].map($));
  const extra = document.querySelector('.editor-layer-actions');
  if (extra) {
    extra.classList.add('workshop-tool-cluster');
    extra.dataset.label = 'Layer';
    extra.setAttribute('role', 'group');
    extra.setAttribute('aria-label', 'Layer');
  }
  for (const [selector, title] of [
    ['.editor-commandbar .modeltools', 'Model / camera'],
    ['.editor-commandbar .canvasoptions', 'Canvas'],
  ]) {
    const node = document.querySelector(selector);
    node?.classList.add('workshop-tool-cluster');
    if (node) {
      node.dataset.label = title;
      node.setAttribute('role', 'group');
      node.setAttribute('aria-label', title);
    }
  }
  ['brush', 'eraser', 'move', 'crop', 'addImage', 'replace'].forEach((id) =>
    $(id)?.classList.add('workshop-show-label'),
  );
  const sidebar = document.querySelector('.model-viewer .tool-sidebar');
  if (sidebar) {
    group('File & textures', [$('mvOpen')?.parentElement, $('mvAddModels'), $('mvModels')]);
    group('Preview & LOD', [sidebar.querySelector('.viewer-options')]);
    const partsTitle = $('mvParts')?.previousElementSibling?.previousElementSibling;
    if (partsTitle?.tagName === 'H3') partsTitle.remove();
    group('Parts & visibility', [$('mvShowAll')?.parentElement, $('mvParts')]);
    const texturesTitle = $('mvTextures')?.previousElementSibling;
    if (texturesTitle?.tagName === 'H3') texturesTitle.remove();
    group('Loaded textures', [$('mvTextures')]);
  }
  const actions = document.querySelector('.archive-actions');
  if (actions) {
    group(
      'Open & inspect',
      [
        'archivePreview',
        'archiveModelViewer',
        'archiveInspect',
        'archiveCodeEditor',
        'archiveNested',
      ].map($),
      'workshop-action-grid',
    );
    group(
      'Copy & extract',
      ['archiveCopyName', 'archiveCopyPath', 'archiveExtract'].map($),
      'workshop-action-grid',
    );
    group(
      'Modify archive',
      ['archiveReplace', 'archiveAdd', 'archiveRemove'].map($),
      'workshop-action-grid',
    );
  }
  group(
    'Model & material',
    ['drawable', 'material', 'apply'].map((id) => $(id)?.closest('label')),
  );
  const inspector = document.querySelector('.inspector > .sectiontitle');
  if (inspector?.textContent.includes('MODEL')) inspector.remove();
}
