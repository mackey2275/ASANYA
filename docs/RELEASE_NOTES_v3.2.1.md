# ASANYA v3.2.1 Release Notes

- Product Version: v3.2.1
- Schema Version: 3.2
- Release date: 2026-10-08
- Released PBLs: PBL-046 — Due曜日表示、PBL-032 — 外部更新通知と安全な再読込
- Known Issues: none
- Deferred Follow-ups: none

## PBL-046 — Due曜日表示

- 7日後以降のDue表示へ1文字の曜日を追加しました。
- 年をまたぐ日付では、従来の年付き日付表示に曜日を追加します。
- 今日、明日、2～6日後、および過去日付の既存表示契約は維持します。
- ToDoとProjectは同じ共通期限ラベルを使用し、永続化されるDue値は変更しません。
- Due列の旧既定幅88pxだけを104pxへ移行し、ユーザーが設定したカスタム列幅は維持します。

## PBL-032 — 外部更新通知と安全な再読込

- 開いているDBファイルが外部で更新された場合、viewport固定の通知を表示します。
- 編集中でない安全な状態では、通知から直接再読込できます。
- dirty状態またはeditor操作中は、未保存の編集を破棄する確認を経て再読込します。
- 外部更新を検知しても自動再読込は行わず、ユーザーの操作を保持します。
- 既存の保存前外部更新検査、autosave、DB切替、永続化、およびUndo/Redoの契約は維持します。

## Compatibility

- Schema Versionは3.2のままで、Schema変更、migration追加、永続化形式変更はありません。
- v3.2.0以前の正式artifactと既存tagは変更しません。
- PBL-015およびPBL-043～PBL-045の状態は変更しません。

## Validation

- Human QA: PBL-046 ALL OK、PBL-032 QA1～QA5 ALL OK。
- Development initial Focused: 18 PASS / 0 FAIL / 0 SKIP。
- Development initial Relevant: 171 PASS / 0 FAIL / 0 SKIP。
- Post-normalization Focused: 53 PASS / 0 FAIL / 0 SKIP。
- Post-normalization Relevant: 213 PASS / 0 FAIL / 0 SKIP。
- First cumulative Development Full: 89 files / 911 tests; 903 PASS / 8 FAIL / 0 SKIP in 20.1 minutes。
- 上記8件はwall-clockおよびGantt fixture依存のCategory 3 / Category 4として分類し、意味のあるassertionを維持したtest/fixture正規化のみを行いました。製品候補は変更しておらず、この失敗履歴は最終結果へ合算していません。
- Final Development Full on the frozen RC: 89 files / 911 tests; 911 PASS / 0 FAIL / 0 SKIP in 19.3 minutes。
- Release identity Focused: 5 files / 56 tests; 56 PASS / 0 FAIL / 0 SKIP。
- Release fixture-fix Focused: 2 files / 37 tests; 37 PASS / 0 FAIL / 0 SKIP。
- Release union Relevant: 20 files / 226 tests; 226 PASS / 0 FAIL / 0 SKIP。
- Formal Full regression: 89 files / 911 tests; 911 PASS / 0 FAIL / 0 SKIP in one fresh process from test 1, workers=1。
- Formal Full duration: 18.6 minutes。
- Intentional exclusions: 0。
- Formal artifact representative verification: 6 files / 67 tests; 67 PASS / 0 FAIL / 0 SKIP。
- Representative target: `/asanya_task_manager_v321.html`。
- Representative duration: 1.5 minutes。

## RC-to-formal comparison

The formal artifact differs from the validated RC only in these approved release-identity strings:

1. `<title>ASANYA v3.2.1</title>`
2. `APP_TITLE='ASANYA v3.2.1'`
3. Newly created Snapshot metadata uses `product_version:'3.2.1'`

Executable JavaScript behavior, functional CSS, Schema, migration, persistence, autosave, Undo/Redo, event behavior, and product semantics are unchanged. Because the product state has no functional difference, Human QA was not repeated. A complete formal Full and representative verification were nevertheless run against the formal artifact.

## Artifact

- Formal file: `asanya_task_manager_v321.html`
- Formal SHA-256: `923C1EDFC1A35EEECB22503F9432FEC4D3E365E1E147829276D83096F2D29FBC`
- Validated RC source: `asanya_task_manager_v320_pbl046_pbl032_dev.html`
- Validated RC SHA-256: `E94F5223754D4120F4992ECA8F59A9A438CB86B6A4A9FC8C4D9ADDD1E1E08082`
- Release commit: the commit containing this release record, with message `Release ASANYA v3.2.1`.
- Release tag: annotated tag `v3.2.1`, attached to the release commit.
