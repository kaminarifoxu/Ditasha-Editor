module.exports = async function checkLargeEmoteLibrary(win, ped) {
  const { boothYcdFixture } = await import('../tests/fixtures/booth-ycd.mjs');
  const { inflateRaw, deflateRaw } = await import('pako');
  const original = new Uint8Array(boothYcdFixture());
  const variants = Array.from({ length: 12 }, (_, file) => {
    const data = inflateRaw(original.subarray(16)),
      v = new DataView(data.buffer);
    const ptr = (at, offset) => v.setBigUint64(at, BigInt(0x50000000 + offset), true);
    for (let index = 0; index < 199; index++) {
      const entry = 3000 + index * 24;
      v.setUint32(entry, index + 1000, true);
      ptr(entry + 8, 192);
      if (index < 198) ptr(entry + 16, entry + 24);
    }
    ptr(176, 3000);
    data[8191] = file;
    const compressed = deflateRaw(data),
      out = new Uint8Array(16 + compressed.length);
    out.set(original.subarray(0, 16));
    out.set(compressed, 16);
    return [...out];
  });
  return win.webContents.executeJavaScript(`(async()=>{
    const $=id=>document.getElementById(id),pause=ms=>new Promise(r=>setTimeout(r,ms));
    const ready=async(test,msg)=>{const end=Date.now()+30000;while($('pbPed').disabled||!test()){if(Date.now()>end)throw Error(msg+': '+$('pbStatus').textContent);await pause(40);}};
    $('pbClear').click();$('pbPed').click();let dt=new DataTransfer();dt.items.add(new File([new Uint8Array(${JSON.stringify([...new Uint8Array(ped)])})],'library-ped.glb'));$('pbInput').files=dt.files;$('pbInput').dispatchEvent(new Event('change'));await ready(()=>$('pbActor').options.length===1,'Scale ped');
    const embedded=$('pbClip').options.length,variants=${JSON.stringify(variants)};dt=new DataTransfer();variants.forEach((data,i)=>dt.items.add(new File([new Uint8Array(data)],'library-'+i+'.ycd')));dt.items.add(new File([new Uint8Array(variants[0])],'renamed-duplicate.ycd'));const escrow=new Uint8Array(32);escrow.set(new TextEncoder().encode('FXAP'));dt.items.add(new File([escrow],'protected.ycd'));
    $('pbClipInput').files=dt.files;$('pbClipInput').dispatchEvent(new Event('change'));await ready(()=>$('pbClip').options.length===embedded+2400,'Large catalog import');
    if(!$('pbStatus').textContent.includes('duplikat'))throw Error('Duplicate source was not skipped');
    if(!$('pbIssueList').textContent.includes('Asset Escrow')||$('pbIssueList').textContent.includes('2048 clip'))throw Error('Header or catalog limit regression');
    const select=$('pbClip');select.selectedIndex=select.options.length-1;select.dispatchEvent(new Event('change'));await pause(300);
    if(!select.value.startsWith('external:'))throw Error('Large catalog selection lost');
    $('pbLibraryName').value='QA 2400 clips';$('pbLibrarySave').click();await ready(()=>[...$('pbLibraryList').children].some(o=>o.textContent.includes('QA 2400 clips')),'Large catalog save');
    const card=[...$('pbLibraryList').children].find(o=>o.textContent.includes('QA 2400 clips'));card.querySelector('button').click();await ready(()=>$('pbClip').options.length===embedded+2400,'Large catalog restore');
    return {catalog2400Clips:true,duplicateSkipped:true,headerDiagnosed:true,presetRestored:true};
  })()`);
};
