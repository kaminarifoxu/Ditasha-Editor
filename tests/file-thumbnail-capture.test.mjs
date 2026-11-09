import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { captureThumbnailRenderTarget } from '../src/file-thumbnail-capture.js';

test('GPU readback captures all thumbnail pixels and flips framebuffer rows', async () => {
  const oldDocument = globalThis.document;
  const oldImageData = globalThis.ImageData;
  let wrote = null;
  const renderer = {
    target: null, calls: [],
    getRenderTarget(){return this.target;},
    setRenderTarget(target){this.target=target;this.calls.push(['target',!!target]);},
    setViewport(...args){this.calls.push(['viewport',...args]);},
    setScissorTest(value){this.calls.push(['scissor',value]);},
    clear(){this.calls.push(['clear']);},
    render(){this.calls.push(['render']);},
    readRenderTargetPixels(target,x,y,w,h,dest){
      assert.equal(w,2);assert.equal(h,2);
      // Framebuffer pixel order: bottom row blue, top row red.
      dest.set([0,0,255,255,0,0,255,255,255,0,0,255,255,0,0,255]);
    },
  };
  globalThis.ImageData = class {constructor(data,width,height){Object.assign(this,{data,width,height});}};
  globalThis.document = {createElement:()=>({
    width:0,height:0,
    getContext:()=>({putImageData(value){wrote=value;}}),
    toBlob(callback){callback({ok:true});},
  })};
  try {
    const result = await captureThumbnailRenderTarget(renderer,{}, {}, 2,2);
    assert.equal(result.ok,true);
    assert.deepEqual([...wrote.data.slice(0,8)],[255,0,0,255,255,0,0,255]);
    assert.deepEqual([...wrote.data.slice(8,16)],[0,0,255,255,0,0,255,255]);
    assert.deepEqual(renderer.calls.filter(x=>x[0]==='target').map(x=>x[1]),[true,false]);
    assert.equal(renderer.target,null);
  } finally {
    if(oldDocument===undefined)delete globalThis.document;
    else globalThis.document=oldDocument;
    if(oldImageData===undefined)delete globalThis.ImageData;
    else globalThis.ImageData=oldImageData;
  }
});

test('static snapshots use GPU framebuffer, not clipped offscreen WebGL canvas',()=>{
  const viewer=readFileSync(new URL('../src/file-preview.js',import.meta.url),'utf8');
  assert.match(viewer,/captureThumbnailRenderTarget\(renderer, scene, camera, host\.clientWidth, host\.clientHeight\)/);
  assert.doesNotMatch(viewer,/renderer\.domElement\.toBlob/);
  assert.match(viewer,/if \(snapshot\) \{\s*\/\/ Use the dedicated render target/);
  assert.match(viewer,/if \(!snapshot\) controls\.addEventListener\('change', draw\)/);
});
