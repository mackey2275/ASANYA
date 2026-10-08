# ASANYA v3.2.1 リリースノート要約

## リリース概要

- Product Version: **v3.2.1**
- Schema Version: **3.2**
- 正式HTML: `asanya_task_manager_v321.html`
- SHA-256: `923C1EDFC1A35EEECB22503F9432FEC4D3E365E1E147829276D83096F2D29FBC`
- Release commit: `421a99218da959368d570fd03faeb7475b86e9ad`
- Tag: `v3.2.1`
- GitHub Pages入口: **v3.2.1へ更新済み**
- Known Issues: **なし**
- Deferred Follow-ups: **なし**

## 主な変更

### PBL-046 — 期限表示に曜日を追加

今日から7日後以降の期限に、日本語1文字の曜日を表示するようになりました。

```text
10/7 水
2027/1/1 金
```

- 昨日・今日・明日の相対表示は従来どおりです。
- 2～6日後の曜日表示や過去日付の表示も変更していません。
- ToDoとProjectで同じ表示ルールを使用します。
- 保存されるDue値、期限編集、並べ替え、Undo／Redoには変更ありません。
- Due列の旧既定幅88pxだけを104pxへ移行し、ユーザーが変更した列幅は維持します。

### PBL-032 — 外部更新通知と安全な再読込

開いているDBファイルが外部で更新されたとき、ページをスクロールしてヘッダーが見えない状態でも確認できる固定通知を表示します。

- 通知から最新状態を直接再読込できます。
- 未保存変更や編集中の項目がある場合は、破棄前に確認します。
- 確認を取り消した場合は、現在の内容と外部更新通知を維持します。
- 外部更新を検知しただけでは自動再読込しません。
- 既存の保存前検査、autosave保護、DB切替、永続化、Undo／Redoを維持します。

今回の対応は、既存のFile System Accessによる外部更新検知を見つけやすくし、安全な再読込入口を追加するものです。共同編集presence、lock、offline queue、backend同期、item単位の競合解決は対象外です。

## 互換性

- Schema Versionは **3.2** のままです。
- Schema migrationの追加はありません。
- persistence形式の変更はありません。
- 過去の正式artifactおよび既存tagは変更していません。

## 検証結果

```text
Human QA:
PBL-046 ALL OK
PBL-032 QA1～QA5 ALL OK

Formal Full regression:
89 files / 911 tests
911 PASS / 0 FAIL / 0 SKIP
Intentional exclusions: 0

Formal artifact representative verification:
6 files / 67 tests
67 PASS / 0 FAIL / 0 SKIP
```

最初の累積Development Fullでは、壁時計とGantt fixtureに依存する既存formal test問題により8件が失敗しました。製品回帰ではないことを確認し、意味のあるassertionを維持したtest／fixture正規化だけを実施しています。製品候補は変更せず、最終Fullは新しいprocessでテスト1から再実行し、911件すべてPASSしました。

正式artifactとValidated RCの差分は、次のrelease identity 3か所だけです。

1. HTML titleのv3.2.1表記
2. `APP_TITLE`のv3.2.1表記
3. 新規Snapshotへ記録する`product_version`のv3.2.1表記

Executable JavaScript、functional CSS、Schema、migration、persistence、autosave、Undo／Redo、event behaviorにfunctional差分はありません。

## 正式リリース情報

```text
Validated RC:
asanya_task_manager_v320_pbl046_pbl032_dev.html
E94F5223754D4120F4992ECA8F59A9A438CB86B6A4A9FC8C4D9ADDD1E1E08082

Formal artifact:
asanya_task_manager_v321.html
923C1EDFC1A35EEECB22503F9432FEC4D3E365E1E147829276D83096F2D29FBC

Release commit:
421a99218da959368d570fd03faeb7475b86e9ad

Tag:
v3.2.1

Pages update commit:
b399b9c0b344b818b974122074930c5dfd506fa8

Backlog closure commit:
ba71d97326709d0316041cd8e4113d8a474c74e6
```

`v3.2.1` tagは正式release commitを指したままで、Pages更新commitやPBL同期commitへ移動していません。

## PBL状態

- PBL-032: **Released in v3.2.1**
- PBL-046: **Released in v3.2.1**
- Known Issues: **なし**
- Deferred Follow-ups: **なし**
