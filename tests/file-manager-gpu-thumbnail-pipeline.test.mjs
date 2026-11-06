import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createThumbnailDecoderPool } from '../src/file-thumbnail-decoder.js';
import { prepareThumbnailModel } from '../src/file-thumbnail-prepare.js';
const ui=readFileSync(new URL('../src/file-manager-ui.js',import.meta.url),'utf8');
const preview=readFileSync(new URL('../src/file-preview.js',import.meta.url),'utf8');
test('thumbnail decoder pool uses two independent workers and preserves responses',async()=>{
 const originalWorker=globalThis.Worker,originalDocument=globalThis.document;
 const created=[];
 class MockWorker{
   constructor(){created.push(this);}
   postMessage(job){
     queueMicrotask(()=>this.onmessage?.({data:{id:job.id,data:{kind:job.kind}}}));
   }
   terminate(){}
 }
 try{
   globalThis.Worker=MockWorker;
   globalThis.document={baseURI:'file:///ditasha/src/index.html'};
   const pool=createThumbnailDecoderPool(2);
   const [a,b,c]=await Promise.all([
     pool.decode('ydd',new ArrayBuffer(1)),
     pool.decode('ydr',new ArrayBuffer(1)),
     pool.decode('yft',new ArrayBuffer(1)),
   ]);
   assert.deepEqual([a.kind,b.kind,c.kind],['ydd','ydr','yft']);
   assert.equal(created.length,2);
   pool.close();
   await assert.rejects(pool.decode('ydd',new ArrayBuffer(1)),/ditutup/);
 } finally {
   if(originalWorker===undefined)delete globalThis.Worker;
   else globalThis.Worker=originalWorker;
   if(originalDocument===undefined)delete globalThis.document;
   else globalThis.document=originalDocument;
 }
});
test('prefetch prepares source YDD and first paired YTD concurrently',async()=>{
 const file={id:'head',name:'head_000_u.ydd',textures:[{id:'tex'}]};
 const reads=[];
 const api={async read(id){reads.push(id);return {name:id,data:new Uint8Array([4,3,2,1])};}};
 const decode=async(kind)=>kind==='ytd'?{textures:[{name:'skin'}]}:{lods:[]};
 const prepared=await prepareThumbnailModel(file,api,decode);
 assert.deepEqual(reads,['head','tex']);
 assert.deepEqual(prepared.drawables,{lods:[]});
 assert.equal(prepared.textures.get('tex')[0].name,'skin');
 assert.equal(prepared.data.name,'head');
});
test('one WebGL renderer is reused for snapshots; interactive preview remains independent',()=>{
 assert.match(preview,/let thumbnailRenderer = null/);
 assert.match(preview,/const renderer = snapshot \? snapshotRenderer\(\) : new THREE\.WebGLRenderer/);
 assert.match(preview,/renderer\.renderLists\.dispose\(\)/);
 assert.match(preview,/if \(!snapshot\) controls\.addEventListener/);
 assert.match(preview,/observer = snapshot \? null : new ResizeObserver/);
});
test('File Manager overlaps CPU predecode with snapshot painting and bounds lookahead',()=>{
 assert.match(ui,/createThumbnailDecoderPool\(2\)/);
 assert.match(ui,/while \(preparing < 2\)/);
 assert.match(ui,/prepareThumbnailModel\(next\.file, api\(\), thumbnailDecoder\.decode\)/);
 assert.match(ui,/blob = await renderThumbnailBlob\(file, prepared\)/);
});
