'use strict';
const PROTOCOLS = ['files-stable', 'files-preview', 'files-dev'];
const DOWNLOAD = 'https://files.community/download';

// Files is a native WinUI application, not a web engine. Use its published
// protocol/command parser rather than reparenting its window or running a shell.
// Upstream: Files.App/Program.cs and Utils/CommandLine/CommandLineParser.cs.
function createFilesApp({ app, shell, platform = process.platform }) {
  function state() {
    const protocol =
      platform === 'win32'
        ? PROTOCOLS.find((name) => {
            try {
              return !!app?.getApplicationNameForProtocol(name + ':');
            } catch {
              return false;
            }
          })
        : null;
    return { available: !!protocol, protocol: protocol || null, supported: platform === 'win32' };
  }
  return {
    state,
    async download() {
      await shell.openExternal(DOWNLOAD);
      return state();
    },
    async open(folder) {
      const current = state();
      if (!current.available)
        throw Error('Files belum terpasang. Gunakan tombol Dapatkan Files, lalu coba kembali.');
      if (typeof folder !== 'string' || !folder || /["\x00-\x1f]/.test(folder))
        throw Error('Folder Files tidak valid.');
      const command = current.protocol + '.exe -Directory "' + folder + '"';
      await shell.openExternal(current.protocol + ':?cmd=' + encodeURIComponent(command));
      return { ...current, opened: true };
    },
  };
}
module.exports = { createFilesApp };
