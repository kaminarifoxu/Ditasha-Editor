@echo off
powershell.exe -NoLogo -NoProfile -STA -ExecutionPolicy Bypass -File "%~dp0Run-Rig-Diagnostic.ps1" -Model "%~1"
pause
