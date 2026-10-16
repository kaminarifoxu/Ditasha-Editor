'use strict';
const path = require('node:path');
const specs = require('../config/craft-engines.json');
function enginePath(root, raw) {
  const url = new URL(raw);
  if (url.protocol !== 'ditasha-craft:' || !specs.some((s) => s.id === url.hostname))
    throw Error('Unknown engine');
  const relative = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html';
  if (
    relative.includes('\\') ||
    relative.includes('\0') ||
    relative.split('/').some((p) => p === '..' || p.includes(':'))
  )
    throw Error('Invalid engine path');
  const base = path.resolve(root, url.hostname),
    file = path.resolve(base, relative);
  if (!file.startsWith(base + path.sep)) throw Error('Invalid engine path');
  return { file, id: url.hostname, base };
}
module.exports = { enginePath };
