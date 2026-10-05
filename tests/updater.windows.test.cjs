'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises'),
  path = require('node:path'),
  os = require('node:os');
const { spawn } = require('node:child_process');
const { replacementScript } = require('../electron/updater.cjs');
for (const mode of ['success', 'staging-failure', 'launch-failure', 'ready-failure'])
  test(
    `Windows helper ${mode}`,
    { skip: process.platform !== 'win32', timeout: 30000 },
    async (t) => {
      const fail = mode !== 'success';
      const directory = await fs.mkdtemp(path.join(os.tmpdir(), "Ditasha's update "));
      t.after(() =>
        fs.rm(directory, { recursive: true, force: true, maxRetries: 30, retryDelay: 250 }),
      );
      const target = path.join(directory, 'DITASHA-Editor.exe'),
        staged = path.join(directory, 'new.exe'),
        logPath = path.join(directory, 'install.json'),
        script = path.join(directory, 'install.ps1');
      await fs.writeFile(target, 'MZ-old');
      if (mode !== 'staging-failure') await fs.writeFile(staged, 'MZ-new');
      const parent = spawn(process.execPath, ['-e', 'setTimeout(()=>{},1500)'], {
        stdio: 'ignore',
      });
      let source = replacementScript({
        target,
        staged,
        parentPid: parent.pid,
        logPath,
        restart: mode === 'launch-failure' || mode === 'ready-failure',
        readyPath: mode === 'ready-failure' ? path.join(directory, 'restart-ready.json') : null,
        readyToken: 'test-token',
        readyTimeoutSeconds: 2,
      });
      if (mode === 'launch-failure')
        source = source
          .replace(
            '$launch = Start-Process -FilePath $target -WorkingDirectory (Split-Path -Parent $target) -PassThru -ErrorAction Stop',
            "throw 'simulated launch failure'",
          )
          .replace(
            'try { Start-Process -FilePath $target -WorkingDirectory (Split-Path -Parent $target) -ErrorAction Stop }',
            'try { Write-Output rollback }',
          );
      if (mode === 'ready-failure')
        source = source.replace(
          '$launch = Start-Process -FilePath $target -WorkingDirectory (Split-Path -Parent $target) -PassThru -ErrorAction Stop',
          "$launch = Start-Process -FilePath 'whoami.exe' -PassThru -ErrorAction Stop",
        );
      await fs.writeFile(script, '\ufeff' + source);
      const helper = spawn(
        'powershell.exe',
        ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', script],
        { cwd: directory },
      );
      let output = '';
      helper.stderr.on('data', (b) => (output += b));
      const code = await new Promise((resolve, reject) => {
        helper.on('error', reject);
        helper.on('exit', resolve);
      });
      assert.equal(code, 0, output);
      const report = JSON.parse((await fs.readFile(logPath, 'utf8')).replace(/^\uFEFF/, ''));
      assert.equal(report.status, fail ? 'error' : 'success');
      assert.equal(await fs.readFile(target, 'utf8'), fail ? 'MZ-old' : 'MZ-new');
      await assert.rejects(fs.access(target + '.previous'));
      await assert.rejects(fs.access(target + '.incoming'));
    },
  );

test(
  'Windows production spawn starts helper and confirms handshake',
  { skip: process.platform !== 'win32', timeout: 30000 },
  async (t) => {
    const { startReplacement } = require('../electron/installer.cjs');
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), "Ditasha's spawn "));
    t.after(() =>
      fs.rm(directory, { recursive: true, force: true, maxRetries: 30, retryDelay: 250 }),
    );
    const target = path.join(directory, 'target.exe'),
      staged = path.join(directory, 'staged.exe');
    const executable = path.join(process.env.SystemRoot, 'System32', 'whoami.exe');
    await fs.copyFile(executable, target);
    await fs.copyFile(executable, staged);
    const parent = spawn(process.execPath, ['-e', 'setTimeout(()=>{},1500)'], { stdio: 'ignore' });
    await startReplacement({
      target,
      staged,
      parentPid: parent.pid,
      bootloaderPid: parent.pid,
      directory,
      confirmRestart: false,
    });
    let report;
    for (let i = 0; i < 80; i++) {
      try {
        report = JSON.parse(
          (await fs.readFile(path.join(directory, 'install.json'), 'utf8')).replace(/^\uFEFF/, ''),
        );
      } catch {}
      if (report?.status !== 'installing' && report) break;
      await new Promise((r) => setTimeout(r, 100));
    }
    assert.equal(report?.status, 'success', JSON.stringify(report));
  },
);
