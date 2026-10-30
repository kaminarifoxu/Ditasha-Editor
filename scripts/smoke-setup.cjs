'use strict';
const fs = require('node:fs/promises'),
  path = require('node:path'),
  os = require('node:os');
const { spawn } = require('node:child_process');
const { fileHash } = require('../electron/differential-update.cjs');
async function run(exe, args, env = process.env) {
  await new Promise((resolve, reject) => {
    const child = spawn(exe, args, { env, windowsHide: true, stdio: 'inherit' });
    const timer = setTimeout(() => {
      child.kill();
      reject(Error('Installer/probe timed out'));
    }, 180000);
    child.once('error', (e) => {
      clearTimeout(timer);
      reject(e);
    });
    child.once('exit', (code) => {
      clearTimeout(timer);
      code === 0 ? resolve() : reject(Error('Installer/probe exit ' + code));
    });
  });
}
(async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ditasha-setup-'));
  const destination = path.join(root, 'Editor with spaces');
  const setup = path.resolve('release/DITASHA-Setup.exe');
  const executable = path.join(destination, 'DITASHA-Editor.exe');
  const profile = path.join(process.env.APPDATA, 'GANOMABI Asset Studio');
  await fs.mkdir(profile, { recursive: true });
  const marker = path.join(profile, 'installer-ci-preset.json');
  await fs.writeFile(marker, JSON.stringify({ preset: 'keep-scene-and-settings' }));
  for (let iteration = 0; iteration < 2; iteration++) {
    await run(setup, ['/S', '/D=' + destination]);
    await fs.access(executable);
    const cachedInstaller = path.join(
      process.env.LOCALAPPDATA,
      'ganomabi-asset-studio-updater',
      'installer.exe',
    );
    if ((await fileHash(cachedInstaller)) !== (await fileHash(setup)))
      throw Error('NSIS did not retain the matching installer for differential updates');
    await fs.rm(path.join(root, 'installed-ready.json'), { force: true });
    await run(executable, [], { ...process.env, DITASHA_SETUP_SMOKE_ROOT: root });
    const result = JSON.parse(await fs.readFile(path.join(root, 'installed-ready.json'), 'utf8'));
    if (
      !result.ready ||
      result.version !== require('../package.json').version ||
      path.resolve(result.executable).toLowerCase() !== path.resolve(executable).toLowerCase()
    )
      throw Error('Wrong installed workspace');
    if (!JSON.parse(await fs.readFile(marker, 'utf8')).preset)
      throw Error('Installer removed user data');
  }
  const report = {
    installer: true,
    installPathWithSpaces: true,
    installedWorkspace: true,
    reinstall: true,
    userDataPreserved: true,
    differentialInstallerCache: true,
  };
  await fs.mkdir('release/qa', { recursive: true });
  await fs.writeFile('release/qa/installer-result.json', JSON.stringify(report));
  console.log('PASS installer: ' + JSON.stringify(report));
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
