$ErrorActionPreference = 'Stop'
$runtime = 'C:\Users\macke\.cache\codex-runtimes\codex-primary-runtime\dependencies'
$env:PATH = "$runtime\node\bin;$runtime\bin\fallback;$env:PATH"
$env:NODE_PATH = "$runtime\node\node_modules"
$server = Start-Process -FilePath "$runtime\node\bin\node.exe" -ArgumentList 'scripts/static-server.cjs' -WorkingDirectory (Get-Location) -PassThru -WindowStyle Hidden
try {
  $ready = $false
  for ($i = 0; $i -lt 30; $i++) {
    try {
      Invoke-WebRequest 'http://127.0.0.1:4173/asana_style_task_manager_v156.html' -UseBasicParsing | Out-Null
      $ready = $true
      break
    } catch {
      Start-Sleep -Milliseconds 100
    }
  }
  if (-not $ready) { throw 'Local static HTTP server did not start.' }
  & "$runtime\node\bin\node.exe" "$runtime\node\node_modules\playwright\cli.js" test tests/phase1.spec.js
  $testExitCode = $LASTEXITCODE
} finally {
  if ($server -and -not $server.HasExited) { Stop-Process -Id $server.Id -Force }
}
exit $testExitCode
