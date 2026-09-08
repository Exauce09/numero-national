# Start NIC API against local PostgreSQL (no Docker).
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

$env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" +
  [System.Environment]::GetEnvironmentVariable("Path", "User")

$pgBins = @(
  "C:\Program Files\PostgreSQL\16\bin",
  "C:\Program Files\PostgreSQL\18\bin"
)
foreach ($b in $pgBins) {
  if (Test-Path $b) { $env:Path = "$b;$env:Path" }
}

if (-not (Test-Path ".venv\Scripts\uvicorn.exe")) {
  Write-Error "Missing .venv — run: py -3 -m venv .venv && .\.venv\Scripts\pip install -e `".[dev]`""
}

# Free port 8000 if needed
Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue |
  ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }

Write-Host "Starting uvicorn on http://127.0.0.1:8000 ..."
& .\.venv\Scripts\uvicorn.exe apps.api.main:app --host 127.0.0.1 --port 8000
