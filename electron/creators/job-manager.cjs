'use strict';
const { randomUUID } = require('node:crypto');
const { validateType } = (() => {
  const { TYPES } = require('./registry.cjs');
  return { validateType: type => { if (!TYPES.includes(type)) throw Error('Unknown creator type'); } };
})();
function createJobManager({ concurrency = 1, maxQueued = 16 } = {}) {
  if (!Number.isSafeInteger(concurrency) || concurrency < 1 || concurrency > 4) throw Error('Invalid concurrency');
  if (!Number.isSafeInteger(maxQueued) || maxQueued < 1 || maxQueued > 256) throw Error('Invalid queue limit');
  const queue = [], jobs = new Map();
  let running = 0, closed = false;
  function snapshot(id) {
    const j = jobs.get(id);
    if (!j) return null;
    return Object.freeze({ id: j.id, type: j.type, state: j.state, error: j.error || null });
  }
  function pump() {
    while (!closed && running < concurrency && queue.length) {
      const job = queue.shift();
      if (job.controller.signal.aborted) { job.state = 'cancelled'; job.resolve(snapshot(job.id)); continue; }
      running++;
      job.state = 'running';
      Promise.resolve().then(() => job.worker({ signal: job.controller.signal, id: job.id }))
        .then(value => {
          if (job.controller.signal.aborted) job.state = 'cancelled';
          else { job.state = 'succeeded'; job.result = value; }
        }, error => {
          job.state = job.controller.signal.aborted ? 'cancelled' : 'failed';
          job.error = String(error?.message || error).slice(0, 2048);
        })
        .finally(() => { running--; job.resolve(snapshot(job.id)); pump(); });
    }
  }
  function submit(type, worker) {
    validateType(type);
    if (closed) throw Error('Creator manager closed');
    if (typeof worker !== 'function') throw Error('Worker must be a function');
    if (queue.length >= maxQueued) throw Error('Creator queue full');
    const id = randomUUID(), controller = new AbortController();
    let resolve;
    const completion = new Promise(r => { resolve = r; });
    const job = { id, type, state: 'queued', controller, worker, resolve, completion, error: null };
    jobs.set(id, job); queue.push(job); pump();
    return Object.freeze({ id, completion });
  }
  function cancel(id) {
    const job = jobs.get(id);
    if (!job || ['succeeded', 'failed', 'cancelled'].includes(job.state)) return false;
    job.controller.abort();
    if (job.state === 'queued') {
      queue.splice(queue.indexOf(job), 1);
      job.state = 'cancelled';
      job.resolve(snapshot(id));
    }
    return true;
  }
  function close() {
    closed = true;
    for (const [id, j] of jobs) if (['queued', 'running'].includes(j.state)) cancel(id);
  }
  return Object.freeze({ submit, cancel, snapshot, close });
}
module.exports = { createJobManager };
