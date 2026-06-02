$ErrorActionPreference = "Stop"

$portText = if ($env:JUSTIO_SYNC_PORT) { $env:JUSTIO_SYNC_PORT } else { "4477" }
$port = [int]$portText
$repoRoot = Split-Path -Parent $PSScriptRoot
$logDir = Join-Path $env:USERPROFILE ".justio-sync\logs"
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$stdout = Join-Path $logDir "sync-local-$timestamp.out.log"
$stderr = Join-Path $logDir "sync-local-$timestamp.err.log"

New-Item -ItemType Directory -Path $logDir -Force | Out-Null

$listener = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
if ($listener) {
  Write-Host "Justio Sync Local ja esta rodando na porta $port."
  exit 0
}

$npm = Get-Command npm.cmd -ErrorAction SilentlyContinue
if (-not $npm) {
  $npm = Get-Command npm -ErrorAction Stop
}

Start-Process `
  -FilePath $npm.Source `
  -ArgumentList @("run", "sync:local") `
  -WorkingDirectory $repoRoot `
  -WindowStyle Hidden `
  -RedirectStandardOutput $stdout `
  -RedirectStandardError $stderr

Write-Host "Justio Sync Local iniciado em segundo plano. Logs: $logDir"
