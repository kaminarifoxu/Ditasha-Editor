import { performResourceJob, reviveResource } from './resource-jobs.js';
let worker,
  sequence = 0,
  queue = Promise.resolve();
function execute(kind, buffer, options) {
  if (typeof Worker === 'undefined')
    return Promise.resolve(performResourceJob(kind, buffer, options));
  return new Promise((resolve, reject) => {
    try {
      worker ||= new Worker(new URL('resource-worker.js', document.baseURI));
    } catch (e) {
      reject(Error('Worker resource tidak dapat dijalankan: ' + e.message));
      return;
    }
    const id = ++sequence;
    const fail = (message) => {
      clearTimeout(timer);
      worker?.terminate();
      worker = null;
      reject(Error(message));
    };
    const timer = setTimeout(
      () =>
        fail(
          'Pemrosesan resource melebihi ' +
            (kind === 'optimize-ytd' ? '180' : '45') +
            ' detik. Pilih file lebih kecil.',
        ),
      kind === 'optimize-ytd' ? 180000 : 45000,
    );
    worker.onmessage = ({ data }) => {
      if (data.id !== id) return;
      clearTimeout(timer);
      if (data.error) reject(Error(data.error));
      else resolve(reviveResource(kind, data.data));
    };
    worker.onerror = (e) => {
      e.preventDefault();
      fail('Worker resource gagal: ' + e.message);
    };
    worker.postMessage({ id, kind, buffer, options }, [buffer]);
  });
}
export function decodeResource(kind, buffer, options = {}) {
  const job = queue.then(() => execute(kind, buffer, options));
  queue = job.catch(() => {});
  return job;
}
