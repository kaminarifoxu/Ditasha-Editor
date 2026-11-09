'use strict';
const { randomUUID } = require('node:crypto');
const { TYPES } = require('./registry.cjs');
function createJobManager({ concurrency = 1, maxQueued = 16, maxHistory = 128, timeoutMs = 15 * 60 * 1000 } = {}) {
  for (const [key, value, lo, hi] of [['concurrency',concurrency,1,4],['maxQueued',maxQueued,1,256],['maxHistory',maxHistory,1,4096],['timeoutMs',timeoutMs,1,60 * 60 * 1000]]) {
    if (!Number.isSafeInteger(value) || value < lo || value > hi) throw Error('Invalid ' + key);
  }
  const queue = [], jobs = new Map();
  let running = 0, closed = false;
  function snapshot(id) {
    const job = jobs.get(id);
    return job ? Object.freeze({ id: job.id, type: job.type, state: job.state, error: job.error || null }) : null;
  }
  function prune() {
    // Completed history is bounded; queued/running jobs are never pruned.
    const completed = [...jobs.values()].filter(j => j.finishedAt !== null);
    for (const j of completed.slice(0, Math.max(0, completed.length - maxHistory))) jobs.delete(j.id);
  }
  function finish(job) {
    if (job.finishedAt !== null) return;
    job.finishedAt = Date.now();
    job.resolve(snapshot(job.id));
    prune();
  }
  function pump() {
    while (!closed && running < concurrency && queue.length) {
      const job = queue.shift();
      if (job.controller.signal.aborted) { job.state = 'cancelled'; finish(job); continue; }
      running++;
      job.state = 'running';
      const timer = setTimeout(() => {
        job.timedOut = true;
        job.controller.abort();
      }, timeoutMs);
      Promise.resolve().then(() => job.controller.signal.throwIfAborted()).then(() => job.worker({ signal: job.controller.signal, id: job.id }))
        .then(value => {
          if (job.timedOut) { job.state = 'failed'; job.error = 'Creator job timed out'; }
          else if (job.controller.signal.aborted) job.state = 'cancelled';
          else { job.state = 'succeeded'; job.result = value; }
        }, error => {
          job.state = job.timedOut ? 'failed' : job.controller.signal.aborted ? 'cancelled' : 'failed';
          job.error = job.timedOut ? 'Creator job timed out' : String(error?.message || error).slice(0, 2048);
        })
        .finally(() => {
          clearTimeout(timer); running--; finish(job); pump();
        });
    }
  }
  function submit(type, worker) {
    if (!TYPES.includes(type)) throw Error('Unknown creator type');
    if (closed) throw Error('Creator manager closed');
    if (typeof worker !== 'function') throw Error('Worker must be a function');
    if (queue.length >= maxQueued) throw Error('Creator queue full');
    const id = randomUUID(), controller = new AbortController();
    let resolve;
    const completion = new Promise(r => { resolve = r; });
    const job = { id, type, state: 'queued', controller, worker, resolve, completion, error: null, finishedAt: null, timedOut: false };
    jobs.set(id, job); queue.push(job); pump();
    return Object.freeze({ id, completion });
  }
  function cancel(id) {
    const job = jobs.get(id);
    if (!job || job.finishedAt !== null) return false;
    job.controller.abort();
    if (job.state === 'queued') {
      const index = queue.indexOf(job);
      if (index !== -1) queue.splice(index, 1);
      job.state = 'cancelled'; finish(job);
    }
    return true;
  }
  function close() {
    closed = true;
    for (const [id, j] of jobs) if (j.finishedAt === null) cancel(id);
  }
  function result(id) {
    const job = jobs.get(id);
    return job?.state === 'succeeded' ? job.result : null;
  }
  return Object.freeze({ submit, cancel, snapshot, result, close });
}
module.exports = { createJobManager };
