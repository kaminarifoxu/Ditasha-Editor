'use strict';
module.exports = async function checkOpenCut({ contents, initialize = false }) {
  return contents.executeJavaScript(
    '(' +
      async function (initialize) {
        const wait = async (test, label) => {
          const end = Date.now() + 45000;
          while (Date.now() < end) {
            if (test()) return;
            await new Promise((r) => setTimeout(r, 100));
          }
          throw Error('OpenCut: ' + label + ' · ' + document.body.innerText.slice(-1200));
        };
        const assert = (ok, label) => {
          if (!ok) throw Error('OpenCut: ' + label);
        };
        if (initialize) {
          await wait(
            () => document.querySelector('[data-testid="new-project"]'),
            'project launcher missing',
          );
          localStorage.setItem('hasSeenOnboarding', 'true');
          document.querySelector('[data-testid="new-project"]').click();
          await wait(() => document.querySelector('input[type="file"]'), 'editor did not open');
          assert(!document.querySelector('[aria-label="Sounds"]'), 'online sound catalog visible');
          assert(!document.querySelector('[aria-label="Captions"]'), 'AI transcription visible');
          return { created: true };
        }
        const editor = window.ditashaOpenCut.getEditor();
        await editor.project.updateSettings({
          settings: { canvasSize: { width: 320, height: 180 } },
          pushHistory: false,
        });
        const canvas = document.createElement('canvas');
        canvas.width = 320;
        canvas.height = 180;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ed2830';
        ctx.fillRect(0, 0, 320, 180);
        const file = new File(
          [await new Promise((r) => canvas.toBlob(r))],
          'ditasha-opencut-test.png',
          { type: 'image/png' },
        );
        const dt = new DataTransfer();
        dt.items.add(file);
        const input = document.querySelector('input[type="file"]');
        input.files = dt.files;
        input.dispatchEvent(new Event('change', { bubbles: true }));
        await wait(() => editor.media.getAssets().length === 1, 'media import failed');
        await wait(
          () => document.querySelector('[title="ditasha-opencut-test.png"]'),
          'media card missing',
        );
        const label = document.querySelector('[title="ditasha-opencut-test.png"]');
        const card = label.parentElement.parentElement;
        const button = card.querySelector('button');
        assert(button, 'add to timeline action missing');
        button.click();
        await wait(
          () => editor.scenes.getActiveScene().tracks.main.elements.length === 1,
          'timeline insert failed',
        );
        await editor.project.saveCurrentProject();
        const id = editor.project.getActive().metadata.id;
        const result = await editor.project.export({
          options: { format: 'webm', quality: 'low', includeAudio: false },
        });
        assert(
          result.success && result.buffer?.byteLength > 1000,
          'video export failed: ' + result.error,
        );
        const magic = [...new Uint8Array(result.buffer).slice(0, 4)];
        assert(magic.join(',') === '26,69,223,163', 'invalid WebM container');
        const blob = new Blob([result.buffer], { type: 'video/webm' }),
          url = URL.createObjectURL(blob),
          video = document.createElement('video');
        video.muted = true;
        video.src = url;
        await new Promise((resolve, reject) => {
          video.onloadeddata = resolve;
          video.onerror = () => reject(Error('Exported video cannot decode'));
        });
        ctx.drawImage(video, 0, 0, 320, 180);
        const pixel = [...ctx.getImageData(160, 90, 1, 1).data];
        URL.revokeObjectURL(url);
        assert(
          pixel[0] > 150 && pixel[1] < 100,
          'exported frame differs from imported media: ' + pixel,
        );
        await editor.project.prepareExit();
        editor.project.closeProject();
        await editor.project.loadProject({ id });
        assert(editor.media.getAssets().length === 1, 'saved media missing after reopen');
        assert(
          editor.scenes.getActiveScene().tracks.main.elements.length === 1,
          'saved timeline missing after reopen',
        );
        return {
          created: true,
          mediaImport: true,
          timeline: true,
          exportWebmBytes: result.buffer.byteLength,
          decodedPixel: pixel,
          persistence: true,
        };
      }.toString() +
      ')(' +
      JSON.stringify(initialize) +
      ')',
  );
};
