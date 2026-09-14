$ErrorActionPreference = "Continue"
$env:Path = "$env:LOCALAPPDATA\Android\Sdk\platform-tools;" + $env:Path
$pkg = "cd.gov.nic.flutter_recensement"

function Get-UiXml([string]$serial) {
  adb -s $serial shell uiautomator dump /sdcard/ui.xml 2>$null | Out-Null
  $local = Join-Path $env:TEMP "ui-$serial.xml"
  adb -s $serial pull /sdcard/ui.xml $local 2>$null | Out-Null
  if (Test-Path $local) { return Get-Content $local -Raw }
  return ""
}

function Tap-Bounds([string]$serial, [string]$xml, [string]$pattern) {
  $m = [regex]::Match($xml, $pattern)
  if (-not $m.Success) { return $false }
  $x1 = [int]$m.Groups[1].Value; $y1 = [int]$m.Groups[2].Value
  $x2 = [int]$m.Groups[3].Value; $y2 = [int]$m.Groups[4].Value
  $cx = [int](($x1 + $x2) / 2); $cy = [int](($y1 + $y2) / 2)
  Write-Host "  tap $cx,$cy"
  adb -s $serial shell input tap $cx $cy | Out-Null
  return $true
}

function Ensure-LoggedIn([string]$serial) {
  Write-Host "==== $serial ===="
  adb -s $serial reverse tcp:8000 tcp:8000 2>$null | Out-Null
  adb -s $serial shell am force-stop $pkg | Out-Null
  Start-Sleep -Seconds 1
  adb -s $serial shell am start -n "$pkg/.MainActivity" | Out-Null
  Start-Sleep -Seconds 12

  for ($i = 0; $i -lt 4; $i++) {
    $xml = Get-UiXml $serial
    $onHome = $xml -match "Accueil|Zones|Stats|Appareil|Nouvelle fiche|Synchron"
    $onLogin = $xml -match "Se connecter|Identifiant|Mot de passe|URL API"
    Write-Host "  pass=$i onHome=$onHome onLogin=$onLogin"

    if ($onHome) {
      Write-Host "  LOGGED_IN_OK"
      return $true
    }

    if ($onLogin) {
      $tapped = Tap-Bounds $serial $xml 'text="Se connecter"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"'
      if (-not $tapped) {
        $tapped = Tap-Bounds $serial $xml 'content-desc="Se connecter"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"'
      }
      if (-not $tapped) {
        $matches = [regex]::Matches($xml, 'clickable="true"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"')
        if ($matches.Count -gt 0) {
          $last = $matches[$matches.Count - 1]
          $cx = [int]((([int]$last.Groups[1].Value) + ([int]$last.Groups[3].Value)) / 2)
          $cy = [int]((([int]$last.Groups[2].Value) + ([int]$last.Groups[4].Value)) / 2)
          Write-Host "  tap last-clickable $cx,$cy"
          adb -s $serial shell input tap $cx $cy | Out-Null
        }
      }
      Start-Sleep -Seconds 8
      continue
    }

    # Flutter may not expose text — wait for auto-login
    Start-Sleep -Seconds 5
  }

  $xml = Get-UiXml $serial
  $onHome = $xml -match "Accueil|Zones|Stats|Appareil|Nouvelle fiche|Synchron"
  Write-Host "  FINAL onHome=$onHome"
  return [bool]$onHome
}

$okAll = $true
foreach ($serial in @("bd1cda16", "1113955418010132")) {
  $ok = Ensure-LoggedIn $serial
  if (-not $ok) { $okAll = $false }
}

if ($okAll) { Write-Host "ALL_LOGGED_IN" } else { Write-Host "PARTIAL_OR_FAILED"; exit 1 }
