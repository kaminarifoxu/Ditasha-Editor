'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { createHash } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const integration = path.resolve(__dirname, '../integrations/opencut');
function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (result.status !== 0) throw Error('OpenCut build failed: ' + command + ' ' + args.join(' '));
}
async function prepareOpenCut(spec, root) {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'ditasha-opencut-'));
  try {
    const response = await fetch(spec.url, { signal: AbortSignal.timeout(300000) });
    if (!response.ok) throw Error('OpenCut source HTTP ' + response.status);
    const chunks = [];
    let size = 0;
    for await (const chunk of response.body) {
      size += chunk.length;
      if (size > spec.bytes) throw Error('OpenCut source exceeds pinned size');
      chunks.push(chunk);
    }
    const data = Buffer.concat(chunks);
    if (size !== spec.bytes || createHash('sha256').update(data).digest('hex') !== spec.sha256)
      throw Error('OpenCut source checksum mismatch');
    const archive = path.join(temp, 'source.zip');
    await fs.writeFile(archive, data);
    const listing = spawnSync(
      process.platform === 'win32' ? 'tar' : 'unzip',
      process.platform === 'win32' ? ['-tf', archive] : ['-Z1', archive],
      { encoding: 'utf8', maxBuffer: 16 * 1024 ** 2 },
    );
    if (listing.status !== 0) throw Error('Cannot inspect OpenCut source');
    const entries = listing.stdout.split(/\r?\n/).filter(Boolean);
    if (
      entries.some(
        (p) =>
          p.startsWith('/') ||
          p.includes('\\') ||
          /^[a-z]:/i.test(p) ||
          p.split('/').includes('..'),
      )
    )
      throw Error('Unsafe OpenCut source path');
    run(
      process.platform === 'win32' ? 'tar' : 'unzip',
      process.platform === 'win32' ? ['-xf', archive, '-C', temp] : ['-q', archive, '-d', temp],
      integration,
    );
    const source = path.join(temp, 'opencut-classic-' + spec.commit, 'apps/web');
    await fs.rm(path.join(integration, 'source'), { recursive: true, force: true });
    await fs.mkdir(path.join(integration, 'source'), { recursive: true });
    for (const part of ['src', 'public'])
      await fs.cp(path.join(source, part), path.join(integration, 'source', part), {
        recursive: true,
      });
    run('npm', ['ci', '--no-audit', '--no-fund'], integration);
    run('npm', ['run', 'build'], integration);
    const target = path.join(root, spec.id);
    await fs.copyFile(
      path.join(temp, 'opencut-classic-' + spec.commit, 'LICENSE'),
      path.join(target, 'OPENCUT-LICENSE.txt'),
    );
    await fs.copyFile(
      path.resolve(__dirname, '../assets/licenses/craft/opencut.md'),
      path.join(target, 'DITASHA-NOTICES.md'),
    );
    const notices = [];
    async function licenses(dir) {
      for (const e of await fs.readdir(dir, { withFileTypes: true })) {
        if (e.isSymbolicLink()) continue;
        const file = path.join(dir, e.name);
        if (e.isDirectory()) await licenses(file);
        else if (/^(licen[cs]e|copying|notice)(\.|$)/i.test(e.name))
          notices.push(
            '\n--- ' +
              path.relative(integration, file) +
              ' ---\n' +
              (await fs.readFile(file, 'utf8')),
          );
      }
    }
    await licenses(path.join(integration, 'node_modules'));
    await fs.writeFile(path.join(target, 'THIRD-PARTY-NOTICES.txt'), notices.join('\n'));
    await fs.writeFile(path.join(target, 'DITASHA-ENGINE.json'), JSON.stringify(spec, null, 2));
    console.log('Verified OpenCut Classic ' + spec.commit);
  } finally {
    await fs.rm(temp, { recursive: true, force: true });
  }
}
module.exports = { prepareOpenCut };
