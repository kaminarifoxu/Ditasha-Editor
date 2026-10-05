module.exports = async function checkIcons() {
  const assert = (ok, message) => {
    if (!ok) throw Error(message);
  };
  await document.fonts.load('18px "Ditasha Uicons"');
  assert(
    [...document.fonts].some(
      (font) => font.family === 'Ditasha Uicons' && font.status === 'loaded',
    ),
    'Offline Flaticon font failed to load',
  );
  for (const id of [
    'brush',
    'eraser',
    'undo',
    'redo',
    'reset',
    'snapshot',
    'donate',
    'archiveRemove',
    'mvFit',
    'tvZoomIn',
  ]) {
    const button = document.getElementById(id);
    const icon = button.querySelector(':scope > .di-icon');
    assert(
      icon && icon.getAttribute('aria-hidden') === 'true' && icon.dataset.glyph,
      'Missing decorative icon: ' + id,
    );
    assert(button.getAttribute('aria-label') && button.title, 'Unlabelled icon action: ' + id);
  }
  const brush = document.getElementById('brush');
  brush.focus();
  assert(document.activeElement === brush, 'Icon action is not keyboard focusable');
  assert(
    getComputedStyle(brush.querySelector('.control-label')).position === 'absolute',
    'Brush text still clutters toolbar',
  );
  assert(
    !document.getElementById('ytdExport').classList.contains('compact-icon'),
    'Export format label hidden',
  );
  assert(
    document.getElementById('openUpdates').contains(document.getElementById('appVersion')),
    'Icon layout removed updater version',
  );
  assert(
    document.getElementById('openUpdates').contains(document.getElementById('updateBadge')),
    'Icon layout removed update notification badge',
  );
  const expand = document.getElementById('expand3d');
  expand.click();
  await new Promise((resolve) => setTimeout(resolve, 50));
  assert(
    expand.querySelector('.di-icon').dataset.icon === 'compress' &&
      expand.title.includes('Kembali'),
    'Expanded-view icon/tooltip did not update',
  );
  expand.click();
  await new Promise((resolve) => setTimeout(resolve, 50));
  assert(
    expand.querySelector('.di-icon').dataset.icon === 'expand' && expand.title.includes('Perbesar'),
    'Restored-view icon/tooltip did not update',
  );
  assert(
    document.querySelector('[data-icon-credits]').textContent.includes('Flaticon'),
    'Flaticon attribution missing',
  );
  return {
    checks:
      'Offline Flaticon font, accessible action names, keyboard focus, preserved export labels/update nodes, dynamic expand icon and attribution',
  };
};
