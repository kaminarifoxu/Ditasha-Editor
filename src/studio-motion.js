// Motion vocabulary informed by Owl-Listener/designer-skills; implementation is DITASHA's.
export function mountStudioMotion() {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  let preference = 'auto',
    transition;
  try {
    preference = localStorage.getItem('ditasha.motion') === 'off' ? 'off' : 'auto';
  } catch {}
  const enabled = () => preference !== 'off' && !reduced.matches;
  function sync() {
    document.body.dataset.motion = enabled() ? 'auto' : 'off';
    document.body.dataset.motionPaused = String(document.hidden);
    const button = document.getElementById('studioMotionToggle');
    if (button) {
      button.setAttribute('aria-pressed', String(!enabled()));
      button.querySelector('span').textContent = enabled() ? 'Animasi aktif' : 'Animasi nonaktif';
      button.title = enabled()
        ? 'Matikan animasi dekoratif'
        : reduced.matches
          ? 'Mengikuti preferensi reduced motion perangkat'
          : 'Aktifkan animasi';
    }
    if (!enabled()) transition?.cancel();
  }
  document.getElementById('studioMotionToggle')?.addEventListener('click', () => {
    preference = preference === 'off' ? 'auto' : 'off';
    try {
      localStorage.setItem('ditasha.motion', preference);
    } catch {}
    sync();
  });
  reduced.addEventListener('change', sync);
  document.addEventListener('visibilitychange', sync);
  document.addEventListener('ditasha:workspace', () => {
    transition?.cancel();
    if (!enabled() || document.hidden) return;
    const root = [...document.body.children].find(
      (el) =>
        !el.hidden &&
        el.matches(
          'main, .tool-workspace, .asset-viewer, .archive-workspace, .vehicle-workspace, .studio-home',
        ),
    );
    transition = root?.animate(
      [
        { opacity: 0.55, transform: 'translateY(8px)' },
        { opacity: 1, transform: 'translateY(0)' },
      ],
      { duration: 240, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' },
    );
  });
  // A workspace stays immediately usable even when a transition is interrupted.
  document.addEventListener('pointerdown', () => transition?.cancel(), { capture: true });
  sync();
}
