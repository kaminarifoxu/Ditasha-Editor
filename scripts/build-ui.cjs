const { build } = require('esbuild');
const { copyFileSync } = require('node:fs');
(async () => {
  for (const [entry, outfile] of [
    ['src/app.js', 'ui/app.js'],
    ['src/resource-worker.js', 'ui/resource-worker.js'],
    ['src/code-editor-core.js', 'ui/code-editor.js'],
    ['node_modules/monaco-editor/esm/vs/editor/editor.worker.js', 'ui/code-worker.js'],
  ])
    await build({
      entryPoints: [entry],
      bundle: true,
      minify: true,
      outfile,
      loader: { '.ttf': 'dataurl' },
    });
  copyFileSync('node_modules/monaco-editor/LICENSE', 'ui/assets/MONACO-LICENSE.txt');
  copyFileSync(
    'node_modules/monaco-editor/ThirdPartyNotices.txt',
    'ui/assets/MONACO-THIRD-PARTY.txt',
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
