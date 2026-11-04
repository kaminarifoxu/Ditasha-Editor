'use strict';
const { spawn, execFile } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs/promises');

function terminateTree(child, platform = process.platform) {
  if (!child || !child.pid) return;
  if (platform === 'win32') {
    // Taskkill targets child processes as well; argv is fixed, never a shell string.
    execFile('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true }, () => {
      try { child.kill(); } catch {}
    });
  } else {
    try { process.kill(-child.pid, 'SIGKILL'); } catch {
      try { child.kill('SIGKILL'); } catch {}
    }
  }
}
function runNativeProcess({ executable, args = [], cwd, signal, timeoutMs = 15 * 60 * 1000, maxOutputBytes = 256 * 1024, env } = {}) {
  if (typeof executable !== 'string' || !path.isAbsolute(executable)) throw Error('Expected verified absolute executable path');
  if (!Array.isArray(args) || args.some(a => typeof a !== 'string' || a.length > 8192)) throw Error('Invalid native argv');
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60 * 60 * 1000) throw Error('Invalid native timeout');
  if (!Number.isSafeInteger(maxOutputBytes) || maxOutputBytes < 1024 || maxOutputBytes > 2 * 1024 * 1024) throw Error('Invalid output limit');
  if (signal?.aborted) return Promise.reject(Error('Native build cancelled'));
  return new Promise((resolve, reject) => {
    let child, settled = false, output = '', stopped = false;
    const cleanup = () => { clearTimeout(timer); signal?.removeEventListener('abort', abort); };
    const finish = (error) => {
      if (settled) return;
      settled = true; cleanup();
      error ? reject(error) : resolve({ log: output });
    };
    const abort = () => {
      stopped = true;
      terminateTree(child);
    };
    let timer;
    try {
      child = spawn(executable, args, { cwd, shell: false, windowsHide: true, detached: process.platform !== 'win32', env, stdio: ['ignore', 'pipe', 'pipe'] });
      signal?.addEventListener('abort', abort, { once: true });
      timer = setTimeout(abort, timeoutMs);
      for (const stream of [child.stdout, child.stderr]) {
        stream?.on('data', chunk => {
          const part = chunk.toString('utf8');
          output = (output + part).slice(-maxOutputBytes);
        });
      }
      child.once('error', finish);
      child.once('close', code => {
        const diagnosis = output.trim().slice(-3000);
        finish(stopped || signal?.aborted
          ? Error('Native build cancelled or timed out')
          : code !== 0
            ? Error('Native process exited with code ' + code + (diagnosis ? ': ' + diagnosis : ''))
            : null);
      });
      if (signal?.aborted) abort();
    } catch (error) { finish(error); }
  });
}
// Caller owns the fresh per-job staging directory; never accept a path that
// belongs to the user's original project or the finalized export.
async function cleanupStaging(directory, expectedParent) {
  if (typeof directory !== 'string' || typeof expectedParent !== 'string') throw Error('Missing staging scope');
  const root = await fs.realpath(expectedParent);
  const resolved = path.resolve(directory);
  // Windows temp directories may resolve through junctions/short paths. Canonicalize
  // both parents before comparing rather than comparing a realpath to a raw path.
  const actualParent = await fs.realpath(path.dirname(resolved));
  if (process.platform === 'win32' ? actualParent.toLowerCase() !== root.toLowerCase() : actualParent !== root) throw Error('Unsafe staging cleanup');
  if (!path.basename(resolved).startsWith('ditasha-stage-')) throw Error('Unsafe staging cleanup');
  const stat = await fs.lstat(resolved).catch(e => e.code === 'ENOENT' ? null : Promise.reject(e));
  if (!stat) return;
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw Error('Invalid staging directory');
  await fs.rm(resolved, { recursive: true, force: true });
}
module.exports = { terminateTree, runNativeProcess, cleanupStaging };
