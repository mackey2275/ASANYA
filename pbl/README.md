# ASANYA Product Backlog

このディレクトリはASANYA Product BacklogのGit上の正本です。各PBLの詳細は `items/PBL-XXX.md` を正本とし、このREADMEは検索・一覧用の索引です。

## 運用原則

- PBLはValidated RCになっただけでは `Released` にしません。formal artifact、release commit/tag、authoritative remote push、必要なPages更新、最終検証が完了したrelease closure後に更新します。
- Human QA Follow-up、Deferred Follow-up、Known Issueは元PBLの履歴へ残し、解消後も削除しません。
- 未確定事項は事実として補完せず、`Needs Discussion`、`Hold`、`Backlog` または未確定欄として保持します。
- Product Version、Schema Version、artifact SHA、release commit/tagの正式記録はrelease noteを参照します。
- 状態変更時は個別PBLを先に更新し、その後この索引を同期します。

## Status

| Status | 意味 |
|---|---|
| Backlog | 要求は識別済みだが着手未定 |
| Needs Discussion | 仕様・方式・境界の合意が必要 |
| Hold | 意図的に保留 |
| Released | formal release closure済み |
| Released / Follow-up Resolved | release後または同release内のFollow-up解消履歴あり |
| Hold / 再現待ち | 現象は存在するが安定した再現条件待ち |

## Index

| ID | タイトル | 種別 | 状態 | Priority | Released |
|---|---|---|---|---|---|
| [PBL-001](items/PBL-001.md) | 繰返し × 親子階層 | Feature | Released / Follow-up Resolved | — | v2.1.0（Follow-up修正: v2.1.1） |
| [PBL-002](items/PBL-002.md) | 親子関係の組み替え・移動 | Feature / UX | Released | — | v2.3.0 |
| [PBL-003](items/PBL-003.md) | Project実績順序のFS／FF矛盾表示 | Feature | Backlog | Mid | — |
| [PBL-004](items/PBL-004.md) | Gantt依存線表示 | Feature / UX | Backlog | Mid | — |
| [PBL-005](items/PBL-005.md) | クリティカルパス可視化 | Feature | Backlog | Mid | — |
| [PBL-006](items/PBL-006.md) | タイムラインの日表示／週表示切替 | Feature / UX | Backlog | Mid | — |
| [PBL-007](items/PBL-007.md) | 稼働日・休日・祝日の考慮 | Feature | Hold | Low | — |
| [PBL-008](items/PBL-008.md) | ToDoとProjectのUI統合検討 | UX | Hold | Low | — |
| [PBL-009](items/PBL-009.md) | 外部活用向けData Export | Feature | Backlog | Low | — |
| [PBL-010](items/PBL-010.md) | 自動スケジューリング | Feature | Hold | Low | — |
| [PBL-011](items/PBL-011.md) | タスクへの添付・外部資料参照 | Feature | Hold | Low | — |
| [PBL-012](items/PBL-012.md) | タイトル編集中にポインター移動で編集解除 | Bug | Hold / 再現待ち | — | — |
| [PBL-013](items/PBL-013.md) | DBレベルMarkdown情報パネル | Feature / UX | Released | — | v2.2.0 |
| [PBL-014](items/PBL-014.md) | スマホ画面対応 | UX / Feature | Needs Discussion | Unspecified | — |
| [PBL-015](items/PBL-015.md) | SharePoint / OneDrive上のJSON DB読込 | Feature / Architecture | Needs Discussion | Unspecified | — |
| [PBL-016](items/PBL-016.md) | Task Detail Pane統合・拡張 | Feature / UX | Released | — | v2.4.0 |
| [PBL-017](items/PBL-017.md) | Impact Level 0–3移行 | Feature / UX / Schema | Released / UI Follow-up Resolved | — | v2.5.0（UI Follow-up: v2.6.0） |
| [PBL-018](items/PBL-018.md) | Contextual Help / Help Popover | UX / Feature | Released / Follow-up Resolved | — | v3.0.0 |
| [PBL-019](items/PBL-019.md) | 4表示モードへの整理とショートカット統一 | UX / Navigation | Released | — | v2.7.0 |
| [PBL-020](items/PBL-020.md) | 4表示モード共通 Owner / Priority Filter | Feature / UX | Released / UI Follow-up Resolved | — | v2.7.0 |
| [PBL-021](items/PBL-021.md) | Task追加／階層操作UI整理 | UX | Released | — | v3.0.0 |
| [PBL-022](items/PBL-022.md) | 繰返しタスクのDueと繰返し基準日の分離 | Feature / UX / Schema | Released / Follow-up Resolved | — | v3.0.0 |
| [PBL-023](items/PBL-023.md) | ステータスと終了の分離 | Feature / UX / Logic | Released / Follow-up Resolved | — | v2.6.0 |
| [PBL-024](items/PBL-024.md) | Project概要編集UIへのタスク階層パス表示 | UX | Released | — | v2.6.0 |
| [PBL-025](items/PBL-025.md) | Project終了タスク概要の打ち消し線除去 | UX | Released | — | v2.6.0 |
| [PBL-026](items/PBL-026.md) | タスク追加ドラフトの階層インデント整合 | UX | Released | — | v2.6.0 |
| [PBL-027](items/PBL-027.md) | 終了／再オープン時のビュー離脱・復帰アニメーション | UX / Interaction | Released / Follow-up Resolved | — | v3.0.0 |
| [PBL-028](items/PBL-028.md) | D→Eによる期限編集開始ショートカット | UX / Keyboard | Released | — | v2.7.0 |
| [PBL-029](items/PBL-029.md) | 検索ショートカットの簡略化＋ショートカットガイド同期 | UX / Keyboard | Released | — | v2.7.0 |
| [PBL-030](items/PBL-030.md) | Due変更時のタスク移動と縦スクロールの連続化 | UX / Interaction | Released | — | v3.0.0 |
| [PBL-031](items/PBL-031.md) | Due移動中のviewport同期追従 | UX / Interaction | Hold | Low | — |
| [PBL-032](items/PBL-032.md) | 同時編集競合の検知・上書き防止 | Feature / Architecture | Backlog | Low | — |
| [PBL-033](items/PBL-033.md) | ToDoツリー階層の折りたたみ／展開 | Feature / UX | Released | — | v3.1.0 |
| [PBL-034](items/PBL-034.md) | Projectステータス「メモ」の追加と非アクティブ参照item化 | Feature / UX / Data compatibility | Released | — | v3.1.0 |
| [PBL-035](items/PBL-035.md) | Project新規Task入力をTitle→Dueへ簡略化 | UX | Released | — | v3.1.0 |
| [PBL-036](items/PBL-036.md) | Project階層の折りたたみ／展開 | Feature / UX | Released / Follow-up Resolved | — | v3.1.0 |
| [PBL-037](items/PBL-037.md) | Impact Level 3の★を赤表示 | UX / Visual | Released | — | v3.1.0 |
| [PBL-038](items/PBL-038.md) | Task Detail Paneのドラッグ移動 | UX | Released / Follow-up Resolved | — | v3.1.0（Follow-up: v3.1.1） |
| [PBL-039](items/PBL-039.md) | ToDoでTaskをドラッグ上下移動できない | Bug | Released | — | v3.1.1 |
| [PBL-040](items/PBL-040.md) | 概要編集UIの横ドラッグ移動 | UX | Released | — | v3.1.1 |
| [PBL-041](items/PBL-041.md) | タイトル編集中のIME composition中DeleteでTask終了が発火する | Bug / Hotfix | Released | — | v3.1.1 |
| [PBL-042](items/PBL-042.md) | 2時点スナップショット比較＋Semantic Diff | Feature / Data / UX | Released | — | v3.2.0 |
| [PBL-043](items/PBL-043.md) | フロントエンドCommandとBackend DB操作の分離 | Architecture | Needs Discussion | Unspecified | — |
| [PBL-044](items/PBL-044.md) | Offline Command Queue / Outbox | Architecture / Offline | Needs Discussion | Unspecified | — |
| [PBL-045](items/PBL-045.md) | Backend Command実行とデータ競合通知 | Architecture / Backend | Needs Discussion | Unspecified | — |

## Architecture relationships

```text
PBL-043 Command分離
  -> PBL-044 Offline Queue / Outbox
  -> PBL-045 Backend実行・競合通知
                       <-> PBL-032 同時編集ロック／競合防止
                       <-> PBL-015 Cloud JSON DB
```

## Migration provenance

初回Git移行は、repositoryのformal release notes・Git historyと、ユーザーが提示したv2.1.0～v3.2.0のPBL/release基準記録を照合して作成しました。不明な日付・優先度・受入条件は推測していません。
