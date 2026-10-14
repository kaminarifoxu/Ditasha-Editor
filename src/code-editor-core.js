import * as monaco from 'monaco-editor/editor';
import 'monaco-editor/features/register.all';
import 'monaco-editor/languages/definitions/lua/register';
import 'monaco-editor/languages/definitions/xml/register';
import 'monaco-editor/languages/definitions/javascript/register';
import 'monaco-editor/languages/definitions/typescript/register';
import 'monaco-editor/languages/definitions/ini/register';
import 'monaco-editor/languages/definitions/html/register';
import 'monaco-editor/languages/definitions/css/register';
monaco.languages.register({ id: 'json' });
monaco.languages.setMonarchTokensProvider('json', {
  tokenizer: {
    root: [
      [/"([^"\\]|\\.)*"/, 'string'],
      [/\b(true|false|null)\b/, 'keyword'],
      [/-?\d+(\.\d+)?([eE][+-]?\d+)?/, 'number'],
      [/[{}\[\]:,]/, 'delimiter'],
    ],
  },
});
globalThis.MonacoEnvironment = {
  getWorker: () => new Worker(new URL('code-worker.js', document.baseURI)),
};
globalThis.ditashaCode = monaco;
