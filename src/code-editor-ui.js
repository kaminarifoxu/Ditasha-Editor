import { decodeCode, encodeCode, codeLanguage, MAX_CODE_BYTES } from './code-text.js';
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
  const toolbar = document.createElement('div');
  toolbar.className = 'code-file-toolbar';
  toolbar.innerHTML =
    '<button data-action="new">New Lua file</button><button data-action="open">Open code file…</button><input type="file" data-action="input" hidden accept=".lua,.js,.ts,.json,.xml,.meta,.txt,.cfg,.ini,.csv,.html,.css,.md"><span>Local files · UTF-8 · 2 MB maximum</span>';
  dialog.querySelector('header').after(toolbar);
  let editor,
    model,
    source = '',
    bom = false,
    path = '',
    apply,
    readOnly = true,
    working = false,
    opening = false,
    exportedText = null;
  const modified = () => !!model && model.getValue() !== source;
  const dirty = () => modified() && model.getValue() !== exportedText;
  const status = dialog.querySelector('[role=status]');
  function refresh() {
    status.textContent =
      (readOnly
        ? 'Read-only source; save a copy to keep edits.'
        : 'Apply changes, then Save archive copy to persist them.') +
      (dirty() ? ' · Unsaved buffer' : '');
    dialog.querySelector('[data-action=apply]').disabled = working || readOnly || !modified();
    dialog.querySelector('[data-action=copy]').disabled = working;
    dialog.querySelector('[data-action=close]').disabled = working;
    toolbar.querySelectorAll('button').forEach((b) => (b.disabled = working));
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
      const text = model.getValue();
      if (await download(encodeCode(text, bom), path.split('/').at(-1), 'text/plain'))
        exportedText = text;
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
  const api = {
    unsavedItems: () => (dirty() ? [{ name: 'Code · ' + path }] : []),
    async openStandalone() {
      if (opening) return;
      if (dialog.open) {
        editor?.focus();
        return;
      }
      opening = true;
      try {
        await api.open({ name: 'untitled.lua', data: new Uint8Array(), editable: false });
      } finally {
        opening = false;
      }
    },
    async open({ name, data, onApply, editable }) {
      const decoded = decodeCode(data),
        monaco = await loadMonaco();
      if (dirty() && (await confirmDiscard('file', [{ name: 'Code · ' + path }])) !== 'discard')
        return;
      source = decoded.text;
      exportedText = null;
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
      if (!dialog.open) dialog.showModal();
      editor.layout();
      editor.focus();
    },
  };
  toolbar.querySelector('[data-action=open]').onclick = () =>
    toolbar.querySelector('input').click();
  toolbar.querySelector('[data-action=new]').onclick = () =>
    api
      .open({ name: 'untitled.lua', data: new Uint8Array(), editable: false })
      .catch((e) => toast(e.message));
  toolbar.querySelector('input').onchange = async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file || working) return;
    try {
      if (file.size > MAX_CODE_BYTES) throw Error('Code editor limit: 2 MB.');
      await api.open({
        name: file.name,
        data: new Uint8Array(await file.arrayBuffer()),
        editable: false,
      });
    } catch (error) {
      toast(error.message);
    }
  };
  return api;
}
