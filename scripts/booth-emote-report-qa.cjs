'use strict';
module.exports = async function checkEmoteReports(win, ped, fs, path) {
  const { boothYcdFixture } = await import('../tests/fixtures/booth-ycd.mjs');
  const { inflateRaw, deflateRaw } = await import('pako');
  const input = new Uint8Array(boothYcdFixture());
  function list(count) {
    const data = inflateRaw(input.subarray(16)),
      v = new DataView(data.buffer);
    const ptr = (at, n) => v.setBigUint64(at, BigInt(0x50000000 + n), true);
    v.setUint32(208, 2, true);
    ptr(272, 2048);
    v.setUint16(280, count, true);
    v.setUint16(282, count, true);
    v.setFloat32(288, 2, true);
    v.setFloat32(2048, 0, true);
    v.setFloat32(2052, 1, true);
    v.setFloat32(2056, 1, true);
    ptr(2064, 352);
    const compressed = deflateRaw(data),
      out = new Uint8Array(16 + compressed.length);
    out.set(input.subarray(0, 16));
    out.set(compressed, 16);
    return [...out];
  }
  const report = await win.webContents.executeJavaScript(`(async()=>{
    const $=id=>document.getElementById(id),pause=ms=>new Promise(r=>setTimeout(r,ms));
    async function ready(test,msg){const end=Date.now()+20000;while($('pbPed').disabled||!test()){if(Date.now()>end)throw Error(msg+': '+$('pbStatus').textContent);await pause(40);}}
    $('pbClear').click();$('pbPed').click();let dt=new DataTransfer();dt.items.add(new File([new Uint8Array(${JSON.stringify([...new Uint8Array(ped)])})],'qa-report-ped.glb'));$('pbInput').files=dt.files;$('pbInput').dispatchEvent(new Event('change'));await ready(()=>$('pbActor').options.length===1,'Emote report ped');
    const baseClips=$('pbClip').options.length;
    dt=new DataTransfer();dt.items.add(new File([new Uint8Array(${JSON.stringify([...input])})],'valid-body.ycd'));dt.items.add(new File([new Uint8Array(${JSON.stringify(list(1))})],'single-list.ycd'));
    const blend=new Uint8Array(${JSON.stringify(list(2))});for(let i=0;i<220;i++)dt.items.add(new File([blend],'facial-blend-'+i+'.ycd'));
    dt.items.add(new File([new Uint8Array(64)],'unknown-header.ycd'));
    $('pbClipInput').files=dt.files;$('pbClipInput').dispatchEvent(new Event('change'));
    await ready(()=>$('pbClip').options.length===baseClips+2&&!$('pbShowIssues').hidden,'Mixed emote import');
    const text=$('pbStatus').textContent;
    if(text.length>180||!text.includes('221 peringatan')||$('pbStatus').getBoundingClientRect().height>75)throw Error('Emote warnings still flood viewport');
    if($('pbIssueList').children.length!==201||!$('pbIssueList').textContent.includes('peringatan lain'))throw Error('Emote details not bounded');
    if(![...$('pbClip').options].some(o=>o.textContent.includes('single-list.ycd')))throw Error('Single-source list missing');
    $('pbMatte').checked=true;$('pbMatte').dispatchEvent(new Event('change'));
    if($('pbIssues').hidden||$('pbIssueList').children.length<201)throw Error('Rebuild lost emote details');
    $('pbShowIssues').click();await pause(80);
    return{compactEmoteReport:true,boundedEmoteDetails:true,mixedImportKeepsValidClips:true,singleSourceListImport:true,emoteIssuesSurviveRebuild:true};
  })()`);
  await fs.writeFile(
    path.resolve('release/qa/photo-booth-emote-report.png'),
    (await win.webContents.capturePage()).toPNG(),
  );
  return report;
};
