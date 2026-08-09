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
    } catch { Start-Sleep -Milliseconds 100 }
  }
  if (-not $ready) { throw 'Local static HTTP server did not start.' }
  & "$runtime\node\bin\node.exe" "$runtime\node\node_modules\playwright\cli.js" test tests/phase1.spec.js --reporter=list
  $phase1ExitCode = $LASTEXITCODE
  & "$runtime\node\bin\node.exe" "$runtime\node\node_modules\playwright\cli.js" test tests/phase2-fs.spec.js --grep 'DB-|SAVE-' --reporter=list
  $phase2DbExitCode = $LASTEXITCODE
  & "$runtime\node\bin\node.exe" "$runtime\node\node_modules\playwright\cli.js" test tests/phase2-fs.spec.js --grep 'MOVE-' --reporter=list
  $phase2MoveExitCode = $LASTEXITCODE
  & "$runtime\node\bin\node.exe" "$runtime\node\node_modules\playwright\cli.js" test tests/phase2-fs.spec.js --grep-invert 'DB-|SAVE-|MOVE-' --reporter=list
  $phase2FailureExitCode = $LASTEXITCODE
  & "$runtime\node\bin\node.exe" "$runtime\node\node_modules\playwright\cli.js" test tests/phase3a2-input-search-reg.spec.js --reporter=list
  $phase3A2ExitCode = $LASTEXITCODE
  & "$runtime\node\bin\node.exe" "$runtime\node\node_modules\playwright\cli.js" test tests/phase3b.spec.js --reporter=list
  $phase3BExitCode = $LASTEXITCODE
  & "$runtime\node\bin\node.exe" "$runtime\node\node_modules\playwright\cli.js" test tests/v157-ux.spec.js --reporter=list
  $v157UxExitCode = $LASTEXITCODE
  $codes = @($phase1ExitCode,$phase2DbExitCode,$phase2MoveExitCode,$phase2FailureExitCode,$phase3A2ExitCode,$phase3BExitCode,$v157UxExitCode)
  $testExitCode = if (($codes | Where-Object { $_ -ne 0 }).Count) { 1 } else { 0 }
} finally {
  if ($server -and -not $server.HasExited) { Stop-Process -Id $server.Id -Force }
}
exit $testExitCode
