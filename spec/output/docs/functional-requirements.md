# 機能要件: Code Apps テスト管理

## 優先度

| 優先度 | 要件 |
|---|---|
| Must | テストケースの作成・編集・有効／無効管理。ケースキー・ケース名・領域による検索 |
| Must | ケースに関連付く実行記録。ビルド／環境、Not Run / Passed / Failed / Blocked、実行日時、実際の結果、メモを記録 |
| Must | 不具合を実行およびケースに関連付け、重大度と状態を管理 |
| Must | ケース数、実行数・成功率・失敗数・ブロック数、未解決不具合を集計表示 |
| Must | 読み込み中・空・権限エラー・保存失敗を区別して表示 |
| Should | 独立した領域・優先度・ビルド・結果フィルター |
| Could | 失敗ログの要約や追加テスト観点の AI 提案（別途ライセンス・費用確認後） |
| Won't (初期版) | 自動リリース判定、外部 AI へのログ送信、ユーザー共有、ロール変更、本番データ移行 |

## データモデル案

`mskk` publisher prefix の専用 Solution に作成済み。英語のスキーマ名を用い、Dataverse の primary name とシステム所有者列を再利用する。

| テーブル | 主な列 | 関係 |
|---|---|---|
| Test Case | Name、Case Key、Area、Priority、Preconditions、Steps、Expected Result、Is Active | 1:N Test Execution。Defect からも参照 |
| Test Execution | Name、Build、Environment、Status、Executed On、Actual Result、Notes | N:1 Test Case、1:N Defect |
| Defect | Name、Severity、Status、Description | N:1 Test Execution、N:1 Test Case |

実装済み Choice 値は Priority = 1 Low / 2 Medium / 3 High、Execution Status = 1 Not Run / 2 Passed / 3 Failed / 4 Blocked、Defect Severity = 1 Low / 2 Medium / 3 High / 4 Critical、Defect Status = 1 New / 2 In Progress / 3 Resolved / 4 Closed。実行日には業務日時列を使い、`createdon` を代用しない。

## 画面・操作

- Dashboard: ケース総数、全実行件数、成功率、失敗数、ブロック数、未解決不具合数、最近の実行。
- Test Cases: 一覧、ケースキー・ケース名・領域での検索、登録、編集、有効／無効切り替え、確認付き削除。
- Executions: ケースを選んでビルド・環境・結果・実際の結果を記録。
- Defects: 実行に紐づく不具合の登録・状態更新。
- 一覧やフォームで保存できない場合、成功扱いにせずエラー内容と再試行方法を表示する。

## 権限と非機能

- 初期版は対象 Developer 環境における現在の Dataverse 権限を使う。権限を広げる変更や共有は行わない。
- ロール変更は行わず、アプリの公開範囲を追加しない。
- 入力値は Dataverse 型・長さに合わせて検証する。破壊的な削除は確認を要求する。
- UI はキーボード操作、ラベル、フォーカス可視化、狭い画面での横スクロール制御を備える。
- Dataverse 接続が失敗した場合、ダミー成功値へ切り替えず明示的なエラーを表示する。
