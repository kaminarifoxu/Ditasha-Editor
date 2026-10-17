'use strict';
const { app, BrowserWindow } = require('electron');
const path = require('node:path'),
  fs = require('node:fs/promises');
const check = require('./tools-ui-checks.cjs'),
  checkArchives = require('./archive-ui-checks.cjs'),
  checkViewers = require('./viewers-ui-checks.cjs'),
  checkIcons = require('./ui-icons-checks.cjs');
app.whenReady().then(async () => {
  let win;
  const captures = [];
  try {
    const { testYdd, testYtd } = await import('../tests/format.test.mjs');
    await fs.mkdir(path.resolve('release/qa'), { recursive: true });
    win = new BrowserWindow({
      width: 1500,
      height: 950,
      show: true,
      webPreferences: {
        contextIsolation: true,
        sandbox: true,
        nodeIntegration: false,
        backgroundThrottling: false,
      },
    });
    win.webContents.on('console-message', (_event, ...args) => {
      const message = args
        .map((a) => (typeof a === 'string' ? a : a?.message))
        .find((a) => a?.startsWith('DITASHA_SNAPSHOT:'));
      if (message) {
        const name = message.split(':')[1];
        captures.push(
          win.webContents
            .capturePage()
            .then((image) =>
              fs.writeFile(path.resolve('release/qa/' + name + '.png'), image.toPNG()),
            ),
        );
      }
    });
    await win.loadFile(path.resolve('ui/index.html'));
    const homeReports = [];
    for (const [width, height] of [
      [1500, 950],
      [1024, 768],
      [800, 600],
    ]) {
      win.setSize(width, height);
      homeReports.push(
        await win.webContents.executeJavaScript(
          '(' +
            require('./home-ui-checks.cjs').toString() +
            ')(' +
            JSON.stringify({
              ytd: [...new Uint8Array(testYtd)],
              size: width,
              interactions: width === 1500,
            }) +
            ')',
        ),
      );
    }
    await Promise.all(captures);
    win.setSize(1500, 950);
    await win.loadFile(path.resolve('ui/index.html'));
    const shellReport = await win.webContents.executeJavaScript(
      '(' + require('./workspace-ui-checks.cjs').toString() + ')()',
    );
    console.log('Workspace shell:', shellReport);
    const iconReport = await win.webContents.executeJavaScript('(' + checkIcons.toString() + ')()');
    const report = await win.webContents.executeJavaScript(
      '(' +
        check.toString() +
        ')(' +
        JSON.stringify({ ydd: [...new Uint8Array(testYdd)], ytd: [...new Uint8Array(testYtd)] }) +
        ')',
    );
    const { writeRpf } = await import('../src/archives.js');
    const { zipFiles } = await import('../src/asset-tools.js');
    const ytd = new Uint8Array(testYtd);
    const rpf = writeRpf([
      { name: 'textures/test.ytd', data: ytd },
      {
        name: 'nested.rpf',
        data: writeRpf([{ name: 'readme.txt', data: new TextEncoder().encode('nested') }]),
      },
      { name: 'readme.txt', data: new TextEncoder().encode('test') },
    ]);
    const xml =
      '<package version="2.2" target="Five" id="{12345678-90AB-CDEF-1234-567890ABCDEF}"><metadata><name>Test package</name><author><displayName>Workshop</displayName></author></metadata><colors/><content><add source="content/test.ytd">mods/test.ytd</add></content></package>';
    const oiv = zipFiles([
      { name: 'assembly.xml', data: xml },
      { name: 'content/test.ytd', data: ytd },
    ]);
    const archiveReport = await win.webContents.executeJavaScript(
      '(' +
        checkArchives.toString() +
        ')(' +
        JSON.stringify({ rpf: [...rpf], oiv: [...oiv], ytd: [...ytd] }) +
        ')',
    );
    for (const save of archiveReport.saves.filter((s) => s.name.endsWith('.rpf'))) {
      const { openArchive } = await import('../src/archives.js');
      const archive = await openArchive(new Blob([new Uint8Array(save.data)]), save.name);
      if (!archive.entries.some((e) => e.name === 'textures/test.ytd'))
        throw Error('Rebuilt RPF missing texture');
    }
    archiveReport.saves = archiveReport.saves.map((s) => ({ name: s.name, size: s.data.length }));
    const { viewerModel } = await import('../tests/viewer-format.test.mjs');
    const { createYtd } = await import('../src/asset-tools.js');
    const hairYtd = createYtd([
      { name: 'hair_diff_040_a_uni', w: 1, h: 1, out: new Uint8Array([0, 255, 0, 255]) },
    ]);
    const blackHairYtd = createYtd([
      { name: 'hair_diff_black', w: 1, h: 1, out: new Uint8Array([0, 0, 0, 255]) },
    ]);
    const transparentHairYtd = createYtd([
      { name: 'hair_diff_alpha', w: 1, h: 1, out: new Uint8Array([0, 255, 0, 0]) },
    ]);
    const pedAlphaYtd = createYtd([
      { name: 'cloth_diffuse', w: 1, h: 1, out: new Uint8Array([0, 255, 0, 0]) },
    ]);
    const pedBlackYtd = createYtd([
      { name: 'cloth_diffuse', w: 1, h: 1, out: new Uint8Array([0, 0, 0, 255]) },
    ]);
    const faceYtd = createYtd([
      { name: 'cloth_diffuse', w: 1, h: 1, out: new Uint8Array([255, 0, 0, 255]) },
    ]);
    const { alphaYtd, fragmentYft, bc7Ytd, opaqueVehicleModel } =
      await import('../tests/vehicle-preview.test.mjs');
    const viewerReport = await win.webContents.executeJavaScript(
      '(' +
        checkViewers.toString() +
        ')(' +
        JSON.stringify({
          ytd: [...ytd],
          model: [...new Uint8Array(viewerModel)],
          hairYtd: [...hairYtd],
          faceYtd: [...faceYtd],
          pedAlphaYtd: [...pedAlphaYtd],
          pedBlackYtd: [...pedBlackYtd],
          blackHairYtd: [...blackHairYtd],
          transparentHairYtd: [...transparentHairYtd],
          alphaYtd: [...new Uint8Array(alphaYtd())],
          fragmentYft: [...new Uint8Array(fragmentYft())],
          bc7Ytd: [...new Uint8Array(bc7Ytd())],
          opaqueVehicleModel: [...new Uint8Array(opaqueVehicleModel())],
          requireWebgl: true,
        }) +
        ')',
    );
    await win.loadFile(path.resolve('ui/index.html'));
    const checkOffline = require('./offline-studio-ui-checks.cjs');
    const offlineReport = await win.webContents.executeJavaScript(
      '(' +
        checkOffline.toString() +
        ')(' +
        JSON.stringify({ ytd: [...ytd], model: [...new Uint8Array(viewerModel)] }) +
        ')',
    );
    await win.loadFile(path.resolve('ui/index.html'));
    const inlineModel = new Uint8Array(viewerModel).slice();
    const inlineHeader = new DataView(inlineModel.buffer);
    inlineHeader.setUint32(8, (inlineHeader.getUint32(8, true) & 0x0fffffff) | 0xa0000000, true);
    inlineHeader.setUint32(12, (inlineHeader.getUint32(12, true) & 0x0fffffff) | 0x50000000, true);
    const inlineArchive = writeRpf([
      { name: 'car.ydd', data: inlineModel },
      { name: 'car.ytd', data: ytd },
      { name: 'alternate.ytd', data: ytd },
      { name: 'fxmanifest.lua', data: new TextEncoder().encode('fx_version "cerulean"\r\n') },
    ]);
    const inlineReport = await win.webContents.executeJavaScript(
      '(' +
        require('./explorer-preview-ui-checks.cjs').toString() +
        ')(' +
        JSON.stringify({
          archive: [...inlineArchive],
          textureFailureArchive: [
            ...writeRpf([
              { name: 'car.ydd', data: inlineModel },
              { name: 'car.ytd', data: new TextEncoder().encode('invalid texture resource') },
            ]),
          ],
        }) +
        ')',
    );
    const { openArchive } = await import('../src/archives.js');
    const inlineSave = inlineReport.saves.find((s) => s.name.endsWith('.rpf'));
    const editedArchive = await openArchive(
      new Blob([new Uint8Array(inlineSave.data)]),
      inlineSave.name,
    );
    const editedScript = editedArchive.entries.find((e) => e.name === 'fxmanifest.lua');
    if (
      !new TextDecoder()
        .decode(await editedArchive.extract(editedScript))
        .includes('-- edited offline')
    )
      throw Error('Code editor changes did not survive RPF export');
    inlineReport.saves = inlineReport.saves.map((s) => ({ name: s.name, size: s.data.length }));
    await win.loadFile(path.resolve('ui/index.html'));
    const manualStudioReport = await win.webContents.executeJavaScript(
      '(' +
        require('./manual-studio-ui-checks.cjs').toString() +
        ')(' +
        JSON.stringify({ model: [...inlineModel] }) +
        ')',
    );
    const { debadgeFixture } = await import('../tests/debadge.test.mjs');
    await win.loadFile(path.resolve('ui/index.html'));
    const debadgeReport = await win.webContents.executeJavaScript(
      '(' +
        require('./debadge-ui-checks.cjs').toString() +
        ')(' +
        JSON.stringify({ vehicle: [...new Uint8Array(debadgeFixture())] }) +
        ')',
    );
    const { readYft } = await import('../src/resource.js');
    const indices = readYft(Uint8Array.from(debadgeReport.data).buffer)[0].geometries[0].indices;
    if ([...indices].join(',') !== '0,1,2,0,2,3,4,4,4')
      throw Error('UI export changed the wrong triangles');
    delete debadgeReport.data;
    await win.loadFile(path.resolve('ui/index.html'));
    const { largeYtdFixture } = await import('../tests/fixtures/large-ytd.mjs');
    const largeYtdReport = await win.webContents.executeJavaScript(
      '(' +
        require('./large-ytd-ui-checks.cjs').toString() +
        ')(' +
        JSON.stringify([...new Uint8Array(largeYtdFixture())]) +
        ')',
    );
    const { readYtd } = await import('../src/resource.js');
    const largeSaved = readYtd(Uint8Array.from(largeYtdReport.data).buffer);
    if (
      largeSaved.textures[0].format !== 'DXT1' ||
      largeSaved.textures[0].mipLevels !== 2 ||
      largeSaved.textures[1].format !== 'DXT1' ||
      largeSaved.textures[1].mipLevels !== 2 ||
      largeSaved.textures[2].format !== 'RGBA' ||
      [...largeSaved.textures[2].out.slice(4095 * 4, 4096 * 4)].join(',') !== '255,0,0,255'
    )
      throw Error('Large YTD edit/export did not preserve source textures or mirrored pixels');
    delete largeYtdReport.data;
    await win.loadFile(path.resolve('ui/index.html'));
    const { wheelYftFixture } = await import('../tests/fixtures/wheel-yft.mjs');
    const wheelReport = await win.webContents.executeJavaScript(
      '(' +
        require('./wheel-yft-ui-checks.cjs').toString() +
        ')(' +
        JSON.stringify([...new Uint8Array(wheelYftFixture(viewerModel))]) +
        ')',
    );
    const { liveryYftFixture } = await import('../tests/fixtures/livery-yft.mjs');
    const liveryReport = await win.webContents.executeJavaScript(
      '(' +
        require('./vehicle-livery-ui-checks.cjs').toString() +
        ')(' +
        JSON.stringify({
          model: [...new Uint8Array(liveryYftFixture(viewerModel))],
          base: [
            ...createYtd([
              { name: 'cloth_diffuse', w: 1, h: 1, out: new Uint8Array([0, 255, 0, 255]) },
            ]),
          ],
          livery: [
            ...createYtd([
              {
                name: 'vehicle_sign_1',
                w: 4,
                h: 1,
                out: new Uint8Array([0, 0, 255, 0, 0, 0, 255, 0, 0, 0, 255, 255, 0, 0, 255, 255]),
              },
            ]),
          ],
          combined: [
            ...createYtd([
              { name: 'cloth_diffuse', w: 1, h: 1, out: new Uint8Array([0, 255, 0, 255]) },
              {
                name: 'vehicle_sign_1',
                w: 4,
                h: 1,
                out: new Uint8Array([0, 0, 255, 0, 0, 0, 255, 0, 0, 0, 255, 255, 0, 0, 255, 255]),
              },
            ]),
          ],
        }) +
        ')',
    );
    await Promise.all(captures);
    console.log(
      'PASS: ' +
        JSON.stringify({
          homeReports,
          iconReport,
          report,
          archiveReport,
          viewerReport,
          offlineReport,
          inlineReport,
          manualStudioReport,
          debadgeReport,
          largeYtdReport,
          wheelReport,
          liveryReport,
        }),
    );
    win.destroy();
    app.exit(0);
  } catch (e) {
    console.error(e);
    if (win) {
      await fs
        .writeFile(
          path.resolve('release/qa/failure.png'),
          (await win.webContents.capturePage()).toPNG(),
        )
        .catch(() => {});
      win.destroy();
    }
    app.exit(1);
  }
});
