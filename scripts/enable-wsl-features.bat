@echo off
net session >nul 2>&1
if %errorLevel% NEQ 0 (
  echo Demande des droits administrateur...
  powershell -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0enable-wsl-features.ps1"
pause
