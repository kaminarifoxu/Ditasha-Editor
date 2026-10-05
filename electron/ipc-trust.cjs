'use strict';
const path = require('node:path');
function fileLocation(url, platform = process.platform) {
  try {
    const u = new URL(url);
    if (u.protocol !== 'file:' || !['', 'localhost'].includes(u.hostname) || u.search) return null;
    let pathname = decodeURIComponent(u.pathname);
    // Chromium and Node can serialize Windows drive letters and escapes differently.
    if (platform === 'win32') {
      pathname = pathname.replace(/^\/([a-z]:\/)/i, '$1').replace(/\//g, '\\');
      return path.win32.normalize(pathname).toLowerCase();
    }
    return path.posix.normalize(pathname);
  } catch {
    return null;
  }
}
function isTrustedUpdateEvent(event, window, expectedFile, platform = process.platform) {
  if (!window || window.isDestroyed() || event.sender !== window.webContents) return false;
  const frame = event.senderFrame,
    main = window.webContents.mainFrame;
  if (!frame || !main || frame.isDestroyed?.()) return false;
  if (
    frame !== main &&
    !(
      Number.isInteger(frame.processId) &&
      Number.isInteger(frame.routingId) &&
      frame.processId === main.processId &&
      frame.routingId === main.routingId
    )
  )
    return false;
  const expected =
    platform === 'win32'
      ? path.win32.normalize(expectedFile).toLowerCase()
      : path.posix.normalize(expectedFile);
  return fileLocation(frame.url, platform) === expected;
}
module.exports = { fileLocation, isTrustedUpdateEvent };
