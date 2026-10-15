export function mountEmbeddedIDE({ nav, openQuickEditor, toast }) {
  const root = document.createElement('section');
  root.className = 'embedded-ide-workspace';
  root.hidden = true;
  root.innerHTML = `<div class="embedded-ide-toolbar"><div><span class="eyebrow">CODE - OSS</span><strong>Integrated IDE</strong></div><button data-ide="quick">Quick edit file</button><button data-ide="engine">Choose engine…</button><button class="primary" data-ide="start">Start IDE</button></div><div class="embedded-ide-host"><div class="embedded-ide-welcome"><h2>Your coding workspace, inside DITASHA</h2><p>Full Code - OSS workbench with project Explorer, search, tabs, terminal, Git, extensions and debugging through a local engine.</p><p role="status">Checking IDE engine…</p><details data-ide="diagnostics" hidden><summary>Startup error details</summary><pre style="white-space:pre-wrap;overflow-wrap:anywhere;max-height:240px;overflow:auto"></pre><p data-ide="log-path"></p></details><details><summary>Engine setup & compatibility</summary><p>Windows builds include a local Code - OSS engine. Choose engine allows an advanced override with an extracted MIT server-web build. It must contain node, out/server-main.js and the web workbench. The engine runs locally; a regular Code.exe installation is not a server-web engine.</p><p>Git and language tools must be installed locally. Microsoft-only extensions and Marketplace services are not included. Extension availability depends on the engine; compatible VSIX packages can be installed from the IDE.</p></details></div></div>`;
  nav.after(root);
  const api = window.ditashaIDE;
  const host = root.querySelector('.embedded-ide-host');
  const status = root.querySelector('[role=status]');
  const welcome = root.querySelector('.embedded-ide-welcome');
  let running = false,
    pending = false,
    frame,
    lastLayout = '',
    latestState;
  const buttons = [...root.querySelectorAll('button')];
  function report(state) {
    latestState = state;
    status.textContent = state.message;
    root.querySelector('[data-ide=diagnostics]').hidden = !state.details;
    root.querySelector('[data-ide=diagnostics] pre').textContent = state.details || '';
    root.querySelector('[data-ide=log-path]').textContent = state.diagnosticsFile
      ? 'Error report saved to: ' + state.diagnosticsFile
      : '';
    if (state.details) root.querySelector('[data-ide=diagnostics]').open = true;
    running = state.status === 'ready';
    welcome.hidden = running;
    root.querySelector('[data-ide=start]').disabled =
      pending || !api || !state.installed || running;
    root.querySelector('[data-ide=engine]').disabled = pending || !api || running;
    schedule();
  }
  async function refresh() {
    if (!api)
      return report({
        message:
          'The integrated IDE requires DITASHA desktop and a Code - OSS engine. Quick edit remains available.',
      });
    try {
      report(await api.state());
    } catch (error) {
      status.textContent = error.message;
    }
  }
  function layout() {
    frame = null;
    if (!api) return;
    const r = host.getBoundingClientRect();
    const blocked = !!document.querySelector('dialog[open]');
    const bounds =
      !root.hidden && running && !blocked && r.width > 0 && r.height > 0
        ? { x: r.x, y: r.y, width: r.width, height: r.height }
        : null;
    const key = JSON.stringify(bounds);
    if (key === lastLayout) return;
    lastLayout = key;
    api.layout(bounds).catch((error) => toast(error.message));
  }
  function schedule() {
    if (!frame) frame = requestAnimationFrame(layout);
  }
  new ResizeObserver(() => {
    lastLayout = '';
    schedule();
  }).observe(host);
  new MutationObserver(schedule).observe(root, { attributes: true, attributeFilter: ['hidden'] });
  new MutationObserver(schedule).observe(document.body, {
    subtree: true,
    attributes: true,
    attributeFilter: ['open'],
  });
  // Native child views must move with the host even if its size does not change.
  window.addEventListener('resize', () => {
    lastLayout = '';
    schedule();
  });
  root.querySelector('[data-ide=quick]').onclick = openQuickEditor;
  async function run(action) {
    if (pending || !api) return;
    pending = true;
    buttons.forEach((button) => {
      button.disabled = true;
    });
    status.textContent =
      action === 'start' ? 'Starting the local IDE engine…' : 'Choose the engine folder…';
    try {
      await api[action]();
    } catch (error) {
      toast(error.message);
    } finally {
      pending = false;
      root.querySelector('[data-ide=quick]').disabled = false;
      await refresh();
    }
  }
  root.querySelector('[data-ide=start]').onclick = () => run('start');
  root.querySelector('[data-ide=engine]').onclick = () => run('choose');
  // Engine exits and renderer failures must reveal the recovery message.
  const timer = setInterval(() => {
    if (!root.hidden && !pending) refresh();
  }, 3000);
  window.addEventListener('beforeunload', () => clearInterval(timer));
  refresh();
  return {
    root,
    activate: async () => {
      await refresh();
      if (latestState?.installed && !running && !pending) await run('start');
      schedule();
    },
  };
}
