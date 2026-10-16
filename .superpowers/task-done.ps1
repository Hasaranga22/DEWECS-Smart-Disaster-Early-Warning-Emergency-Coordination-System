param(
  [Parameter(Mandatory = $true)][int]$Task,
  [Parameter(Mandatory = $true)][string]$Base,
  [Parameter(Mandatory = $true, Position = 0, ValueFromRemainingArguments = $true)][string[]]$Command
)
# Windows-side equivalent of executing-plans/task-done: WSL's node is too old
# to run vitest, so the test command runs under Windows PowerShell instead.
$workspace = Join-Path $PSScriptRoot "sdd\uc4-implementation-plan"
$log = Join-Path $workspace "task-$Task-tests.log"
$ledger = Join-Path $workspace "progress.md"
$repo = Split-Path $PSScriptRoot -Parent

Push-Location $repo
try {
  & $Command[0] @($Command | Select-Object -Skip 1) 2>&1 | Out-File -Encoding utf8 $log
  $code = $LASTEXITCODE
} finally {
  Pop-Location
}

Get-Content $log -Tail 5
if ($code -ne 0) {
  Write-Error "task-done: test command exited $code; Task $Task NOT recorded (full output: $log)"
  exit $code
}
if (-not (Test-Path $ledger)) {
  "# SDD ledger - plan: uc4-implementation-plan" | Out-File -Encoding utf8 $ledger
}
$b = (git rev-parse --short=7 $Base).Trim()
$h = (git rev-parse --short=7 HEAD).Trim()
$last = (Get-Content $log | Where-Object { $_.Trim() -ne "" } | Select-Object -Last 1)
$cmd = ($Command -join " ")
$line = "Task ${Task}: complete (commits ${b}..${h}, tests: $cmd -> $last)"
Add-Content -LiteralPath $ledger -Encoding UTF8 -Value $line
Write-Output "ledger: $line"
