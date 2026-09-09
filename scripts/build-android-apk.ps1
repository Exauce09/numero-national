# Build a release APK for physical devices.
# Output: apps/flutter_recensement/build/app/outputs/flutter-apk/app-release.apk
#
# Usage:
#   .\scripts\build-android-apk.ps1
#   .\scripts\build-android-apk.ps1 -ApiHost 192.168.100.84
#   .\scripts\build-android-apk.ps1 -Install

param(
  [string]$ApiHost = "",
  [switch]$Install,
  [switch]$DebugBuild,
  [switch]$AutoLogin
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
if ($AutoLogin) { Write-Host "AUTO_LOGIN=true" }

$defines = @("--dart-define=API_BASE_URL=$ApiBase")
if ($AutoLogin) { $defines += "--dart-define=AUTO_LOGIN=true" }

$appDir = Join-Path $PSScriptRoot "..\apps\flutter_recensement"
Set-Location $appDir
flutter pub get

if ($DebugBuild) {
  flutter build apk --debug @defines
  $apk = Resolve-Path ".\build\app\outputs\flutter-apk\app-debug.apk"
} else {
  flutter build apk --release @defines
  $apk = Resolve-Path ".\build\app\outputs\flutter-apk\app-release.apk"
}

Write-Host "APK: $apk"

if ($Install) {
  adb start-server | Out-Null
  $devices = adb devices | Select-String "`tdevice$"
  if (-not $devices) {
    Write-Error "Aucun telephone Android detecte."
  }
  # Debug vs release signatures differ — uninstall first if present.
  adb uninstall cd.gov.nic.flutter_recensement 2>$null | Out-Null
  adb install -r "$apk"
  Write-Host "Installed on device."
}
