'use strict';
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs/promises'),
  path = require('node:path');
app.whenReady().then(async () => {
  let win;
  try {
    await fs.mkdir('release/qa', { recursive: true });
    win = new BrowserWindow({
      width: 1500,
      height: 950,
      show: true,
      webPreferences: {
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        backgroundThrottling: false,
      },
    });
    await win.loadFile(path.resolve('ui/index.html'));
    const { testYdd, testYtd } = await import('../tests/format.test.mjs');
    await win.webContents.executeJavaScript(`(async()=>{
      document.querySelector('[data-page=editor]').click();
      const dt=new DataTransfer();
      for(const [name,data] of ${JSON.stringify([
        ['layout.ydd', [...new Uint8Array(testYdd)]],
        ['layout.ytd', [...new Uint8Array(testYtd)]],
      ])})dt.items.add(new File([new Uint8Array(data)],name));
      const input=document.getElementById('fileInput');input.files=dt.files;input.dispatchEvent(new Event('change'));
      const end=Date.now()+15000;while(!document.getElementById('canvasStack').offsetWidth){if(Date.now()>end)throw Error('Layout files not ready');await new Promise(r=>setTimeout(r,40));}
    })()`);
    const report = [];
    for (const width of [1500, 1100, 1000]) {
      win.setSize(width, 900);
      for (const mode of ['2d', '3d', '2d']) {
        const result = await win.webContents.executeJavaScript(`(async()=>{
          const $=id=>document.getElementById(id);$('editTexture${mode}').click();await new Promise(r=>setTimeout(r,120));
          const rect=n=>n.getBoundingClientRect();const area=rect($('canvasarea')),texture=rect($('textureCanvas')),vp=rect($('viewport')),gpu=rect($('viewport').querySelector('canvas')),bar=rect(document.querySelector('.editor-commandbar'));
          const check=(v,m)=>{if(!v)throw Error(m+' at ${width}/${mode}');};
          check(area.width>100&&area.height>80,'Texture area collapsed');
          check(texture.left>=area.left-1&&texture.right<=area.right+1&&texture.top>=area.top-1&&texture.bottom<=area.bottom+1,'Texture clipped');
          check(vp.width>150&&gpu.width>150&&Math.abs(vp.width-gpu.width)<3,'3D canvas width mismatch');
          check($('photoshoot').clientWidth>=105&&$('photoshoot').scrollWidth<=$('photoshoot').clientWidth+1,'Photoshoot label clipped');
          check(vp.left>=0&&vp.right<=innerWidth+1&&bar.right<=innerWidth+1,'Preview outside window');
          const left=document.querySelector('main > .files'),button=left.querySelector('.workspace-panel-toggle');button.click();await new Promise(r=>setTimeout(r,80));check(button.getAttribute('aria-expanded')==='false'&&rect(left).width<=50,'Minimize did not reclaim space');button.click();
          const select=$('stampType'),choices=select.nextElementSibling;choices.querySelectorAll('button')[1].click();check(select.value==='text'&&!$('stampTextFields').hidden,'Stamp buttons lost behavior');choices.querySelectorAll('button')[0].click();
          return{width:${width},mode:'${mode}',textureFits:true,previewFits:true,collapseReclaimsSpace:true,choiceButtons:true};
        })()`);
        report.push(result);
      }
    }
    win.setSize(1500, 950);
    await win.webContents.executeJavaScript("document.getElementById('editTexture3d').click()");
    await new Promise((r) => setTimeout(r, 150));
    await fs.writeFile(
      'release/qa/workspace-polish-3d.png',
      (await win.webContents.capturePage()).toPNG(),
    );
    await win.webContents.executeJavaScript("document.getElementById('editTexture2d').click()");
    await new Promise((r) => setTimeout(r, 150));
    await fs.writeFile(
      'release/qa/workspace-polish-2d.png',
      (await win.webContents.capturePage()).toPNG(),
    );
    await fs.writeFile('release/qa/workspace-polish-result.json', JSON.stringify(report));
    console.log('PASS layout: ' + JSON.stringify(report));
    win.destroy();
    app.exit(0);
  } catch (e) {
    console.error(e);
    if (win) {
      await fs.writeFile(
        'release/qa/workspace-polish-failure.png',
        (await win.webContents.capturePage()).toPNG(),
      );
      win.destroy();
    }
    app.exit(1);
  }
});
