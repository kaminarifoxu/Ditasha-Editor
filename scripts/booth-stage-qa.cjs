'use strict';
// Host-driven QA keeps a stable compositor frame after the renderer's long
// regression batch and exercises TransformControls with real mouse events.
module.exports = async function checkBoothStage(win, glb, fs, path) {
  await win.webContents.executeJavaScript(`(async () => {
    const $=id=>document.getElementById(id), pause=ms=>new Promise(r=>setTimeout(r,ms));
    $('pbClear').click();$('pbPed').click();
    const dt=new DataTransfer(), bytes=new Uint8Array(${JSON.stringify([...new Uint8Array(glb)])});
    dt.items.add(new File([bytes],'studio-ped-a.glb'));dt.items.add(new File([bytes],'studio-ped-b.glb'));
    $('pbInput').files=dt.files;$('pbInput').dispatchEvent(new Event('change'));
    const end=Date.now()+15000;
    while($('pbPed').disabled || $('pbActor').options.length!==2){if(Date.now()>end)throw Error('Stage QA import timeout');await pause(50);}
    $('pbActor').value=$('pbActor').options[0].value;$('pbActor').dispatchEvent(new Event('change'));
    $('pbPositionX').value='-100';$('pbPositionX').dispatchEvent(new Event('change'));
    $('pbTransparent').checked=false;$('pbTransparent').dispatchEvent(new Event('input'));
    $('pbStudio').value='neon';$('pbStudio').dispatchEvent(new Event('change'));
    $('pbFullscreen').click();$('pbFit').click();
    await pause(250);
    const r=document.querySelector('.pb-stage').getBoundingClientRect();
    if(Math.abs(r.left)>1||Math.abs(r.top)>1||r.width<innerWidth-2||r.height<innerHeight-2)throw Error('Expanded stage is not at window origin');
    $('pbMove').click();await pause(100);
  })()`);
  await new Promise((r) => setTimeout(r, 250));
  const point = await win.webContents.executeJavaScript(`(() => {
    const c=document.querySelector('#pbViewport canvas'), tmp=document.createElement('canvas');
    tmp.width=c.width;tmp.height=c.height;const ctx=tmp.getContext('2d');ctx.drawImage(c,0,0);
    const pixels=ctx.getImageData(0,0,c.width,c.height).data, red=[];
    for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++) {const i=(y*c.width+x)*4;if(pixels[i]>235&&pixels[i+1]<65&&pixels[i+2]<65)red.push([x,y]);}
    if(red.length<5)throw Error('Translation gizmo X axis was not rendered');
    const minX=Math.min(...red.map(p=>p[0])), tip=red.filter(p=>p[0]>=minX+3&&p[0]<=minX+9);
    if(!tip.length)throw Error('Cannot locate translation handle');
    const r=c.getBoundingClientRect();return {x:Math.round(r.left+tip.reduce((n,p)=>n+p[0],0)/tip.length/c.width*r.width),y:Math.round(r.top+tip.reduce((n,p)=>n+p[1],0)/tip.length/c.height*r.height),before:Number(document.getElementById('pbPositionX').value)};
  })()`);
  win.webContents.sendInputEvent({ type: 'mouseMove', x: point.x, y: point.y });
  await new Promise((r) => setTimeout(r, 80));
  win.webContents.sendInputEvent({
    type: 'mouseDown',
    button: 'left',
    clickCount: 1,
    x: point.x,
    y: point.y,
  });
  for (let i = 1; i <= 6; i++) {
    win.webContents.sendInputEvent({ type: 'mouseMove', x: point.x + i * 8, y: point.y });
    await new Promise((r) => setTimeout(r, 25));
  }
  win.webContents.sendInputEvent({
    type: 'mouseUp',
    button: 'left',
    clickCount: 1,
    x: point.x + 48,
    y: point.y,
  });
  await new Promise((r) => setTimeout(r, 150));
  const after = await win.webContents.executeJavaScript(
    `Number(document.getElementById('pbPositionX').value)`,
  );
  if (Math.abs(after - point.before) < 1) throw Error('Real mouse drag did not move selected ped');
  await win.webContents.executeJavaScript(
    `document.getElementById('pbMove').click();document.getElementById('pbFit').click();`,
  );
  await new Promise((r) => setTimeout(r, 250));
  await fs.writeFile(
    path.resolve('release/qa/photo-booth-fullscreen-neon-verified.png'),
    (await win.webContents.capturePage()).toPNG(),
  );
  await win.webContents.executeJavaScript(
    `document.getElementById('pbStageStudio').value='loft';document.getElementById('pbStageStudio').dispatchEvent(new Event('change'));`,
  );
  await new Promise((r) => setTimeout(r, 250));
  await fs.writeFile(
    path.resolve('release/qa/photo-booth-fullscreen-loft-verified.png'),
    (await win.webContents.capturePage()).toPNG(),
  );
  await win.webContents.executeJavaScript(`document.getElementById('pbFullscreen').click();`);
  return { realMouseGizmoDrag: true, windowOriginFullscreen: true, stableStudioScreenshots: true };
};
