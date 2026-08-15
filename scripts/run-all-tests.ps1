$ErrorActionPreference = 'Stop'
$runtime = 'C:\Users\macke\.cache\codex-runtimes\codex-primary-runtime\dependencies'
$env:PATH = "$runtime\node\bin;$runtime\bin\fallback;$env:PATH"
$env:NODE_PATH = "$runtime\node\node_modules"
$playwrightCli = if (Test-Path 'node_modules\playwright\cli.js') { 'node_modules\playwright\cli.js' } else { "$runtime\node\node_modules\playwright\cli.js" }
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
  $codes = @()
  & "$runtime\node\bin\node.exe" $playwrightCli test tests/phase1.spec.js --workers=1 --reporter=list
  $codes += $LASTEXITCODE
  & "$runtime\node\bin\node.exe" $playwrightCli test tests/phase2-fs.spec.js --grep 'DB-|SAVE-' --workers=1 --reporter=list
  $codes += $LASTEXITCODE
  & "$runtime\node\bin\node.exe" $playwrightCli test tests/phase2-fs.spec.js --grep 'MOVE-' --workers=1 --reporter=list
  $codes += $LASTEXITCODE
  & "$runtime\node\bin\node.exe" $playwrightCli test tests/phase2-fs.spec.js --grep-invert 'DB-|SAVE-|MOVE-' --workers=1 --reporter=list
  $codes += $LASTEXITCODE
  $testFiles = @(
    'tests/phase3a2-input-search-reg.spec.js','tests/phase3b.spec.js','tests/v157-ux.spec.js','tests/v200-db-lifecycle.spec.js','tests/v200-startup-resume.spec.js',
    'tests/v200-gantt.spec.js','tests/v200-actual.spec.js','tests/v200-actual-phase2.spec.js','tests/v200-ux-phase3.spec.js',
    'tests/v200-sort-child.spec.js','tests/v200-phase-ab.spec.js','tests/v200-selection-status-ux.spec.js',
    'tests/v200-human-ux-fixes.spec.js','tests/v200-sticky-header.spec.js','tests/v200-sort-animation.spec.js','tests/v200-sort-animation-paths.spec.js','tests/v200-undo-sort-animation.spec.js','tests/v200-undo-redo.spec.js',
    'tests/v200-back-to-top-favicon.spec.js','tests/v200-project-unification.spec.js','tests/v200-project-hqa1.spec.js','tests/v200-project-hqa2.spec.js','tests/v200-project-navigation-hqa21.spec.js','tests/v200-project-navigation-hqa22.spec.js','tests/v200-recurrence-hqa23.spec.js','tests/v200-rc-ux-stability.spec.js'
  )
  foreach ($testFile in $testFiles) {
    & "$runtime\node\bin\node.exe" $playwrightCli test $testFile --workers=1 --reporter=list
    $codes += $LASTEXITCODE
  }
  $testExitCode = if (($codes | Where-Object { $_ -ne 0 }).Count) { 1 } else { 0 }
} finally {
  if ($server -and -not $server.HasExited) { Stop-Process -Id $server.Id -Force }
}
exit $testExitCode
