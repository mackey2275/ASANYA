# Phase 1 Playwright自動テスト環境

基準の `asana_style_task_manager_v156.html` は変更せず、ローカルHTTPサーバー経由でEdgeをヘッドレス起動します。

## 実行

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File ./scripts/run-phase1.ps1
```

対象は UI-01～04、UI-08、SAVE-07、DB-07～11、VIEW-01～09、HIER-01～12、DEP-01～13、およびDEP-14の機械判定可能部分です。File System Access APIの本格モック、JSON間移動、Visual回帰は含めません。

失敗時のtrace、スクリーンショット等は `test-results/`、HTMLレポートは `playwright-report/` に出力されます。
