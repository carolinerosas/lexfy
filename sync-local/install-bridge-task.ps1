$ErrorActionPreference = "Stop"

$taskName = "Justio Bridge"
$scriptPath = Join-Path $PSScriptRoot "start-bridge.ps1"

if (-not (Test-Path -LiteralPath $scriptPath)) {
  throw "Script nao encontrado: $scriptPath"
}

# Roda via wscript + run-hidden.vbs para NAO abrir nenhuma janela do PowerShell.
$vbsPath = Join-Path $PSScriptRoot "run-hidden.vbs"
if (-not (Test-Path -LiteralPath $vbsPath)) {
  throw "Lancador escondido nao encontrado: $vbsPath"
}
$action = New-ScheduledTaskAction `
  -Execute "wscript.exe" `
  -Argument "`"$vbsPath`" `"$scriptPath`""

# Roda no logon e repete a cada 15 minutos, indefinidamente.
$trigger = New-ScheduledTaskTrigger -AtLogOn
$repeticao = (New-ScheduledTaskTrigger -Once -At (Get-Date) `
  -RepetitionInterval (New-TimeSpan -Minutes 15) `
  -RepetitionDuration (New-TimeSpan -Days 3650)).Repetition
$trigger.Repetition = $repeticao

$settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -MultipleInstances IgnoreNew `
  -ExecutionTimeLimit (New-TimeSpan -Minutes 30)

try {
  Register-ScheduledTask `
    -TaskName $taskName `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -Description "Envia ao Justio (Triagem/Briefing) os arquivos que o agente do Cowork deixa na outbox." `
    -Force | Out-Null

  Write-Host "Tarefa '$taskName' instalada. Roda no logon e a cada 15 minutos."
} catch {
  Write-Host "Register-ScheduledTask falhou; tentando com schtasks.exe..."
  $taskCommand = "wscript.exe `"$vbsPath`" `"$scriptPath`""
  & schtasks.exe /Create /TN $taskName /TR $taskCommand /SC MINUTE /MO 15 /F | Out-Host
  if ($LASTEXITCODE -ne 0) {
    throw "Nao foi possivel instalar a tarefa do Windows."
  }
  Write-Host "Tarefa '$taskName' instalada via schtasks (a cada 15 minutos)."
}

# Roda uma vez agora pra testar.
& $scriptPath
Write-Host "Primeira execucao disparada. Logs em: $env:USERPROFILE\.justio-sync\logs\bridge.log"
