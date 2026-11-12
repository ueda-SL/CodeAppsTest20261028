# Code Apps テスト管理 - 仕様書

この仕様は業務資料がない状態で、`CodeAppsTest20261028` というワークスペース名と、クイックスタートで選ばれた開発・テスト範囲から作成した仮説ベースの提案です。組織固有の業務規程、利用人数、ライセンス、費用は事実として扱いません。

| 文書 | 内容 |
|---|---|
| [business-requirements.md](business-requirements.md) | 背景、事実と仮説、To-Be 業務フロー |
| [functional-requirements.md](functional-requirements.md) | 機能要件、データモデル、権限・非機能要件 |
| [design-requirements.md](design-requirements.md) | アーキテクチャ、テンプレート選定、AI 方針 |
| [test-requirements.md](test-requirements.md) | 品質・受け入れ・デプロイ後の実動作テスト |

## 開発利用フロー

1. `functional-requirements.md` のデータモデルを既存 Publisher / Solution と照合する。
2. Dataverse に必要なテーブルを作成し、Code Apps のデータソースを接続する。
3. `test-requirements.md` に従い、ローカル品質検証と Developer 環境での実動作確認を行う。
4. Publisher prefix、Solution、環境 URL などの構成値は文書へ転記せず、ローカルの無視対象 `.env` を参照する。
