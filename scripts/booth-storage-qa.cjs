'use strict';
module.exports = async function checkBoothStorage(win, fixture) {
  const { build } = require('esbuild');
  const compiled = await build({
    entryPoints: ['src/booth-library.js'],
    bundle: true,
    write: false,
    format: 'iife',
    globalName: 'BoothStorageQA',
    platform: 'browser',
    minify: true,
  });
  return win.webContents.executeJavaScript(
    compiled.outputFiles[0].text +
      `\n(async()=>{
    const name='qa-booth-storage-'+crypto.randomUUID();
    const open=(version)=>new Promise((resolve,reject)=>{const r=indexedDB.open(name,version);r.onupgradeneeded=()=>r.result.createObjectStore('scenes',{keyPath:'id'});r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
    const transact=(db,store,mode,fn)=>new Promise((resolve,reject)=>{const tx=db.transaction(store,mode),r=fn(tx.objectStore(store));tx.oncomplete=()=>resolve(r.result);tx.onabort=()=>reject(tx.error);});
    const motion={pose:'rest',clip:'',time:0,speed:1,playing:false};
    const ped=new File([new Uint8Array(${JSON.stringify([...new Uint8Array(fixture)])})],'test.glb');
    const texture=new File([new Uint8Array(2*1024*1024+17).fill(73)],'multi.ytd');
    const scene={version:1,name:'Before',assets:[{file:ped,kind:'ped',oldId:1,ownerIndex:null,offset:[0,0,0],yaw:0,scale:1,motion,hiddenSlots:[]}],textureFiles:[texture],clipFiles:[]};
    let db=await open(1);await transact(db,'scenes','readwrite',s=>s.put({...scene,id:'legacy'}));db.close();
    let failAfter=-1;
    const hasBlob=v=>v instanceof Blob||!!v&&typeof v==='object'&&!(v instanceof ArrayBuffer)&&Object.values(v).some(hasBlob);
    const provider={open(_name,version){const req=indexedDB.open(name,version);return {
      get result(){const real=req.result;return new Proxy(real,{get(target,key){if(key==='transaction')return (store,mode)=>{
        const tx=target.transaction(store,mode),original=tx.objectStore.bind(tx);
        tx.objectStore=(n)=>{const s=original(n),put=s.put.bind(s);s.put=(value)=>{
          if(hasBlob(value))throw Error('Attempted disk-backed Blob persistence');
          if(n==='sourceChunks'&&failAfter===0)throw new DOMException('forced full disk','QuotaExceededError');
          if(n==='sourceChunks'&&failAfter>0)failAfter--;
          return put(value);
        };return s;};return tx;
      };const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;},set(target,key,value){target[key]=value;return true;}});},
      get error(){return req.error;},set onupgradeneeded(fn){req.onupgradeneeded=fn;},set onsuccess(fn){req.onsuccess=fn;},set onerror(fn){req.onerror=fn;},set onblocked(fn){req.onblocked=fn;}
    };}};
    const library=BoothStorageQA.createBoothLibrary(provider);
    if((await library.get('legacy')).assets[0].file.size!==ped.size)throw Error('Legacy preset migration failed');
    const id=await library.save(scene),loaded=await library.get(id);
    const bytes=new Uint8Array(await loaded.textureFiles[0].arrayBuffer());
    if(bytes.length!==texture.size||bytes.some(n=>n!==73)||loaded.assets[0].file.name!=='test.glb')throw Error('Chunked source bytes changed');
    db=await open(2);const stored=await transact(db,'scenes','readonly',s=>s.get(id));
    if(hasBlob(stored)||!stored._binary)throw Error('Stored preset still contains Blob references');
    const chunksBefore=await transact(db,'sourceChunks','readonly',s=>s.count());
    failAfter=1;let failed=false;try{await library.save({...scene,id,name:'Should not replace'});}catch(e){failed=/preset sebelumnya tetap utuh/.test(e.message);}failAfter=-1;
    if(!failed||(await library.get(id)).name!=='Before'||await transact(db,'sourceChunks','readonly',s=>s.count())!==chunksBefore)throw Error('Failed save replaced preset or leaked staged sources');
    const unreadable={name:'gone.glb',size:3,type:'',arrayBuffer:async()=>new ArrayBuffer(3),slice(){return {arrayBuffer:async()=>{throw Error('missing source');}};}};
    failed=false;try{await library.save({...scene,id,assets:[{...scene.assets[0],file:unreadable}]});}catch(e){failed=e.message.includes('gone.glb')&&e.message.includes('Masukkan ulang');}
    if(!failed||(await library.get(id)).name!=='Before')throw Error('Unreadable source damaged previous preset');
    await library.save({...scene,id,name:'After'});
    if((await library.get(id)).name!=='After'||await transact(db,'sourceChunks','readonly',s=>s.count())!==chunksBefore)throw Error('Replacement leaked old chunks');
    await library.remove(id);if((await library.list()).some(r=>r.id===id)||await transact(db,'sourceChunks','readonly',s=>s.count())!==0)throw Error('Preset removal leaked binary chunks');
    db.close();
    return{chunkedPresetStorage:true,noDiskBackedBlobWrites:true,legacyPresetCompatibility:true,failedSaveKeepsPreset:true,unreadableSourceKeepsPreset:true,sourceChunkCleanup:true};
  })()`,
  );
};
