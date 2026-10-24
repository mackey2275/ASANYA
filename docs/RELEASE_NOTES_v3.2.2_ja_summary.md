# ASANYA v3.2.2 リリースノート要約

## リリース概要

- Product Version: **v3.2.2**
- Schema Version: **3.2**
- Released PBL: **PBL-047**
- 正式HTML: asanya_task_manager_v322.html
- SHA-256: 60CFA1B3DB7E32C3604A9ECC4B114FF6F5D71DCA1BEE59959FF11956847514DD
- Known Issues: **なし**
- Deferred Follow-ups: **なし**

## 主な変更

### PBL-047 — Semantic Diffの外部AI分析用ファイル出力

Snapshot比較で生成したSemantic Diffを、Microsoft 365 Copilotなどの外部AIへ渡すためのMarkdownファイルとして、1回の操作で保存できるようになりました。

- 既存の比較結果画面に「AI分析用ファイルを保存」を追加
- 合意済みcanonical analysis instructionを全文収録
- ASANYAが生成した完全なSemantic DiffをJSON code blockとして収録
- textareaで編集した表示内容ではなく、authoritativeな生成済みSemantic Diffを使用
- 比較日時から決まるfilesystem-safeなfilenameを使用
- Chrome／Edgeの両方でdownload可能
- Microsoft 365 Copilotへの通常のfile attachment／dragと分析を確認済み
- 既存の比較結果編集・copy操作を維持
- Task、Snapshot、dirty、Undo／Redo、persistenceを変更しない

~~~text
ASANYA
→ 2つのSnapshotを比較
→ AI分析用Markdownファイルを保存
→ Microsoft 365 Copilotへ添付またはdrag
→ 分析を実行
~~~

本リリースはSemantic Diffから外部AI分析へ渡すnarrow workflowです。PBL-009の一般的なData Exportは実装していません。

## 互換性

- Schema Versionは **3.2** のままです。
- Schema migrationの追加はありません。
- persistence形式の変更はありません。
- Snapshot／Semantic Diffの形式と意味は変更していません。
- 過去の正式artifactおよび既存tagは変更しません。

## 検証結果

~~~text
Human QA:
Chrome ALL OK
Edge ALL OK
Microsoft 365 Copilot attachment/analysis OK
Existing comparison UI OK

Development Final Full:
90 files / 917 tests
917 PASS / 0 FAIL / 0 SKIP
Intentional exclusions: 0

Formal Focused:
5 files / 62 tests
62 PASS / 0 FAIL / 0 SKIP

Formal Relevant:
19 files / 220 tests
220 PASS / 0 FAIL / 0 SKIP

Formal artifact representative verification:
4 files / 33 tests
33 PASS / 0 FAIL / 0 SKIP
~~~

最初のDevelopment Fullでは、実行日依存となった既存recurrence fixture 3件とresponsive resize収束待ち1件により4件が失敗しました。製品回帰ではないことを確認し、意味のあるassertionを維持したformal test正規化だけを実施しています。製品候補は変更せず、最終Fullをテスト1から新しいprocessで再実行し、917件すべてPASSしました。

Releaseではproduct logic、formal test、fixture、helper、runnerを変更しておらず、RC→formal差分が非機能のrelease identity 3か所だけであるため、917-test Fullは再実行していません。

## RCと正式artifact

~~~text
Validated RC:
asanya_task_manager_v321_pbl047_dev.html
08AB89C64379E3AC5ECC6EDA5CAD83C84647A622D60B29C496A54386E23AEC1A

Formal artifact:
asanya_task_manager_v322.html
60CFA1B3DB7E32C3604A9ECC4B114FF6F5D71DCA1BEE59959FF11956847514DD
~~~

差分は次のrelease identity 3か所だけです。

1. HTML titleのv3.2.2表記
2. APP_TITLEのv3.2.2表記
3. 新規Snapshotへ記録するproduct_versionのv3.2.2表記

Executable JavaScript behavior、functional CSS、Schema、migration、persistence、autosave、Semantic Diff、PBL-047 file生成、canonical instructionにfunctional差分はありません。

## Git Release

- Release commit: `21cdfc27fb6d35de378546a4461b4f977d7f6278`
- Release tag: `v3.2.2`
- Pages commit: `af199ec3416e1f900483c2119db418c9a6caf36e`
- Backlog closure commit: `f63ee8539d29b200395b2ca6ddf1ee3ca4eaff14`
- Release status: **Released**

`v3.2.2` tagは正式release commitを指したままで、Pages、backlog、documentation follow-up commitへ移動していません。
