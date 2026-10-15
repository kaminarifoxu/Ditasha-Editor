'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
module.exports = async function checkPhoto({ contents, host, temp, setSavePath }) {
  const fixture = path.join(temp, 'ditasha-photo-check.png');
  const output = path.join(temp, 'edited-photo.png');
  const base64 = await host.executeJavaScript(
    `(()=>{const c=document.createElement('canvas');c.width=c.height=32;const x=c.getContext('2d');x.fillStyle='#ef2030';x.fillRect(0,0,32,32);return c.toDataURL('image/png').split(',')[1];})()`,
  );
  await fs.writeFile(fixture, Buffer.from(base64, 'base64'));
  contents.debugger.attach('1.3');
  try {
    await contents.debugger.sendCommand('Page.enable');
    await contents.debugger.sendCommand('Page.setInterceptFileChooserDialog', { enabled: true });
    let chooser;
    const handler = (_event, method, params) => {
      if (method === 'Page.fileChooserOpened') chooser = params;
    };
    contents.debugger.on('message', handler);
    const shortcut = (key) => {
      contents.focus();
      contents.sendInputEvent({ type: 'keyDown', keyCode: key, modifiers: ['control'] });
      contents.sendInputEvent({ type: 'keyUp', keyCode: key, modifiers: ['control'] });
    };
    shortcut('O');
    let end = Date.now() + 15000;
    while (!chooser && Date.now() < end) await sleep(100);
    assert.ok(chooser?.backendNodeId, 'Photo Studio did not expose its real Open dialog');
    await contents.debugger.sendCommand('DOM.setFileInputFiles', {
      backendNodeId: chooser.backendNodeId,
      files: [fixture],
    });
    contents.debugger.removeListener('message', handler);
    await sleep(1500);
    // The real engine handles the imported image and Save; no document or export API is stubbed.
    setSavePath(output);
    let result;
    contents.session.once('will-download', (_event, item) => {
      item.once('done', (_e, state) => {
        result = { state, filename: item.getFilename() };
      });
    });
    shortcut('S');
    end = Date.now() + 15000;
    while (!result && Date.now() < end) await sleep(100);
    assert.equal(result?.state, 'completed', 'Photo Studio did not export the imported document');
    const bytes = await fs.readFile(output);
    assert.ok(bytes.length > 32, 'Photo Studio exported an empty document');
    // Save retains PNG when a PNG was opened, allowing a lossless texture exchange.
    assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    const pixel = await host.executeJavaScript(
      `(async()=>{const b=await createImageBitmap(new Blob([Uint8Array.from(atob('${bytes.toString('base64')}'),c=>c.charCodeAt(0))],{type:'image/png'}));const c=document.createElement('canvas');c.width=b.width;c.height=b.height;c.getContext('2d').drawImage(b,0,0);const p=[...c.getContext('2d').getImageData(16,16,1,1).data];return {w:b.width,h:b.height,p};})()`,
    );
    assert.equal(pixel.w, 32);
    assert.equal(pixel.h, 32);
    assert.deepEqual(pixel.p, [239, 32, 48, 255]);
    console.log('PASS: Photo Studio actual PNG open/save and texture pixel round-trip');
    return { open: true, save: true, pngPixels: true };
  } finally {
    setSavePath(undefined);
    contents.debugger.detach();
  }
};
