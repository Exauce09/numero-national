# Build / install recensement APK on a plugged Android phone.
# Usage (PowerShell):
#   .\scripts\run-android-device.ps1
#   .\scripts\run-android-device.ps1 -ApiHost 192.168.100.84

param(
  [string]$ApiHost = ""
)

$ErrorActionPreference = "Stop"
$env:Path = "C:\flutter\bin;$env:LOCALAPPDATA\Android\Sdk\platform-tools;" +
  [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" +
  [System.Environment]::GetEnvironmentVariable("Path", "User")
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:ANDROID_SDK_ROOT = $env:ANDROID_HOME

if (-not $ApiHost) {
  $ApiHost = (
    Get-NetIPAddress -AddressFamily IPv4 |
      Where-Object {
        $_.IPAddress -notlike "127.*" -and
        $_.IPAddress -notlike "169.*" -and
        $_.PrefixOrigin -ne "WellKnown"
      } |
      Select-Object -First 1
  ).IPAddress
}

$ApiBase = "http://${ApiHost}:8000/api/v1"
Write-Host "API_BASE_URL=$ApiBase"

adb start-server | Out-Null
$devices = adb devices | Select-String "`tdevice$"
if (-not $devices) {
  Write-Error "Aucun telephone Android detecte. Active le debogage USB et rebranche."
}

Set-Location (Join-Path $PSScriptRoot "..\apps\flutter_recensement")
flutter pub get
flutter run -d android --dart-define="API_BASE_URL=$ApiBase"
