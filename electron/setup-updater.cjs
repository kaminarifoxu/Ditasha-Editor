'use strict';
// Launch only the SHA-256-verified Setup selected by the installed updater.
function setupScript({ target, staged, parentPid, logPath, handshakePath = logPath + '.started' }) {
  if (!Number.isSafeInteger(parentPid) || parentPid < 1) throw Error('PID update tidak valid.');
  const q = (s) => "'" + String(s).replace(/'/g, "''") + "'";
  return `$ErrorActionPreference = 'Stop'
$target = ${q(target)}
$staged = ${q(staged)}
$log = ${q(logPath)}
function Report($status, $message) {
 @{status=$status;message=$message;target=$target} | ConvertTo-Json -Compress | Set-Content -LiteralPath $log -Encoding UTF8
}
try {
 'started' | Set-Content -LiteralPath ${q(handshakePath)} -Encoding UTF8
 Report 'installing' 'Menunggu editor ditutup sebelum memasang update…'
 $deadline = (Get-Date).AddSeconds(120)
 while (Get-Process -Id ${parentPid} -ErrorAction SilentlyContinue) {
  if ((Get-Date) -gt $deadline) { throw 'Editor lama belum ditutup.' }
  Start-Sleep -Milliseconds 250
 }
 Get-ChildItem Env: | Where-Object { $_.Name -like 'PORTABLE_*' } | ForEach-Object { Remove-Item ('Env:' + $_.Name) }
 $setup = Start-Process -FilePath $staged -ArgumentList '/S','--force-run' -Wait -PassThru
 if ($setup.ExitCode -ne 0) { throw ('Setup gagal dengan kode ' + $setup.ExitCode) }
 Report 'success' 'Setup selesai. Editor dibuka kembali oleh installer.'
 Remove-Item -LiteralPath $staged -Force -ErrorAction SilentlyContinue
} catch {
 Report 'error' $_.Exception.Message
 if (Test-Path -LiteralPath $target) { Start-Process -FilePath $target -ErrorAction SilentlyContinue }
}`;
}
module.exports = { setupScript };
