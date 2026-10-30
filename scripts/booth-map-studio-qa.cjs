'use strict';
module.exports = async function checkMapStudio(win, fixtures, fs, path) {
  const report = await win.webContents.executeJavaScript(`(async()=>{
 const $=id=>document.getElementById(id),pause=ms=>new Promise(r=>setTimeout(r,ms));
 async function ready(test,msg){const end=Date.now()+20000;while($('pbPed').disabled||!test()){if(Date.now()>end)throw Error(msg+': '+$('pbStatus').textContent);await pause(40);}}
 $('pbClear').click();$('pbPed').click();let dt=new DataTransfer();dt.items.add(new File([new Uint8Array(${JSON.stringify(fixtures.ped)})],'qa-studio-ped.glb'));$('pbInput').files=dt.files;$('pbInput').dispatchEvent(new Event('change'));await ready(()=>$('pbActor').options.length===1,'Custom studio ped');
 dt=new DataTransfer();dt.items.add(new File([new Uint8Array(${JSON.stringify(fixtures.zip)})],'qa-rooms.zip'));$('pbStudioZipInput').files=dt.files;$('pbStudioZipInput').dispatchEvent(new Event('change'));
 await ready(()=>$('pbStudio').value.startsWith('custom:')&&!$('pbCustomStudioSettings').hidden,'Studio ZIP import');
 const custom=[...$('pbStudio').options].filter(o=>o.value.startsWith('custom:'));if(custom.length!==2)throw Error('Studio pack maps were not separate options');
 $('pbStudio').value=custom[1].value;$('pbStudio').dispatchEvent(new Event('change'));await ready(()=>true,'Custom studio selection');
 $('pbStudioY').value='.2';$('pbStudioY').dispatchEvent(new Event('input'));$('pbStudioYaw').value='30';$('pbStudioYaw').dispatchEvent(new Event('input'));
 if($('pbMove').getAttribute('aria-pressed')==='true')$('pbMove').click();
 const card=$('pbAssets').querySelector('[data-asset-card]'),visible=card.querySelector('input[type=checkbox]');visible.checked=false;visible.dispatchEvent(new Event('change'));
 const image=()=>document.querySelector('#pbViewport canvas').toDataURL(),before=image();
 $('pbPositionX').value='200';$('pbPositionX').dispatchEvent(new Event('change'));if(image()!==before)throw Error('Imported studio moved with ped');
 $('pbStudioCutaway').checked=false;$('pbStudioCutaway').dispatchEvent(new Event('input'));
 $('pbLibraryName').value='QA native studio pack';$('pbLibrarySave').click();await ready(()=>true,'Custom studio preset save');
 const row=[...$('pbLibraryList').querySelectorAll('article')].find(n=>n.textContent.includes('QA native studio pack')),id=row.querySelector('[data-library-load]').dataset.libraryLoad;
 $('pbStudio').value='plain';$('pbStudio').dispatchEvent(new Event('change'));$('pbClear').click();document.querySelector('[data-library-load="'+id+'"]').click();
 await ready(()=>$('pbActor').options.length===1&&$('pbStudio').value===custom[1].value,'Custom studio preset restore');
 if(Number($('pbStudioY').value)!==.2||Number($('pbStudioYaw').value)!==30||$('pbStudioCutaway').checked||[...$('pbStudio').options].filter(o=>o.value.startsWith('custom:')).length!==2)throw Error('Studio sources/settings did not persist');
 $('pbAssets').querySelector('input[type=checkbox]').checked=true;$('pbAssets').querySelector('input[type=checkbox]').dispatchEvent(new Event('change'));$('pbFit').click();
 return{nativeStudioZip:true,multipleStudioMaps:true,stationaryImportedStudio:true,customStudioPreset:true,customStudioPlacement:true};
 })()`);
  await new Promise((r) => setTimeout(r, 150));
  await fs.writeFile(
    path.resolve('release/qa/photo-booth-imported-studio.png'),
    (await win.webContents.capturePage()).toPNG(),
  );
  return report;
};
