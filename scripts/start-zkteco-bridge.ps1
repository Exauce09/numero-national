# Start real ZK9500 EngX bridge (biokey.ocx) - no demo mode.
$ErrorActionPreference = "Stop"
$dir = Join-Path $PSScriptRoot "zkengx"
$exe = Join-Path $dir "ZkEngxBridge.exe"

Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
  Where-Object { $_.CommandLine -match 'zkteco_bridge\.py' } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }

Get-Process ZkEngxBridge -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1

if (-not (Test-Path $exe)) {
  $csc = "C:\Windows\Microsoft.NET\Framework\v4.0.30319\csc.exe"
  if (-not (Test-Path $csc)) { throw "csc.exe x86 not found" }
  Push-Location $dir
  & $csc /nologo /platform:x86 /target:winexe /out:ZkEngxBridge.exe `
    /r:AxZKFPEngXControl.dll /r:ZKFPEngXControl.dll `
    /r:System.Windows.Forms.dll /r:System.Drawing.dll Program.cs
  if ($LASTEXITCODE -ne 0) { throw "compile failed" }
  Pop-Location
}

Start-Process $exe
Start-Sleep -Seconds 3
$h = Invoke-RestMethod "http://127.0.0.1:18765/health"
$h | ConvertTo-Json -Compress
if (-not $h.sdk_loaded) {
  throw "Bridge started but sdk_loaded=false. Plug ZK9500 USB."
}
Write-Host "OK - keep the ZK9500 EngX Bridge window open."
