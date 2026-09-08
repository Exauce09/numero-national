#Requires -RunAsAdministrator
$ErrorActionPreference = "Continue"
Write-Host "Enabling Windows features for Docker/WSL2..." -ForegroundColor Cyan

dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart
dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart
dism.exe /online /enable-feature /featurename:HypervisorPlatform /all /norestart

Write-Host ""
Write-Host "Features requested. A REBOOT is required." -ForegroundColor Yellow
Write-Host "After reboot:" -ForegroundColor Yellow
Write-Host "  1. Open Docker Desktop"
Write-Host "  2. Wait until Engine is running (green)"
Write-Host "  3. Tell Cursor 'ok' to run docker compose"
Write-Host ""
$ans = Read-Host "Reboot now? (O/N)"
if ($ans -match '^[OoYy]') {
  shutdown /r /t 30 /c "Redemarrage pour activer WSL2 / Docker"
}
