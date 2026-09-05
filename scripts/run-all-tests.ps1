$ErrorActionPreference = 'Stop'
$runtime = 'C:\Users\macke\.cache\codex-runtimes\codex-primary-runtime\dependencies'
$env:PATH = "$runtime\node\bin;$runtime\bin\fallback;$env:PATH"
$env:NODE_PATH = "$runtime\node\node_modules"
$playwrightCli = if (Test-Path 'node_modules\playwright\cli.js') { 'node_modules\playwright\cli.js' } else { "$runtime\node\node_modules\playwright\cli.js" }

if (-not $env:ASANYA_TEST_APP) {
  throw 'ASANYA_TEST_APP must explicitly identify the application artifact under test.'
}

$server = Start-Process -FilePath "$runtime\node\bin\node.exe" -ArgumentList 'scripts/static-server.cjs' -WorkingDirectory (Get-Location) -PassThru -WindowStyle Hidden
try {
  $ready = $false
  for ($i = 0; $i -lt 30; $i++) {
    try {
      Invoke-WebRequest "http://127.0.0.1:4173$env:ASANYA_TEST_APP" -UseBasicParsing | Out-Null
      $ready = $true
      break
    } catch { Start-Sleep -Milliseconds 100 }
  }
  if (-not $ready) { throw 'Local static HTTP server did not start or the explicit ASANYA_TEST_APP target is unavailable.' }

  & "$runtime\node\bin\node.exe" $playwrightCli test --workers=1 --reporter=list
  $testExitCode = $LASTEXITCODE
} finally {
  if ($server -and -not $server.HasExited) { Stop-Process -Id $server.Id -Force }
}
exit $testExitCode
