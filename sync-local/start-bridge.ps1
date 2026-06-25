$ErrorActionPreference = "Stop"

$logDir = Join-Path $env:USERPROFILE ".justio-sync\logs"
New-Item -ItemType Directory -Path $logDir -Force | Out-Null
$log = Join-Path $logDir "bridge.log"

$node = Get-Command node.exe -ErrorAction SilentlyContinue
if (-not $node) {
  $node = Get-Command node -ErrorAction Stop
}

$script = Join-Path $PSScriptRoot "justio-bridge.js"
if (-not (Test-Path -LiteralPath $script)) {
  throw "Script da ponte nao encontrado: $script"
}

& $node.Source $script *>> $log
