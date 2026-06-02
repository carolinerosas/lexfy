$ErrorActionPreference = "Stop"

$taskName = "Justio Sync Local"
$fallbackLogonTaskName = "Justio Sync Local Logon"
$fallbackDailyTaskName = "Justio Sync Local Daily"
$scriptPath = Join-Path $PSScriptRoot "start-if-needed.ps1"

if (-not (Test-Path -LiteralPath $scriptPath)) {
  throw "Script nao encontrado: $scriptPath"
}

$action = New-ScheduledTaskAction `
  -Execute "powershell.exe" `
  -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$scriptPath`""

$triggers = @(
  (New-ScheduledTaskTrigger -AtLogOn),
  (New-ScheduledTaskTrigger -Daily -At "7:55AM")
)

$settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -MultipleInstances IgnoreNew `
  -ExecutionTimeLimit (New-TimeSpan -Hours 12)

try {
  Register-ScheduledTask `
    -TaskName $taskName `
    -Action $action `
    -Trigger $triggers `
    -Settings $settings `
    -Description "Inicia o agente local do Justio para sincronizar publicacoes e tribunais." `
    -Force | Out-Null

  Write-Host "Tarefa '$taskName' instalada. Ela roda no logon e todos os dias as 7:55."
} catch {
  Write-Host "Register-ScheduledTask falhou; tentando instalar com schtasks.exe..."

  $taskCommand = "powershell.exe -NoProfile -ExecutionPolicy Bypass -File `"$scriptPath`""
  $createdTasks = @()

  & schtasks.exe /Create /TN $fallbackLogonTaskName /TR $taskCommand /SC ONLOGON /F | Out-Host
  if ($LASTEXITCODE -eq 0) {
    $createdTasks += $fallbackLogonTaskName
  } else {
    Write-Host "Tarefa '$fallbackLogonTaskName' nao foi criada pelo Windows."
  }

  & schtasks.exe /Create /TN $fallbackDailyTaskName /TR $taskCommand /SC DAILY /ST 07:55 /F | Out-Host
  if ($LASTEXITCODE -eq 0) {
    $createdTasks += $fallbackDailyTaskName
  } else {
    Write-Host "Tarefa '$fallbackDailyTaskName' nao foi criada pelo Windows."
  }

  if (-not $createdTasks.Length) {
    throw "Nao foi possivel instalar nenhuma tarefa do Windows."
  }

  Write-Host "Tarefas instaladas: $($createdTasks -join ', ')."
}

& $scriptPath
