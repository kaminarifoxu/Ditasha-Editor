// Keep native selects as the source of truth for presets, validation and existing listeners.
export function mountChoiceSelect(select) {
  if (!select || select.multiple || select.size > 1 || select.dataset.workspaceChoices) return;
  select.dataset.workspaceChoices = 'true';
  const box = document.createElement('span');
  box.className = 'workspace-choice-grid';
  box.setAttribute('role', 'group');
  box.setAttribute(
    'aria-label',
    select.getAttribute('aria-label') ||
      select.closest('label')?.firstChild?.textContent.trim() ||
      select.id ||
      'Pilihan',
  );
  select.after(box);
  select.classList.add('workspace-choice-source');
  const originalTabIndex = select.getAttribute('tabindex');
  const originalAriaHidden = select.getAttribute('aria-hidden');
  select.tabIndex = -1;
  select.setAttribute('aria-hidden', 'true');
  const unavailable = (option) =>
    select.matches(':disabled') ||
    option.disabled ||
    (option.parentElement?.tagName === 'OPTGROUP' && option.parentElement.disabled);
  function sync() {
    const options = [...select.options];
    const signature = JSON.stringify(options.map((o) => [o.value, o.text, unavailable(o)]));
    if (box.dataset.options !== signature) {
      box.dataset.options = signature;
      box.replaceChildren();
      for (const [index, option] of options.entries()) {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = option.text;
        button.title = option.text;
        button.onclick = (event) => {
          event.preventDefault();
          if (unavailable(option)) return;
          select.selectedIndex = index;
          select.dispatchEvent(new Event('input', { bubbles: true }));
          select.dispatchEvent(new Event('change', { bubbles: true }));
          sync();
        };
        box.append(button);
      }
    }
    box.hidden = select.hidden || select.closest('[hidden]') !== null;
    box.setAttribute('aria-disabled', String(select.disabled));
    [...box.children].forEach((button, index) => {
      button.disabled = unavailable(options[index]);
      button.setAttribute('aria-pressed', String(select.selectedIndex === index));
    });
  }
  select.addEventListener('input', sync);
  select.addEventListener('change', sync);
  sync();
  sync.destroy = () => {
    select.removeEventListener('input', sync);
    select.removeEventListener('change', sync);
    box.remove();
    select.classList.remove('workspace-choice-source');
    delete select.dataset.workspaceChoices;
    if (originalTabIndex === null) select.removeAttribute('tabindex');
    else select.setAttribute('tabindex', originalTabIndex);
    if (originalAriaHidden === null) select.removeAttribute('aria-hidden');
    else select.setAttribute('aria-hidden', originalAriaHidden);
  };
  return sync;
}
