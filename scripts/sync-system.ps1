# Synchronise le stack local NUMERO NATIONAL (API + comptes + campagnes + tunnel USB).
# Usage: .\scripts\sync-system.ps1

$ErrorActionPreference = "Continue"
$env:Path = "$env:LOCALAPPDATA\Android\Sdk\platform-tools;" + $env:Path
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

Write-Host '== 1 Docker API =='
docker compose up -d db redis api 2>$null | Out-Null
$ok = $false
for ($i = 1; $i -le 20; $i++) {
  try {
    $h = Invoke-RestMethod 'http://127.0.0.1:8000/health' -TimeoutSec 3
    if ($h.status -eq 'ok') { $ok = $true; break }
  } catch { Start-Sleep 2 }
}
if (-not $ok) { Write-Host 'API down'; exit 1 }
Write-Host 'API OK'

Write-Host '== 2 Seed comptes =='
$py = Join-Path $Root '.venv\Scripts\python.exe'
if (Test-Path $py) {
  & $py scripts\seed_civil_accounts.py
  & $py scripts\seed_census_agent.py
} else {
  Write-Host 'Pas de .venv — seed via docker'
  docker exec nic_api python scripts/seed_civil_accounts.py 2>$null
  docker exec nic_api python scripts/seed_census_agent.py 2>$null
}

Write-Host '== 3 Campagnes ACTIVE + droits IAM =='
$sqlIam = @'
UPDATE recensement.campaigns SET status = 'ACTIVE' WHERE code IN ('RGPH-2026', 'TEST123');
INSERT INTO identity.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM identity.roles r
CROSS JOIN identity.permissions p
WHERE r.code IN ('OFFICIER_ETAT_CIVIL','CIVIL_OFFICER','RESPONSABLE_BUREAU','ADMIN_PROVINCIAL')
  AND p.code IN (
    'civil:act:validate','civil:act:write','civil:act:read',
    'registry:citizen:read','census:manage','census:sync'
  )
ON CONFLICT DO NOTHING;
'@
$sqlIam | docker exec -i nic_postgres psql -U nic_admin -d nic_core -v ON_ERROR_STOP=1

Write-Host '== 4 Tunnel tablette USB =='
adb start-server 2>$null | Out-Null
$devs = @(adb devices 2>$null | Select-String "`tdevice$")
if ($devs.Count -gt 0) {
  adb reverse tcp:8000 tcp:8000 | Out-Null
  Write-Host 'adb reverse tcp:8000 OK'
} else {
  Write-Host 'Aucune tablette USB. Wi-Fi: http://<IP-PC>:8000/api/v1'
}

Write-Host '== 5 Etat fiches =='
$sqlStats = @'
SELECT c.code, r.status, count(*)
FROM recensement.census_records r
JOIN recensement.campaigns c ON c.id = r.campaign_id
GROUP BY 1, 2 ORDER BY 1, 2;
SELECT count(*) AS citoyens_registre FROM core_registry.citizens;
SELECT status, count(*) FROM core_registry.citizens GROUP BY 1 ORDER BY 1;
'@
$sqlStats | docker exec -i nic_postgres psql -U nic_admin -d nic_core

Write-Host ''
Write-Host 'Sites: http://127.0.0.1:5176 (etat civil) | http://127.0.0.1:5183 (SIGPOP)'
Write-Host 'Fiches SYNCED restantes: SIGPOP Campagnes -> Approuver -> Promouvoir NIC'
