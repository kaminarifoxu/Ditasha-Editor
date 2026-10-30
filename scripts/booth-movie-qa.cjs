'use strict';
module.exports = async function checkMovie(win, ped, fs, path) {
  const rect = await win.webContents.executeJavaScript(`(async()=>{
  const $=id=>document.getElementById(id),pause=ms=>new Promise(r=>setTimeout(r,ms));
  if($('pbFullscreen').textContent.includes('Keluar'))$('pbFullscreen').click();
  $('pbClear').click();$('pbPed').click();const dt=new DataTransfer();dt.items.add(new File([new Uint8Array(${JSON.stringify([...new Uint8Array(ped)])})],'cinema-ped.glb'));$('pbInput').files=dt.files;$('pbInput').dispatchEvent(new Event('change'));
  const end=Date.now()+20000;while($('pbPed').disabled||$('pbActor').options.length!==1){if(Date.now()>end)throw Error('Cinema ped import');await pause(40);}
  $('pbMovieToggle').click();if($('pbMovieBody').hidden)$('pbMovieMinimize').click();$('pbMovieDuration').value='1';$('pbMovieDuration').dispatchEvent(new Event('change'));$('pbMovieKey').click();$('pbMovieTime').value='1';$('pbMovieTime').dispatchEvent(new Event('change'));
  const r=document.querySelector('#pbViewport canvas').getBoundingClientRect();return{x:r.left+r.width*.65,y:r.top+r.height*.45};
 })()`);
  win.webContents.sendInputEvent({
    type: 'mouseMove',
    x: Math.round(rect.x),
    y: Math.round(rect.y),
  });
  win.webContents.sendInputEvent({
    type: 'mouseDown',
    x: Math.round(rect.x),
    y: Math.round(rect.y),
    button: 'left',
    clickCount: 1,
  });
  for (let i = 1; i <= 5; i++) {
    win.webContents.sendInputEvent({
      type: 'mouseMove',
      x: Math.round(rect.x - i * 15),
      y: Math.round(rect.y + i * 4),
      button: 'left',
    });
    await new Promise((r) => setTimeout(r, 15));
  }
  win.webContents.sendInputEvent({
    type: 'mouseUp',
    x: Math.round(rect.x - 75),
    y: Math.round(rect.y + 20),
    button: 'left',
    clickCount: 1,
  });
  const result = await win.webContents.executeJavaScript(`(async()=>{
  const $=id=>document.getElementById(id),pause=ms=>new Promise(r=>setTimeout(r,ms)),field=k=>document.querySelector('#pbMoviePanel [data-movie="'+k+'"]');
  async function wait(test,msg){const end=Date.now()+30000;while(!test()){if(Date.now()>end)throw Error(msg+': '+$('pbMovieStatus').textContent);await pause(40);}}
  // The playhead was set to the end before the real viewport orbit.
  field('fov').value='60';field('fov').dispatchEvent(new Event('input'));field('roll').value='15';field('roll').dispatchEvent(new Event('input'));field('fill').value='1.4';field('fill').dispatchEvent(new Event('input'));$('pbMovieKey').click();
  if($('pbMovieMarkers').children.length!==2)throw Error('Camera markers missing');
  $('pbMovieTime').value='.5';$('pbMovieTime').dispatchEvent(new Event('change'));if(Math.abs(Number(field('fov').value)-47.5)>.01)throw Error('Camera FOV interpolation failed');
  $('pbMoviePlay').click();await pause(150);$('pbMovieStop').click();if(Number($('pbMovieTime').value)<=.5)throw Error('Movie preview clock did not advance');
  $('pbMovieTime').value='0';$('pbMovieTime').dispatchEvent(new Event('change'));
  const canvas=document.querySelector('#pbViewport canvas'),before=canvas.toDataURL();
  const blobs=[],oldURL=URL.createObjectURL,oldClick=HTMLAnchorElement.prototype.click,oldSave=window.ditashaDesktop?.saveExport;
  if(oldSave)window.ditashaDesktop.saveExport=async req=>{if(req.name.endsWith('.webm')){blobs.push(new Blob([req.data],{type:'video/webm'}));return{saved:true};}return oldSave(req);};
  URL.createObjectURL=function(blob){if(blob.type.startsWith('video/'))blobs.push(blob);return oldURL.call(URL,blob);};
  HTMLAnchorElement.prototype.click=function(){if(this.download?.endsWith('.webm'))return;return oldClick.call(this);};
  try{
   $('pbMovieExport').click();$('pbMovieCancel').click();await wait(()=>!$('pbMovieExport').disabled&&!$('pbPed').disabled,'Video cancel');
   if(blobs.length||canvas.toDataURL()!==before)throw Error('Cancelled video changed camera or produced output');
   $('pbMovieExport').click();await wait(()=>!$('pbMovieExport').disabled&&blobs.length===1,'WebM export');
   if(canvas.toDataURL()!==before)throw Error('Video export did not restore preview');
   URL.createObjectURL=oldURL;HTMLAnchorElement.prototype.click=oldClick;
   const blob=blobs[0],url=URL.createObjectURL(blob),video=document.createElement('video');video.muted=true;video.preload='auto';
   await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Video metadata timeout')),10000);video.onloadedmetadata=()=>{clearTimeout(timer);resolve();};video.onerror=()=>{clearTimeout(timer);reject(Error('WebM decoder rejected video'));};video.src=url;});
   if(!Number.isFinite(video.duration)||Math.abs(video.duration-1)>.06||video.videoWidth!==1280||video.videoHeight!==720)throw Error('Video duration or dimensions invalid: '+video.duration);
   const c=document.createElement('canvas');c.width=96;c.height=54;const ctx=c.getContext('2d');
   async function decoded(at){await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Video seek timeout')),10000);video.onseeked=()=>{clearTimeout(timer);resolve();};video.currentTime=at;});ctx.drawImage(video,0,0,96,54);return c.toDataURL();}
   const first=await decoded(.1),last=await decoded(.8);if(first===last)throw Error('Encoded video is static');URL.revokeObjectURL(url);
   // Fisheye must produce an actual nonempty circular projection, then restore.
   field('fov').value='150';field('fov').dispatchEvent(new Event('input'));field('fisheye').checked=true;field('fisheye').dispatchEvent(new Event('input'));await pause(100);
   ctx.drawImage(canvas,0,0,96,54);const pixels=ctx.getImageData(0,0,96,54).data;let warm=0;for(let i=0;i<pixels.length;i+=4)if(pixels[i]>pixels[i+2]*1.1&&pixels[i]>60)warm++;
   if(pixels[0]>5||pixels[1]>5||pixels[2]>5||warm<5)throw Error('Fisheye projection is blank or missing circular mask: '+warm);
   field('fisheye').checked=false;field('fisheye').dispatchEvent(new Event('input'));field('fov').value='35';field('fov').dispatchEvent(new Event('input'));
   $('pbLibraryName').value='QA cinematic camera';$('pbLibrarySave').click();await wait(()=>!$('pbPed').disabled&&[...$('pbLibraryList').querySelectorAll('article')].some(n=>n.textContent.includes('QA cinematic camera')),'Movie preset save');
   const row=[...$('pbLibraryList').querySelectorAll('article')].find(n=>n.textContent.includes('QA cinematic camera'));
   $('pbMovieDelete').click();row.querySelector('[data-library-load]').click();await wait(()=>!$('pbPed').disabled&&$('pbMovieMarkers').children.length===2,'Movie preset restore');
   return{movieCameraMarkers:true,cameraInterpolation:true,moviePreview:true,movieCancelRestoresScene:true,webmExport:true,finiteVideoDuration:video.duration,videoDimensions:[video.videoWidth,video.videoHeight],encodedCameraMoves:true,circularFisheye:true,moviePresetPersistence:true,videoBytes:[...new Uint8Array(await blob.arrayBuffer())]};
  }finally{URL.createObjectURL=oldURL;HTMLAnchorElement.prototype.click=oldClick;if(oldSave)window.ditashaDesktop.saveExport=oldSave;}
 })()`);
  const video = result.videoBytes;
  delete result.videoBytes;
  await fs.writeFile(
    path.resolve('release/qa/booth-movie-result.json'),
    JSON.stringify({ report: result, videoBase64: Buffer.from(video).toString('base64') }),
  );
  await fs.writeFile(
    path.resolve('release/qa/photo-booth-cinematic.png'),
    (await win.webContents.capturePage()).toPNG(),
  );
  return result;
};
