'use strict';
module.exports = async function checkGtaGrid(win, ped, fs, path) {
  const { studioMetaFixture } = await import('../tests/fixtures/studio-meta.mjs');
  const { testYdr } = await import('../tests/format.test.mjs');
  const { boothYcdFixture } = await import('../tests/fixtures/booth-ycd.mjs');
  const files = [
    ['stream/room.ymap', studioMetaFixture()],
    ['stream/types.ytyp', studioMetaFixture('ytyp')],
    ['stream/qa-room.ydr', testYdr],
  ].map(([name, b], i) => ({
    id: 'gta-qa-' + i,
    path: name,
    kind: name.split('.').at(-1),
    size: b.byteLength,
    bytes: [...new Uint8Array(b)],
  }));
  const { writeRpf } = await import('../src/archives.js');
  // Synthetic standalone fixtures use placeholder page-version nibbles.
  // RPF reconstructs the resource version from those nibbles, not header byte 4.
  const rpf = writeRpf(
    files.map((e) => {
      const data = new Uint8Array(e.bytes),
        view = new DataView(data.buffer);
      const version = view.getUint32(4, true);
      view.setUint32(8, (view.getUint32(8, true) & 0x0fffffff) | ((version >>> 4) << 28), true);
      view.setUint32(12, (view.getUint32(12, true) & 0x0fffffff) | ((version & 15) << 28), true);
      return { name: e.path, data };
    }),
  );
  const encrypted = rpf.slice();
  new DataView(encrypted.buffer).setUint32(12, 0x12345678, true);
  for (const [id, bytes] of [
    ['open-rpf', rpf],
    ['encrypted-rpf', encrypted],
  ])
    files.push({ id, path: id + '.rpf', kind: 'rpf', size: bytes.length, bytes: [...bytes] });
  const report = await win.webContents.executeJavaScript(`(async()=>{
 const $=id=>document.getElementById(id),pause=ms=>new Promise(r=>setTimeout(r,ms));
 async function wait(test,msg){const end=Date.now()+20000;while(!test()){if(Date.now()>end)throw Error(msg+': '+$('pbStatus').textContent);await pause(40);}}
 const sources=${JSON.stringify(files)};let chosen=false,revealed=false;
 window.ditashaGtaInstall={state:async()=>({root:chosen?'QA GTA V':'',edition:'Legacy',message:'QA read-only source'}),choose:async()=>{chosen=true;return window.ditashaGtaInstall.state();},scan:async()=>({root:'QA GTA V',edition:'Legacy',message:'Read-only',scanned:true,archives:0,maps:1,files:sources.map(({bytes,...e})=>e)}),reveal:async()=>{revealed=true;},read:async(id,start,length)=>new Uint8Array(sources.find(e=>e.id===id).bytes.slice(start,start+length))};
 $('openSettings').click();$('gtaInstallChoose').click();await wait(()=>$('gtaInstallPath').value==='QA GTA V','GTA settings choose');$('gtaInstallScan').click();await wait(()=>$('gtaInstallStatus').textContent.includes('1 YMAP'),'GTA settings scan');$('gtaInstallReveal').click();await wait(()=>revealed,'GTA reveal');$('settingsClose').click();
 $('pbClear').click();$('pbPed').click();let dt=new DataTransfer();for(let i=0;i<2;i++)dt.items.add(new File([new Uint8Array(${JSON.stringify([...new Uint8Array(ped)])})],'grid-ped-'+i+'.glb'));$('pbInput').files=dt.files;$('pbInput').dispatchEvent(new Event('change'));await wait(()=>!$('pbPed').disabled&&$('pbActor').options.length===2,'Grid peds');
 dt=new DataTransfer();for(let i=0;i<2;i++)dt.items.add(new File([new Uint8Array(${JSON.stringify([...new Uint8Array(boothYcdFixture())])})],'grid-emote-'+i+'.ycd'));$('pbClipInput').files=dt.files;$('pbClipInput').dispatchEvent(new Event('change'));await wait(()=>!$('pbPed').disabled&&$('pbClip').options.length===3,'Grid clips');
 const actorIds=[...$('pbActor').options].map(o=>o.value);$('pbActor').value=actorIds[0];$('pbActor').dispatchEvent(new Event('change'));
 const picker=$('pbClipPicker');picker.open=true;await pause(40);const grid=picker.querySelector('.pb-emote-grid');
 if(getComputedStyle(grid).gridTemplateColumns.split(' ').length!==3||!$('pbClip').hidden)throw Error('Emote picker must have three button columns');
 grid.children[1].click();const first=$('pbClip').value;
 $('pbActor').value=actorIds[1];$('pbActor').dispatchEvent(new Event('change'));picker.open=true;await pause(40);grid.children[2].click();if($('pbPose').value!=='clip')throw Error('Emote button did not enable clip pose');
 $('pbActor').value=actorIds[0];$('pbActor').dispatchEvent(new Event('change'));if($('pbClip').value!==first)throw Error('Grid selection leaked between peds');
 $('pbGtaStudio').click();await wait(()=>[...document.querySelectorAll('dialog[open]')].some(d=>d.querySelector('[data-open]')),'GTA studio dialog');const dialog=[...document.querySelectorAll('dialog[open]')].find(d=>d.querySelector('[data-open]'));dialog.querySelector('select').value='gta-qa-0';dialog.querySelector('[data-open]').click();await wait(()=>!$('pbPed').disabled&&$('pbStudio').selectedOptions[0].textContent.includes('room'),'Installed studio import');
 const beforeMaps=[...$('pbStudio').options].filter(o=>o.value.startsWith('custom:')).length;
 async function chooseArchive(id){$('pbGtaStudio').click();await wait(()=>[...document.querySelectorAll('dialog[open]')].some(d=>d.querySelector('[data-open]')),'GTA archive chooser');const d=[...document.querySelectorAll('dialog[open]')].find(d=>d.querySelector('[data-open]'));d.querySelector('select').value=id;d.querySelector('[data-open]').click();await wait(()=>!$('pbPed').disabled,'GTA archive read');}
 await chooseArchive('open-rpf');if([...$('pbStudio').options].filter(o=>o.value.startsWith('custom:')).length!==beforeMaps+1)throw Error('Installed OPEN RPF failed to import: '+$('pbStatus').textContent);
 await chooseArchive('encrypted-rpf');if(!$('pbStatus').textContent.includes('Encrypted RPF')||[...$('pbStudio').options].filter(o=>o.value.startsWith('custom:')).length!==beforeMaps+1)throw Error('Encrypted RPF did not fail safely');
 if(!$('pbViewCulling').checked||!$('pbCullStats').textContent.includes('mesh studio'))throw Error('Viewport culling missing');
 $('pbFullscreen').click();await pause(80);picker.open=true;await pause(40);if(!$('pbEmoteBody').contains(picker))throw Error('Grid did not move into fullscreen player');
 return{gtaInstallSettings:true,gtaInstallStudioImport:true,installedOpenRpf:true,encryptedRpfRejected:true,threeColumnEmotePicker:true,independentGridSelection:true,fullscreenEmoteGrid:true,studioFrustumControl:true};
 })()`);
  await fs.writeFile(
    path.resolve('release/qa/photo-booth-emote-grid.png'),
    (await win.webContents.capturePage()).toPNG(),
  );
  return report;
};
