$ErrorActionPreference = "Stop"

$taskNames = @(
  "Justio Sync Local",
  "Justio Sync Local Logon",
  "Justio Sync Local Daily"
)

foreach ($taskName in $taskNames) {
  $task = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
  if (-not $task) {
    continue
  }

  Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
  Write-Host "Tarefa '$taskName' removida."
}
