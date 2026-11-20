$ErrorActionPreference = 'Stop'
$ScriptPath = Join-Path $PSScriptRoot 'run-tests.py'

if (Get-Command python -ErrorAction SilentlyContinue) {
  & python $ScriptPath @args
  exit $LASTEXITCODE
}
if (Get-Command py -ErrorAction SilentlyContinue) {
  & py -3 $ScriptPath @args
  exit $LASTEXITCODE
}

Write-Error 'Python 3 is required to run scripts/run-tests.py.'
exit 1
