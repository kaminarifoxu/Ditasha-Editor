module.exports = async function checkBoothVehicleMaterials(win, ped) {
  const { viewerModel } = await import('../tests/viewer-format.test.mjs');
  const { liveryYftFixture } = await import('../tests/fixtures/livery-yft.mjs');
  const { createYtd } = await import('../src/asset-tools.js');
  const model = liveryYftFixture(viewerModel, { embedded: false, shader: 'vehicle_paint4' });
  const dictionary = createYtd([
    {
      name: 'cloth_diffuse',
      w: 2,
      h: 2,
      out: new Uint8Array(Array(4).fill([10, 25, 240, 255]).flat()),
    },
    {
      name: 'vehicle_sign_1',
      w: 2,
      h: 2,
      out: new Uint8Array([5, 240, 10, 255, 5, 240, 10, 0, 5, 240, 10, 255, 5, 240, 10, 0]),
    },
  ]);
  return win.webContents.executeJavaScript(`(async()=>{
    const $=id=>document.getElementById(id),pause=ms=>new Promise(r=>setTimeout(r,ms));
    const ready=async(test,msg)=>{const end=Date.now()+20000;while($('pbPed').disabled||!test()){if(Date.now()>end)throw Error(msg+': '+$('pbStatus').textContent);await pause(40);}};
    const upload=files=>{const dt=new DataTransfer();for(const [name,data]of files)dt.items.add(new File([new Uint8Array(data)],name));$('pbInput').files=dt.files;$('pbInput').dispatchEvent(new Event('change'));};
    $('pbClear').click();$('pbPed').click();upload([['material-ped.glb',${JSON.stringify([...new Uint8Array(ped)])}]]);await ready(()=>$('pbActor').options.length===1,'Vehicle material ped');
    $('pbVehicle').click();upload([['material-car_hi.yft',${JSON.stringify([...new Uint8Array(model)])}],['material-car.ytd',${JSON.stringify([...dictionary])}]]);await ready(()=>$('pbActor').options.length===2,'Vehicle material import');
    $('pbTransparent').checked=true;$('pbTransparent').dispatchEvent(new Event('input'));$('pbFloor').checked=false;$('pbFloor').dispatchEvent(new Event('input'));await pause(200);
    const colors=()=>{const source=document.querySelector('#pbViewport canvas'),c=document.createElement('canvas');c.width=source.width;c.height=source.height;const ctx=c.getContext('2d');ctx.drawImage(source,0,0);const pixels=ctx.getImageData(0,0,c.width,c.height).data;let green=0,blue=0;for(let i=0;i<pixels.length;i+=4){if(pixels[i+1]>pixels[i]*1.4&&pixels[i+1]>pixels[i+2]*1.4&&pixels[i+1]>40)green++;if(pixels[i+2]>pixels[i]*1.4&&pixels[i+2]>pixels[i+1]*1.4&&pixels[i+2]>40)blue++;}return{green,blue};};
    const before=colors();if(before.green<10||before.blue<10)throw Error('Photo Booth lost base or UV2 livery '+JSON.stringify(before));
    const card=[...$('pbAssets').querySelectorAll('[data-asset-card]')].find(c=>c.querySelector('strong')?.textContent==='material-car_hi.yft');if(!card.textContent.includes('cloth_diffuse → material-car.ytd'))throw Error('Vehicle YTD attached to selected ped');
    const select=card.querySelector('[data-preview-texture]');select.value=JSON.stringify(['material-car.ytd','vehicle_sign_1']);select.dispatchEvent(new Event('change'));await pause(100);document.querySelector('[data-auto-vehicle-textures]').click();await pause(100);const after=colors();if(after.blue<10||after.green<10)throw Error('Automatic per-material reset lost maps');
    return{vehicleScopeIndependentOfPed:true,uv2LiveryRendered:true,multipleDiffuseMapsAutomatic:true,autoReset:true};
  })()`);
};
