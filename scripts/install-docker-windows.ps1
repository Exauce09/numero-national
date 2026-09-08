#Requires -RunAsAdministrator
<#
.SYNOPSIS
  Install WSL2 + Docker Desktop for the NUMERO NATIONAL project.
.NOTES
  Run in an elevated PowerShell (right-click → Run as administrator).
#>
$ErrorActionPreference = "Stop"
$Installer = Join-Path $env:USERPROFILE "Downloads\DockerDesktopInstaller.exe"

Write-Host "==> Enabling WSL / VirtualMachinePlatform..." -ForegroundColor Cyan
wsl --install --no-distribution --web-download
if ($LASTEXITCODE -ne 0) {
  Write-Host "WSL install returned $LASTEXITCODE (may already be partially installed)." -ForegroundColor Yellow
}

if (-not (Test-Path $Installer)) {
  Write-Host "==> Downloading Docker Desktop..." -ForegroundColor Cyan
  Invoke-WebRequest -Uri "https://desktop.docker.com/win/main/amd64/Docker%20Desktop%20Installer.exe" `
    -OutFile $Installer -UseBasicParsing
}

Write-Host "==> Installing Docker Desktop (quiet)..." -ForegroundColor Cyan
& $Installer install --quiet --accept-license --backend=wsl-2
Write-Host "==> Docker installer exit: $LASTEXITCODE" -ForegroundColor Green

$dockerExe = "C:\Program Files\Docker\Docker\Docker Desktop.exe"
if (Test-Path $dockerExe) {
  Write-Host "OK: Docker Desktop installed at $dockerExe" -ForegroundColor Green
  Write-Host "IMPORTANT: Restart Windows, then start Docker Desktop, then run:" -ForegroundColor Yellow
  Write-Host '  cd "$env:USERPROFILE\Documents\NUMERO NATIONAL"'
  Write-Host "  docker compose up --build -d"
  Write-Host "  py -3 scripts\e2e_smoke.py"
} else {
  Write-Host "Docker Desktop.exe not found yet — reboot and open Docker Desktop manually." -ForegroundColor Yellow
}

Read-Host "Press Enter to close"
