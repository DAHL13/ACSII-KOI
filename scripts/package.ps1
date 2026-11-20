$ErrorActionPreference = 'Stop'
$ScriptPath = Join-Path $PSScriptRoot 'package.py'

if (Get-Command python -ErrorAction SilentlyContinue) {
  & python $ScriptPath @args
  exit $LASTEXITCODE
}
if (Get-Command py -ErrorAction SilentlyContinue) {
  & py -3 $ScriptPath @args
  exit $LASTEXITCODE
}

Write-Error 'Python 3 is required to run scripts/package.py.'
exit 1
