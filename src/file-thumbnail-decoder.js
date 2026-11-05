import { performResourceJob, reviveResource } from './resource-jobs.js';

// Dedicated worker pool for File Manager *thumbnail* decoding. The main
// editor's resource queue is unchanged; decoding cannot block interactive
// 3D previews behind hundreds of grid thumbnails.
export function createThumbnailDecoderPool(size = 2) {
  const capacity = Math.max(1, Math.min(3, Number(size) || 2));
  const slots = Array.from({length:capacity},()=>({ worker:null, busy:false }));
  const pending = [];
  let serial = 0;
  let closed = false;
  function kick() {
    if (closed) return;
    for (const slot of slots) {
      if (slot.busy || !pending.length) continue;
      const job = pending.shift();
      slot.busy = true;
      if (typeof Worker === 'undefined') {
        Promise.resolve().then(()=>performResourceJob(job.kind,job.buffer,job.options))
          .then(job.resolve,job.reject).finally(()=>{slot.busy=false;kick();});
        continue;
      }
      let timer;
      try {
        slot.worker ||= new Worker(new URL('resource-worker.js', document.baseURI));
        const instance=slot.worker, id=++serial;
        const complete=(error,data)=>{
          clearTimeout(timer);
          instance.onmessage=null;
          instance.onerror=null;
          slot.busy=false;
          if(error) job.reject(error);
          else job.resolve(reviveResource(job.kind,data));
          kick();
        };
        const fail=(message)=>{
          slot.worker?.terminate();
          slot.worker=null;
          complete(Error(message));
        };
        instance.onmessage=({data})=>{
          if(data.id!==id)return;
          if(data.error)complete(Error(data.error));
          else complete(null,data.data);
        };
        instance.onerror=(event)=>{
          event.preventDefault?.();
          fail('Thumbnail worker gagal: '+(event.message||'unknown'));
        };
        timer=setTimeout(()=>fail('Thumbnail decode timeout (45 seconds).'),45000);
        instance.postMessage({id,kind:job.kind,buffer:job.buffer,options:job.options},[job.buffer]);
      } catch(error) {
        clearTimeout(timer);
        slot.worker?.terminate();
        slot.worker=null;
        slot.busy=false;
        job.reject(error);
      }
    }
  }
  return {
    decode(kind,buffer,options={}) {
      if(closed)return Promise.reject(Error('Thumbnail decoder sudah ditutup.'));
      return new Promise((resolve,reject)=>{
        pending.push({kind,buffer,options,resolve,reject});
        kick();
      });
    },
    close() {
      closed=true;
      for(const job of pending.splice(0))job.reject(Error('Thumbnail decoder ditutup.'));
      for(const slot of slots){slot.worker?.terminate();slot.worker=null;}
    },
  };
}
