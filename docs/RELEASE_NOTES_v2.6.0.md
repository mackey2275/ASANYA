# ASANYA v2.6.0 Release Notes

- Product Version: v2.6.0
- Schema Version: 2.5
- Release date: 2026-09-01

## Highlights

- **PBL-017 Follow-up:** ToDo・Project・Ganttの優先度列を56px、タイトル列を424pxへ統一し、表示名を「優先度」にしました。永続化fieldは引き続き `impact_level` です。
- **PBL-023:** 作業Statusの「完了」と管理上の「終了」を分離しました。`state` はStatus、`completed` は管理終了状態を表します。
- **PBL-023 Atomicity Follow-up:** 繰返しタスクの終了検証をActual変更前に実施し、期限不足や不正な階層rollover時の操作を完全なno-opにしました。
- **PBL-024:** Project概要モーダルに安全な表示専用の階層pathを追加しました。
- **PBL-025:** 終了済みProject行の概要を淡色表示し、概要には取消線を付けない表示へ改善しました。
- **PBL-026:** Enter・Insert・「＋子」の新規draftタイトル位置を、実際に作成される階層深度へ揃えました。

## Validation

- Human QA: ALL OK
- Focused: 90 PASS / 0 FAIL / 0 SKIP
- Relevant regression: 275 PASS / 0 FAIL / 0 SKIP
- Full regression: 611 PASS / 0 FAIL / 0 SKIP
- Intentional exclusions: 0
- Formal artifact representative verification: 37 PASS / 0 FAIL / 0 SKIP

## Compatibility

- Schema change: none
- Persistence shape change: none
- Migration: none
- Known Issues: none
