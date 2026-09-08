# Build a shareable debug APK (no phone required).
# Output: apps/flutter_recensement/build/app/outputs/flutter-apk/app-debug.apk

param(
  [string]$ApiHost = "192.168.100.84"
)

$ErrorActionPreference = "Stop"
$env:Path = "C:\flutter\bin;$env:LOCALAPPDATA\Android\Sdk\platform-tools;" +
  [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" +
  [System.Environment]::GetEnvironmentVariable("Path", "User")
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:ANDROID_SDK_ROOT = $env:ANDROID_HOME

$ApiBase = "http://${ApiHost}:8000/api/v1"
Set-Location (Join-Path $PSScriptRoot "..\apps\flutter_recensement")
flutter pub get
flutter build apk --debug --dart-define="API_BASE_URL=$ApiBase"
Write-Host "APK: $(Resolve-Path .\build\app\outputs\flutter-apk\app-debug.apk)"
