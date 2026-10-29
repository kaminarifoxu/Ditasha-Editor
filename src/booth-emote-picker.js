// Keep the native select as the single source of truth for actor/preset selection.
export function mountEmotePicker(select) {
  select.hidden = true;
  const panel = document.createElement('details');
  panel.className = 'pb-emote-picker';
  panel.id = 'pbClipPicker';
  panel.innerHTML =
    '<summary aria-label="Pilih emote">Pilih emote</summary><div class="pb-emote-grid" role="radiogroup" aria-label="Daftar emote"></div><div class="pb-emote-pages"><button type="button" data-prev>←</button><span></span><button type="button" data-next>→</button></div>';
  select.after(panel);
  const summary = panel.querySelector('summary'),
    grid = panel.querySelector('.pb-emote-grid'),
    pages = panel.querySelector('.pb-emote-pages');
  let page = 0;
  function draw(reset = false) {
    const options = [...select.options];
    if (reset) page = 0;
    page = Math.min(page, Math.max(0, Math.ceil(options.length / 90) - 1));
    summary.textContent = select.selectedOptions[0]?.textContent || 'Pilih emote';
    grid.replaceChildren(
      ...options.slice(page * 90, page * 90 + 90).map((o) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = o.textContent;
        b.title = o.textContent;
        b.dataset.clip = o.value;
        b.setAttribute('role', 'radio');
        b.setAttribute('aria-checked', String(o.value === select.value));
        b.onclick = () => {
          select.value = o.value;
          select.dispatchEvent(new Event('change', { bubbles: true }));
          panel.open = false;
          summary.focus();
          draw();
        };
        return b;
      }),
    );
    pages.hidden = options.length <= 90;
    pages.querySelector('span').textContent =
      page + 1 + ' / ' + Math.max(1, Math.ceil(options.length / 90));
    pages.querySelector('[data-prev]').disabled = page === 0;
    pages.querySelector('[data-next]').disabled = (page + 1) * 90 >= options.length;
  }
  pages.querySelector('[data-prev]').onclick = () => {
    page--;
    draw();
  };
  pages.querySelector('[data-next]').onclick = () => {
    page++;
    draw();
  };
  panel.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      panel.open = false;
      summary.focus();
      return;
    }
    const delta = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 3, ArrowUp: -3 }[e.key];
    if (delta === undefined || !e.target.matches('[data-clip]')) return;
    e.preventDefault();
    const buttons = [...grid.children],
      i = buttons.indexOf(e.target);
    buttons[Math.max(0, Math.min(buttons.length - 1, i + delta))]?.focus();
  });
  document.addEventListener('pointerdown', (e) => {
    if (panel.open && !panel.contains(e.target)) panel.open = false;
  });
  select.addEventListener('change', () => draw());
  panel.addEventListener('toggle', () => {
    if (panel.open) {
      const i = [...select.options].findIndex((o) => o.value === select.value);
      page = Math.max(0, Math.floor(i / 90));
      draw();
    }
  });
  new MutationObserver(() => draw(true)).observe(select, {
    childList: true,
    subtree: true,
    characterData: true,
  });
  draw();
  return { sync: () => draw(), panel };
}
