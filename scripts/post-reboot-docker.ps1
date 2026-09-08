$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
Start-Transcript "$env:USERPROFILE\Desktop\docker-post-reboot.log"
wsl --update --web-download
wsl --set-default-version 2
wsl --install -d Ubuntu-24.04 --no-launch --web-download
$dd = "$env:LOCALAPPDATA\Programs\DockerDesktop\Docker Desktop.exe"
if (Test-Path $dd) { Start-Process $dd }
# wait for docker
for ($i=1; $i -le 40; $i++) {
  Start-Sleep 8
  docker ps 2>$null
  if ($LASTEXITCODE -eq 0) { "DOCKER_OK"; break }
}
cd "$env:USERPROFILE\Documents\NUMERO NATIONAL"
docker compose up --build -d
Start-Sleep 25
py -3 scripts\e2e_smoke.py
Stop-Transcript
