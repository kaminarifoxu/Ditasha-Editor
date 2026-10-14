import { decodeCode, encodeCode, codeLanguage } from './code-text.js';
let loading;
function loadMonaco() {
  return (loading ||= new Promise((resolve, reject) => {
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = 'code-editor.css';
    document.head.append(css);
    const script = document.createElement('script');
    script.src = 'code-editor.js';
    script.onload = () => resolve(globalThis.ditashaCode);
    script.onerror = () => {
      loading = null;
      script.remove();
      reject(Error('Could not load the offline code editor.'));
    };
    document.head.append(script);
  }));
}
export function mountCodeEditor({ download, confirmDiscard, toast }) {
  const dialog = document.createElement('dialog');
  dialog.className = 'code-dialog';
  dialog.setAttribute('aria-label', 'Offline code editor');
  dialog.innerHTML =
    '<header><div><span class="eyebrow">MONACO · OFFLINE CODE EDITOR</span><h2></h2></div><button data-action="close">Close</button></header><p role="status"></p><div class="code-surface"></div><footer><span>UTF-8 · Scripts are never executed · Not the full VS Code IDE</span><button data-action="copy">Save file copy</button><button data-action="apply" class="primary">Apply to archive</button></footer>';
  document.body.append(dialog);
  let editor,
    model,
    source = '',
    bom = false,
    path = '',
    apply,
    readOnly = true,
    working = false;
  const dirty = () => !!model && model.getValue() !== source;
  const status = dialog.querySelector('[role=status]');
  function refresh() {
    status.textContent =
      (readOnly
        ? 'Read-only source; save a copy to keep edits.'
        : 'Apply changes, then Save archive copy to persist them.') +
      (dirty() ? ' · Unsaved buffer' : '');
    dialog.querySelector('[data-action=apply]').disabled = working || readOnly || !dirty();
    dialog.querySelector('[data-action=copy]').disabled = working;
    dialog.querySelector('[data-action=close]').disabled = working;
  }
  async function close() {
    if (working) return;
    if (dirty() && (await confirmDiscard('file', [{ name: 'Code · ' + path }])) !== 'discard')
      return;
    model?.dispose();
    model = null;
    dialog.close();
  }
  dialog.oncancel = (e) => {
    e.preventDefault();
    close();
  };
  dialog.querySelector('[data-action=close]').onclick = close;
  dialog.querySelector('[data-action=copy]').onclick = async () => {
    if (working) return;
    working = true;
    refresh();
    try {
      await download(encodeCode(model.getValue(), bom), path.split('/').at(-1), 'text/plain');
    } catch (e) {
      toast(e.message);
    } finally {
      working = false;
      refresh();
    }
  };
  dialog.querySelector('[data-action=apply]').onclick = async () => {
    if (working || readOnly) return;
    working = true;
    refresh();
    try {
      const text = model.getValue();
      await apply(encodeCode(text, bom));
      source = text;
    } catch (e) {
      toast(e.message);
    } finally {
      working = false;
      refresh();
    }
  };
  return {
    unsavedItems: () => (dirty() ? [{ name: 'Code · ' + path }] : []),
    async open({ name, data, onApply, editable }) {
      const decoded = decodeCode(data),
        monaco = await loadMonaco();
      source = decoded.text;
      bom = decoded.bom;
      path = name;
      apply = onApply;
      readOnly = !editable;
      if (!editor)
        editor = monaco.editor.create(dialog.querySelector('.code-surface'), {
          automaticLayout: true,
          minimap: { enabled: false },
          fontSize: 14,
          scrollBeyondLastLine: false,
          wordWrap: 'on',
          unicodeHighlight: { ambiguousCharacters: false },
        });
      model?.dispose();
      model = monaco.editor.createModel(source, codeLanguage(path));
      editor.setModel(model);
      // Keep the original line endings when applying an unchanged document.
      source = model.getValue();
      model.onDidChangeContent(refresh);
      monaco.editor.setTheme(document.body.dataset.theme === 'light' ? 'vs' : 'vs-dark');
      dialog.querySelector('h2').textContent = name;
      refresh();
      dialog.showModal();
      editor.layout();
      editor.focus();
    },
  };
}
