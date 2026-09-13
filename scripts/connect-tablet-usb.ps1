# Connecte une tablette Android a l'API locale.
# Mode USB (adb reverse) OU Wi-Fi (meme reseau que le PC).
#
# Usage:
#   .\scripts\connect-tablet-usb.ps1
#   .\scripts\connect-tablet-usb.ps1 -PreferWifi
#   .\scripts\connect-tablet-usb.ps1 -InstallUsbApk -ClearAppData

param(
  [string]$Serial = "",
  [switch]$InstallUsbApk,
  [switch]$ClearAppData,
  [switch]$PreferWifi
)

$ErrorActionPreference = "Stop"
$env:Path = "$env:LOCALAPPDATA\Android\Sdk\platform-tools;" + $env:Path

function Get-LanIp {
  $wifi = Get-NetIPAddress -AddressFamily IPv4 |
    Where-Object {
      $_.InterfaceAlias -match 'Wi-?Fi|WLAN' -and
      $_.IPAddress -notlike "127.*" -and
      $_.IPAddress -notlike "169.*" -and
      $_.IPAddress -notlike "10.2.*" -and
      $_.IPAddress -notlike "172.27.*"
    } | Select-Object -First 1
  if ($wifi) { return $wifi.IPAddress }
  return (
    Get-NetIPAddress -AddressFamily IPv4 |
      Where-Object { $_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.*" } |
      Select-Object -First 1
  ).IPAddress
}

function Wait-Device([string]$wantSerial, [int]$seconds = 60) {
  $deadline = (Get-Date).AddSeconds($seconds)
  while ((Get-Date) -lt $deadline) {
    $lines = @(adb devices | Select-String "`tdevice$")
    if ($wantSerial) {
      $hit = $lines | Where-Object { $_.Line -match "^$wantSerial\s+device" }
      if ($hit) { return $wantSerial }
    } elseif ($lines.Count -gt 0) {
      return ($lines[0].ToString() -split "\s+")[0]
    }
    Start-Sleep -Seconds 2
  }
  throw "Aucune tablette USB detectee. Cable data + debogage USB."
}

Write-Host "== Redemarrage ADB =="
adb kill-server | Out-Null
Start-Sleep -Seconds 2
adb start-server | Out-Null
Start-Sleep -Seconds 1

$serial = Wait-Device $Serial
Write-Host "Appareil: $serial"
adb -s $serial wait-for-device | Out-Null

$lanIp = Get-LanIp
Write-Host "IP Wi-Fi PC: $lanIp"

$apiUsb = "http://127.0.0.1:8000/api/v1"
$apiWifi = "http://${lanIp}:8000/api/v1"

if (-not $PreferWifi) {
  Write-Host "== Tunnel USB (sans reverse --list, Morpho fragile) =="
  try {
    adb -s $serial reverse tcp:8000 tcp:8000 | Out-Null
    Write-Host "adb reverse tcp:8000 OK"
  } catch {
    Write-Host "adb reverse echoue — bascule Wi-Fi recommandee."
    $PreferWifi = $true
  }
}

$pkg = "cd.gov.nic.flutter_recensement"
if ($ClearAppData) {
  Write-Host "== Clear data app =="
  adb -s $serial shell pm clear $pkg 2>$null | Out-Null
}

if ($InstallUsbApk) {
  $hostForBuild = if ($PreferWifi) { $lanIp } else { "127.0.0.1" }
  Write-Host "Build/install APK API=$hostForBuild ..."
  & (Join-Path $PSScriptRoot "build-android-apk.ps1") -ApiHost $hostForBuild -DeviceProfile fingerprint -AutoLogin -Install
}

Write-Host ""
Write-Host "========== A FAIRE SUR LA TABLETTE =========="
if ($PreferWifi) {
  Write-Host "1) Meme Wi-Fi que le PC"
  Write-Host "2) Configurer l'adresse API :"
  Write-Host "   $apiWifi"
  Write-Host "3) Si echec: ouvrir le pare-feu Windows (TCP 8000 entrant) en admin :"
  Write-Host '   netsh advfirewall firewall add rule name="NIC API 8000" dir=in action=allow protocol=TCP localport=8000'
} else {
  Write-Host "1) Garder le cable USB branche"
  Write-Host "2) Configurer l'adresse API :"
  Write-Host "   $apiUsb"
  Write-Host "   (ou Wi-Fi: $apiWifi)"
}
Write-Host "Login: agent.recensement@example.gov / CensusAgent123!"
Write-Host "============================================="
