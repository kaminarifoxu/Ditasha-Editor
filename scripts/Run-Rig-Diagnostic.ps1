param([string]$Model = '')
$ErrorActionPreference = 'Stop'
try {
    $ditashaProfile = Join-Path $env:APPDATA 'GANOMABI Asset Studio'
    $settings = Get-Content -Raw -LiteralPath (Join-Path $ditashaProfile 'native-engine.json') | ConvertFrom-Json
    $engine = [string]$settings.engine
    if (!(Test-Path -LiteralPath $engine -PathType Leaf)) { throw 'Engine Blender DITASHA tidak ditemukan. Jalankan setup engine di aplikasi dahulu.' }
    if (!$Model) {
        Add-Type -AssemblyName System.Windows.Forms
        $picker = New-Object System.Windows.Forms.OpenFileDialog
        $picker.Title = 'Pilih model GLB yang gagal diekspor'
        $picker.Filter = 'Model GLB (*.glb)|*.glb'
        if ($picker.ShowDialog() -ne 'OK') { exit 0 }
        $Model = $picker.FileName
    }
    $Model = (Resolve-Path -LiteralPath $Model).Path
    if ([IO.Path]::GetExtension($Model) -ine '.glb') { throw 'Pilih file GLB.' }
    $managed = Join-Path $ditashaProfile 'native-tools'
    if ([string]$settings.managedRoot -eq $managed) {
        $env:BLENDER_USER_CONFIG = Join-Path $managed 'config'
        $env:BLENDER_USER_SCRIPTS = Join-Path $managed 'scripts'
        $env:BLENDER_USER_DATAFILES = Join-Path $managed 'datafiles'
        $env:BLENDER_USER_EXTENSIONS = Join-Path $managed 'extensions'
    }
    $env:PYTHONUNBUFFERED = '1'
    $env:PYTHONIOENCODING = 'utf-8'
    Remove-Item Env:PYTHONHOME,Env:PYTHONPATH,Env:CI -ErrorAction SilentlyContinue
    $suffix = (Get-Date -Format 'yyyyMMdd-HHmmss') + '-' + [Guid]::NewGuid().ToString('N').Substring(0,6)
    $output = Join-Path $env:LOCALAPPDATA ('DITASHA-Rig-Diagnostic\' + $suffix)
    New-Item -ItemType Directory -Force -Path $output | Out-Null
    $spec = Join-Path $output 'job.json'
    @{mode='ped';name='diagnostic_ped';source=$Model;output=$output;pedOptions=@{reference='auto';height=0}} | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $spec -Encoding UTF8
    $script = Join-Path $PSScriptRoot 'rig-diagnostic.py'
    $arguments = '--background --disable-autoexec --python-exit-code 2 --python "' + $script + '" -- "' + $spec + '"'
    Write-Host 'Memproses model dengan engine DITASHA. Tunggu sampai selesai; tidak ada file yang diunggah.'
    Write-Host ('Folder hasil: ' + $output)
    $stdout = Join-Path $output 'stdout.log'
    $stderr = Join-Path $output 'stderr.log'
    $process = Start-Process -FilePath $engine -ArgumentList $arguments -PassThru -Wait -NoNewWindow -RedirectStandardOutput $stdout -RedirectStandardError $stderr
    $parts = @('Blender exit code: ' + $process.ExitCode)
    foreach ($file in @($stdout,$stderr,(Join-Path $output 'progress.json'),(Join-Path $output 'report.json'))) {
        if (Test-Path -LiteralPath $file) { $parts += [IO.Path]::GetFileName($file); $parts += Get-Content -Raw -LiteralPath $file -Encoding UTF8 }
    }
    $log = Join-Path $output 'diagnostic-log.txt'
    [IO.File]::WriteAllText($log, ($parts -join "`r`n`r`n"), ([Text.UTF8Encoding]::new($false)))
    Write-Host ('Selesai. Kirim diagnostic-log.txt: ' + $log)
    if (Test-Path -LiteralPath (Join-Path $output 'ditasha-result.blend')) { Write-Host 'Hasil rig sebelum ekspor tersedia di ditasha-result.blend.' }
    Invoke-Item -LiteralPath $output
} catch {
    Write-Host ('Gagal menjalankan diagnosis: ' + $_.Exception.Message)
    exit 1
}
