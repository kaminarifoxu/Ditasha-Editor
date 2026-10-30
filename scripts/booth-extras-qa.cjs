'use strict';
module.exports = async function checkBoothExtras(win, fixtures, fs, path) {
  const report = await win.webContents.executeJavaScript(`(async()=>{
    const $=id=>document.getElementById(id),pause=ms=>new Promise(r=>setTimeout(r,ms));
    const upload=(file,name)=>{const dt=new DataTransfer();dt.items.add(new File([new Uint8Array(file)],name));$('pbInput').files=dt.files;$('pbInput').dispatchEvent(new Event('change'));};
    async function ready(count){const end=Date.now()+15000;while($('pbPed').disabled||$('pbActor').options.length!==count){if(Date.now()>end)throw Error('Extra QA import timeout '+$('pbStatus').textContent);await pause(40);}}
    const canvas=()=>document.querySelector('#pbViewport canvas'),image=()=>canvas().toDataURL();
    const ids=[...$('pbActor').options].map(o=>o.value);$('pbActor').value=ids[0];$('pbActor').dispatchEvent(new Event('change'));
    $('pbYaw').value='45';const before=image();$('pbYaw').dispatchEvent(new Event('change'));if(image()===before)throw Error('Ped rotation did not change render');
    $('pbMatte').checked=true;$('pbMatte').dispatchEvent(new Event('change'));if(!$('pbMatte').checked)throw Error('Matte control unavailable');
    $('pbVehicle').click();upload(${JSON.stringify(fixtures.yft)},'qa-car.yft');await ready(3);
    if(!document.querySelector('[data-category=vehicle]')||document.querySelector('[data-category=vehicle] [data-owner]'))throw Error('Native vehicle not independent');
    $('pbVehicle').click();upload(${JSON.stringify(fixtures.vehicle)},'qa-car.glb');await ready(4);
    $('pbYaw').value='90';$('pbYaw').dispatchEvent(new Event('change'));if(Number($('pbYaw').value)!==90)throw Error('Vehicle rotation unavailable');
    if(!$('pbMatte').disabled)throw Error('Ped matte incorrectly affects vehicle paint');
    $('pbPositionX').value='350';$('pbPositionX').dispatchEvent(new Event('change'));
    $('pbStudio').value='living';$('pbStudio').dispatchEvent(new Event('change'));$('pbTransparent').checked=false;$('pbTransparent').dispatchEvent(new Event('input'));$('pbFit').click();
    const shadowed=image();$('pbShadows').checked=false;$('pbShadows').dispatchEvent(new Event('input'));if(image()===shadowed)throw Error('Shadow toggle did not affect pixels');
    $('pbShadows').checked=true;$('pbShadows').dispatchEvent(new Event('input'));$('pbShadowStrength').value='.4';$('pbShadowStrength').dispatchEvent(new Event('input'));$('pbShadowAngle').value='120';$('pbShadowAngle').dispatchEvent(new Event('input'));
    $('pbLibraryName').value='QA vehicles + studios';$('pbLibrarySave').click();while($('pbLibrarySave').disabled)await pause(40);
    const row=[...$('pbLibraryList').querySelectorAll('article')].find(a=>a.textContent.includes('QA vehicles + studios'));if(!row)throw Error('Extra preset not saved');const preset=row.querySelector('[data-library-load]').dataset.libraryLoad;
    $('pbClear').click();document.querySelector('[data-library-load="'+preset+'"]').click();await ready(4);
    if($('pbStudio').value!=='living'||Number($('pbShadowStrength').value)!==.4||Number($('pbShadowAngle').value)!==120)throw Error('Shadow/studio preset lost');
    $('pbActor').value=$('pbActor').options[0].value;$('pbActor').dispatchEvent(new Event('change'));if(!$('pbMatte').checked||Number($('pbYaw').value)!==45)throw Error('Ped matte/yaw preset lost');
    $('pbRigSource').value='freemode-male';$('pbRigSource').dispatchEvent(new Event('change'));
    $('pbProp').click();upload(${JSON.stringify(fixtures.nativeProp)},'qa-hand-prop.ydd');
    await ready(4);
    const card=[...$('pbAssets').querySelectorAll('[data-asset-card]')].find(c=>c.textContent.includes('qa-hand-prop.ydd'));
    if(!card)throw Error('Prop not imported');
    if(!$('pbRigStatus').textContent.includes('0 mesh GTA skinned · 1 mesh statis/rigid'))throw Error('Native prop received ped skin recovery '+$('pbRigStatus').textContent);
    if([...$('pbIssueList').children].some(n=>n.textContent.includes('qa-hand-prop.ydd')&&/skeleton|indeks bone/.test(n.textContent)))throw Error('Rigid prop incorrectly warned about missing ped rig');
    if(card.querySelector('[data-bone]').value!=='SKEL_R_Hand'||!card.querySelector('[data-prop-status]').textContent.includes('Terikat'))throw Error('Prop did not attach automatically');
    card.querySelector('[data-grip=L]').click();
    const left=[...$('pbAssets').querySelectorAll('[data-asset-card]')].find(c=>c.textContent.includes('qa-hand-prop.ydd'));
    if(left.querySelector('[data-bone]').value!=='SKEL_L_Hand')throw Error('Left hand grip failed');
    left.querySelector('[data-grip=R]').click();
    const prop=[...$('pbAssets').querySelectorAll('[data-asset-card]')].find(c=>c.textContent.includes('qa-hand-prop.ydd'));
    if(prop.querySelector('[data-bone]').value!=='SKEL_R_Hand')throw Error('Prop hand grip failed '+$('pbStatus').textContent);
    const propOwner=prop.querySelector('[data-owner]');propOwner.value=$('pbActor').options[1].value;propOwner.dispatchEvent(new Event('change'));
    const moved=[...$('pbAssets').querySelectorAll('[data-asset-card]')].find(c=>c.textContent.includes('qa-hand-prop.ydd'));
    if(moved.querySelector('[data-bone]').value!=='SKEL_R_Hand'||!moved.querySelector('[data-prop-status]').textContent.includes('Terikat'))throw Error('Owner change lost hand attachment');
    $('pbFullscreen').click();await pause(150);return {nativePropStaysRigid:true,automaticPropGrip:true,propOwnerRebind:true,handPropGrip:true,pedRotation:true,nativeVehicleImport:true,glbVehicleImport:true,matteControl:true,shadowControls:true,extraPresetPersistence:true};
  })()`);
  for (const id of ['hood', 'living', 'office', 'police', 'beach', 'bedroom', 'bathroom']) {
    await win.webContents.executeJavaScript(
      `document.getElementById('pbStageStudio').value=${JSON.stringify(id)};document.getElementById('pbStageStudio').dispatchEvent(new Event('change'));`,
    );
    await new Promise((r) => setTimeout(r, 150));
    await fs.writeFile(
      path.resolve('release/qa/photo-booth-location-' + id + '.png'),
      (await win.webContents.capturePage()).toPNG(),
    );
  }
  await win.webContents.executeJavaScript(`document.getElementById('pbFullscreen').click();`);
  return { ...report, sevenLocationStudios: true };
};
