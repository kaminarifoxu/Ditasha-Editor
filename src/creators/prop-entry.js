/**
 * Phase 3: a discoverable Asset Workshop entry without changing the existing
 * workspace shell or moving any pre-existing tools.
 */
export function mountPropCreatorEntry({ nav, activate, mountInspector }) {
  if (!nav || typeof activate !== 'function' || typeof mountInspector !== 'function') {
    throw new Error('Prop Creator navigation dependencies missing');
  }
  const workshop = nav.querySelector('.workshop-nav');
  const viewer = workshop?.querySelector('[data-page="modelviewer"]');
  if (!workshop || !viewer) throw new Error('Existing Model viewer navigation not found');
  const existing = workshop.querySelector('[data-page="propcreator"]');
  if (existing) return existing;
  const button = document.createElement('button');
  button.type = 'button';
  button.dataset.page = 'propcreator';
  button.setAttribute('aria-label', 'Prop & Collision Creator');
  button.title = 'Prop & Collision Creator';
  button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2 9 5v10l-9 5-9-5V7l9-5Zm0 10 9-5M12 12 3 7M12 12v10"/><path d="M8 8h8" stroke-dasharray="2 2"/></svg><span class="nav-label">Prop & Collision Creator</span>';
  viewer.after(button);
  button.addEventListener('click', async () => {
    // The existing editor owns the actual Three.js model + texture scene.
    // Switching to the separate Model viewer would display the wrong scene.
    activate('editor');
    let panel;
    try { panel = await mountInspector(); }
    catch (error) { console.error('Prop Creator could not open:', error); return; }
    panel.open = true;
    document.querySelector('#workspaceLabel').textContent = 'Prop & Collision Creator';
    nav.querySelectorAll('button.active').forEach(item => item.classList.remove('active'));
    button.classList.add('active');
    button.setAttribute('aria-current', 'page');
    panel.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
  });
  return button;
}
