'use strict';
const { app, BrowserWindow, ipcMain } = require('electron');
const fs = require('node:fs/promises'),
  path = require('node:path'),
  os = require('node:os'),
  assert = require('node:assert/strict');
const { registerAssetCompressor } = require('../electron/asset-compressor.cjs');
app.whenReady().then(async () => {
  let win, scratch;
  const timeout = setTimeout(() => {
    console.error('Compressor smoke timed out');
    app.exit(1);
  }, 180000);
  try {
    scratch = await fs.mkdtemp(path.join(os.tmpdir(), 'ditasha-compressor-ui-'));
    const source = path.join(scratch, 'resource'),
      output = path.join(scratch, 'output');
    await fs.mkdir(output);
    const { createYtd } = await import('../src/asset-tools.js'),
      { testYdd } = await import('../tests/format.test.mjs');
    const rgba = new Uint8Array(1024 * 512 * 4);
    require('node:crypto').randomFillSync(rgba);
    for (let i = 3; i < rgba.length; i += 4) rgba[i] = 255;
    const ytd = createYtd([{ name: 'cloth_diffuse', w: 1024, h: 512, out: rgba }]);
    const fixtures = {
      'clothes/stream/mp_m_freemode_01^jbib_000_u.ydd': new Uint8Array(testYdd),
      'clothes/stream/mp_m_freemode_01^jbib_diff_000_a_uni.ytd': ytd,
      'clothes/fxmanifest.lua': Buffer.from("fx_version 'cerulean'\ngame 'gta5'\n"),
      'ped/stream/keep.ytd': ytd,
      'mlo/stream/broken.ytd': Buffer.from('unsupported asset, keep original'),
      'mlo/stream/room.ymap': Buffer.from('MLO metadata copied byte-for-byte'),
    };
    for (const [relative, data] of Object.entries(fixtures)) {
      const target = path.join(source, relative);
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, data);
    }
    win = new BrowserWindow({
      width: 1600,
      height: 1000,
      show: true,
      webPreferences: {
        preload: path.resolve('electron/preload.cjs'),
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
      },
    });
    const trusted = (e) => assert.equal(e.sender, win.webContents);
    let cancelFolder = false;
    registerAssetCompressor({
      ipcMain,
      trusted,
      dialog: {
        showOpenDialog: async () =>
          cancelFolder
            ? { canceled: true, filePaths: [] }
            : { canceled: false, filePaths: [output] },
      },
      win,
      shell: { openPath: async () => '' },
    });
    await win.loadFile(path.resolve('ui/index.html'));
    const wait = async (code, label) => {
      const end = Date.now() + 45000;
      while (Date.now() < end) {
        if (await win.webContents.executeJavaScript(code)) return;
        await new Promise((r) => setTimeout(r, 100));
      }
      throw Error(
        label +
          ' ' +
          (await win.webContents.executeJavaScript(
            "document.getElementById('acStatus')?.textContent",
          )),
      );
    };
    await win.webContents.executeJavaScript(
      "document.querySelector('[data-page=compressor]').click()",
    );
    win.webContents.debugger.attach('1.3');
    const doc = await win.webContents.debugger.sendCommand('DOM.getDocument');
    const node = await win.webContents.debugger.sendCommand('DOM.querySelector', {
      nodeId: doc.root.nodeId,
      selector: '#acFolders',
    });
    await win.webContents.debugger.sendCommand('DOM.setFileInputFiles', {
      nodeId: node.nodeId,
      files: [source],
    });
    win.webContents.debugger.detach();
    await wait("document.querySelectorAll('#acQueue > div').length===6", 'Folder import missing');
    await win.webContents.executeJavaScript(
      "[...document.querySelectorAll('#acQueue button')].find(b=>b.title.endsWith('/keep.ytd')).click();document.getElementById('acPreserve').checked=true;document.getElementById('acPreserve').dispatchEvent(new Event('change'));",
    );
    await win.webContents.executeJavaScript(
      "const s=document.getElementById('acProfile-clothing');s.value='512';s.dispatchEvent(new Event('change'));[...document.querySelectorAll('#acQueue button')].find(b=>b.title.endsWith('.ydd')).click()",
    );
    await wait(
      "document.getElementById('mvTitle').textContent.includes('jbib_000')&&!document.getElementById('acRun').disabled",
      'Embedded model preview missing',
    );
    assert.equal(
      await win.webContents.executeJavaScript(
        "document.querySelector('.ac-preview-host').contains(document.querySelector('.model-viewer'))",
      ),
      true,
    );
    await win.webContents.executeJavaScript("document.getElementById('acRun').click()");
    await wait(
      "!document.getElementById('acRun').disabled&&document.getElementById('acStatus').textContent.startsWith('Selesai')",
      'Native batch did not finish',
    );
    const folders = await fs.readdir(output);
    assert.equal(folders.length, 1);
    const result = path.join(output, folders[0]);
    const report = JSON.parse(
      await fs.readFile(path.join(result, '.ditasha-compressor/report.json')),
    );
    assert.equal(report.status, 'completed');
    assert.equal(report.files.length, 6);
    assert.ok(report.outputBytes < report.inputBytes);
    const { readYtd } = await import('../src/resource.js');
    const packed = await fs.readFile(
      path.join(result, 'resource/clothes/stream/mp_m_freemode_01^jbib_diff_000_a_uni.ytd'),
    );
    const texture = readYtd(
      packed.buffer.slice(packed.byteOffset, packed.byteOffset + packed.byteLength),
    ).textures[0];
    assert.equal(texture.w, 512);
    assert.equal(texture.h, 256);
    for (const [relative, data] of Object.entries(fixtures)) {
      assert.deepEqual(await fs.readFile(path.join(source, relative)), Buffer.from(data));
      if (!relative.includes('jbib_diff'))
        assert.deepEqual(
          await fs.readFile(path.join(result, 'resource', relative)),
          Buffer.from(data),
        );
    }
    assert.equal(report.files.find((e) => e.path.endsWith('broken.ytd')).status, 'preserved');
    assert.ok(
      report.files.find((e) => e.path.endsWith('/keep.ytd')).reason.includes('pengaturan file'),
    );
    await fs.mkdir('release/qa', { recursive: true });
    win.setSize(1600, 1000);
    await new Promise((r) => setTimeout(r, 200));
    await win.webContents.executeJavaScript(
      "document.getElementById('toast').style.display='none'",
    );
    await fs.writeFile('release/qa/compressor.png', (await win.webContents.capturePage()).toPNG());
    for (const [width, height] of [
      [1024, 768],
      [1600, 1000],
    ]) {
      win.setSize(width, height);
      await new Promise((r) => setTimeout(r, 200));
      assert.ok(
        await win.webContents.executeJavaScript(
          "(()=>{const r=document.querySelector('.compressor-workspace');return r.getBoundingClientRect().right<=innerWidth+1})()",
        ),
      );
      assert.ok(
        await win.webContents.executeJavaScript(
          "(()=>{const a=document.querySelector('.ac-center').getBoundingClientRect(),b=document.querySelector('.ac-settings').getBoundingClientRect();return Math.min(a.right,b.right)-Math.max(a.left,b.left)<1 || Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)<1})()",
        ),
        'Compressor settings overlap the preview',
      );
    }
    cancelFolder = true;
    await win.webContents.executeJavaScript("document.getElementById('acRun').click()");
    await wait(
      "!document.getElementById('acRun').disabled&&document.getElementById('acStatus').textContent.includes('dibatalkan')",
      'Folder cancel failed',
    );
    assert.equal((await fs.readdir(output)).length, 1);
    // Pause before the next file; the current file may finish, later entries remain pending.
    cancelFolder = false;
    await win.webContents.executeJavaScript(
      "document.getElementById('acRun').click();setTimeout(()=>document.getElementById('acCancel').click(),5)",
    );
    await wait(
      "!document.getElementById('acRun').disabled&&document.getElementById('acStatus').textContent.startsWith('Dihentikan')",
      'Batch cancel failed',
    );
    const names = await fs.readdir(output);
    assert.equal(names.length, 2);
    const cancelledName = names.find((n) => n !== folders[0]);
    const cancelledReport = JSON.parse(
      await fs.readFile(path.join(output, cancelledName, '.ditasha-compressor/report.json')),
    );
    assert.equal(cancelledReport.status, 'cancelled');
    assert.ok(cancelledReport.files.some((e) => e.status === 'pending'));
    const checks = {
      nativeFolderImport: true,
      embedded3d: true,
      realYtdResize: [texture.w, texture.h],
      sourceBytesUnchanged: true,
      sidecarsUnchanged: true,
      unsupportedPreserved: true,
      folderCancel: true,
      batchCancel: true,
      inputBytes: report.inputBytes,
      outputBytes: report.outputBytes,
    };
    await fs.writeFile('release/qa/compressor-result.json', JSON.stringify(checks, null, 2));
    console.log('PASS compressor: ' + JSON.stringify(checks));
    clearTimeout(timeout);
    win.destroy();
    await fs.rm(scratch, { recursive: true, force: true });
    app.exit(0);
  } catch (e) {
    console.error(e);
    if (win && !win.isDestroyed()) {
      await fs.mkdir('release/qa', { recursive: true });
      await fs
        .writeFile(
          'release/qa/compressor-failure.png',
          (await win.webContents.capturePage()).toPNG(),
        )
        .catch(() => {});
      win.destroy();
    }
    clearTimeout(timeout);
    if (scratch) await fs.rm(scratch, { recursive: true, force: true });
    app.exit(1);
  }
});
