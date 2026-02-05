# 中央線検出プロンプト自動最適化システム

## 概要

`has_center_line`（教師データ）を使用して、Claude APIによる中央線検出プロンプトを自動的に最適化するシステムです。

## アーキテクチャ

```
┌─────────────────────────────────────────────────────────┐
│                    最適化ループ                          │
│ ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐     │
│ │サンプル  │→│現在の   │→│エラー   │→│プロンプト│    │
│ │抽出     │  │プロンプト│  │分析    │  │候補生成  │    │
│ │         │  │で評価   │  │FP/FN   │  │(3案)    │    │
│ └─────────┘  └─────────┘  └─────────┘  └─────────┘     │
│                                             │          │
│      ┌─────────────────────────────────────┘          │
│      ▼                                                 │
│ ┌─────────┐  ┌─────────┐  ┌─────────┐                 │
│ │候補を   │→│最良を   │→│改善なら │ → 次のイテレーション│
│ │テスト   │  │選択     │  │更新    │                   │
│ └─────────┘  └─────────┘  └─────────┘                 │
└─────────────────────────────────────────────────────────┘
```

## ファイル構成

```
src/optimizer/
├── README.md            # このドキュメント
├── types.ts             # 型定義
├── sampler.ts           # DBから層化サンプリング
├── evaluator.ts         # 精度評価（F1スコア計算、並列バッチ処理）
├── error-analyzer.ts    # FP/FNパターン分析
├── prompt-generator.ts  # Claudeでプロンプト改善案生成
├── geometry-lookup.ts   # target.jsonからジオメトリ検索（都道府県指定対応）
├── history.ts           # 履歴JSON保存
├── index.ts             # メインの最適化ループ（並列候補評価）
└── output/              # 出力ディレクトリ
    ├── optimization_history.json      # 最新の履歴
    ├── optimization_history_*.json    # タイムスタンプ付き履歴
    └── sample_set_*.json              # サンプルセット
```

## 使用方法

### 基本コマンド

```bash
cd claude-infer

# ヘルプ表示
npx ts-node src/optimizer/index.ts --help

# 岐阜県のみで小規模テスト
npx ts-node src/optimizer/index.ts --pref 21 --sample-size 10 --max-iterations 1

# 愛知県で並列実行
npx ts-node src/optimizer/index.ts --pref 23 --parallel 5 --batch-size 15

# 前回の結果から継続して最適化
npx ts-node src/optimizer/index.ts --continue --max-iterations 3

# 本番実行（デフォルト: 50サンプル、5イテレーション、全都道府県）
npx ts-node src/optimizer/index.ts

# npmスクリプトでも実行可能
npm run optimize -- --pref 21 --sample-size 30 --max-iterations 3
```

### コマンドラインオプション

| オプション | デフォルト | 説明 |
|-----------|-----------|------|
| `--pref <code>` | 全都道府県 | 都道府県コード（例: 21=岐阜, 23=愛知） |
| `--sample-size <n>` | 50 | テスト用サンプル数 |
| `--max-iterations <n>` | 5 | 最大繰り返し回数 |
| `--candidates <n>` | 3 | 1回あたりのプロンプト候補数 |
| `--min-improvement <n>` | 0.01 | 最小改善幅（これ以下なら終了）|
| `--parallel <n>` | 3 | 候補プロンプトの同時評価数 |
| `--batch-size <n>` | 10 | サンプル評価のバッチサイズ |
| `--continue` | - | 前回の最終プロンプトから継続して最適化 |
| `--help`, `-h` | - | ヘルプを表示 |

### 都道府県コード一覧（一部）

| コード | 都道府県 |
|--------|----------|
| 21 | 岐阜県 |
| 23 | 愛知県 |
| 24 | 三重県 |

## 処理フロー詳細

### 1. サンプル抽出 (sampler.ts)

- `locations`テーブルから`has_center_line`が設定されたレコードを取得
- `target.json`の`geometry_check_list`に存在する座標のみをフィルタリング
- true/falseを均等に層化サンプリング
- サンプルセットをJSONに保存して再現性確保

### 2. 評価 (evaluator.ts)

- 各サンプルに対して:
  1. `geometry_list`から進行方向（heading）を計算
  2. Street View画像を取得（キャッシュ活用）
  3. Claude APIで中央線を推論
  4. 教師データと比較
- 混同行列からメトリクスを算出:
  - Accuracy（正解率）
  - Precision（適合率）
  - Recall（再現率）
  - F1スコア

### 3. エラー分析 (error-analyzer.ts)

- False Positive（誤検出）とFalse Negative（見逃し）を分類
- エラーケースの画像をClaudeに渡してパターンを分析
- 改善に必要なヒントを抽出

### 4. プロンプト生成 (prompt-generator.ts)

- メタプロンプトを使用して改善案を生成:
  - 現在のメトリクス
  - エラーパターンの傾向
  - 改善の方向性
- 3つの異なるアプローチの候補を生成

### 5. 最良選択・履歴保存 (history.ts)

- 各候補プロンプトをテスト
- F1スコアが最も高い候補を選択
- 改善幅が`minImprovement`以上なら採用
- 全履歴を`output/optimization_history.json`に保存

## 並列処理

処理を高速化するため、2箇所で並列処理を行っています。

### 1. サンプル評価のバッチ処理 (evaluator.ts)

各プロンプトの評価時、サンプルを`--batch-size`件ずつ並列処理します。

```
サンプル50件、batch-size=10 の場合:
├── バッチ1: サンプル1〜10 を並列処理
├── バッチ2: サンプル11〜20 を並列処理
├── バッチ3: サンプル21〜30 を並列処理
├── バッチ4: サンプル31〜40 を並列処理
└── バッチ5: サンプル41〜50 を並列処理
```

### 2. 候補プロンプトの並列評価 (index.ts)

複数の候補プロンプトを`--parallel`個まで同時に評価します。

```
candidates=3、parallel=3 の場合:
候補1、候補2、候補3 を同時に評価（最大3倍速）
```

### 推奨設定

| 状況 | 設定 |
|------|------|
| APIレート制限が緩い | `--parallel 5 --batch-size 15` |
| APIレート制限が厳しい | `--parallel 2 --batch-size 5` |
| デフォルト（バランス） | `--parallel 3 --batch-size 10` |

## 出力ファイル

### optimization_history.json

最適化の全履歴を含むJSONファイル:

```json
{
  "startedAt": "2026-02-04T00:27:06.310Z",
  "completedAt": "2026-02-04T00:29:04.907Z",
  "initialPrompt": "...",
  "finalPrompt": "...",
  "initialF1Score": 0.75,
  "finalF1Score": 0.909,
  "iterations": [...],
  "sampleSet": {...},
  "config": {...}
}
```

### sample_set_*.json

サンプルセットの詳細:

```json
{
  "createdAt": "2026-02-04T00:27:06.310Z",
  "samples": [
    {"lat": 35.334, "lng": 137.026, "hasCenterLine": true},
    ...
  ],
  "trueCount": 5,
  "falseCount": 5
}
```

## コスト見積もり

| 項目 | コスト/イテレーション |
|------|---------------------|
| 現在プロンプト評価 (50件) | ~$0.30 |
| エラー分析 | ~$0.05 |
| プロンプト生成 | ~$0.10 |
| 候補テスト (3案×50件) | ~$0.90 |
| **合計** | **~$1.35** |

5イテレーション実行: ~$6.75 (~¥1,013)

## 都道府県の指定

`--pref`オプションで特定の都道府県のみを対象にできます。

```bash
# 岐阜県のみ
npx ts-node src/optimizer/index.ts --pref 21

# 愛知県のみ
npx ts-node src/optimizer/index.ts --pref 23
```

指定しない場合は、`html/targets/`内の全都道府県が対象になります。

**メリット:**
- テスト時に対象を絞って高速に実行できる
- 地域特性を考慮した最適化が可能

## 継続モード（--continue）

`--continue`オプションを使うと、前回の最終プロンプトから継続して最適化できます。

```bash
# 1回目: 初期プロンプトから最適化
npx ts-node src/optimizer/index.ts --pref 21 --max-iterations 3
# → F1: 80% → 88%

# 2回目: 前回の最終プロンプト(F1=88%)から継続
npx ts-node src/optimizer/index.ts --pref 21 --max-iterations 3 --continue
# → F1: 88% → 92%

# 3回目: さらに継続
npx ts-node src/optimizer/index.ts --pref 21 --max-iterations 3 --continue
# → F1: 92% → 94%
```

**処理フロー:**

```
┌─────────────────────────────────────────────────────────────────┐
│ --continue なし（デフォルト）                                    │
├─────────────────────────────────────────────────────────────────┤
│  getBaseCenterLinePrompt() → ハードコードされた初期プロンプト    │
│           ↓                                                     │
│  最適化ループ                                                    │
│           ↓                                                     │
│  optimization_history.json に finalPrompt を保存                │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ --continue あり                                                  │
├─────────────────────────────────────────────────────────────────┤
│  optimization_history.json から finalPrompt を読み込み          │
│           ↓                                                     │
│  前回の最終プロンプトから最適化を継続                            │
│           ↓                                                     │
│  optimization_history.json に新しい finalPrompt を保存          │
└─────────────────────────────────────────────────────────────────┘
```

**注意:**
- 前回の履歴が見つからない場合は、自動的に初期プロンプトから開始します
- 履歴は`output/optimization_history.json`に保存されます

## 前提条件

- PostgreSQL（speediaデータベース）が起動していること
- `locations`テーブルに`has_center_line`が設定されたレコードがあること
- `html/targets/*/target.json`に`geometry_check_list`を含むエントリがあること
- `.env`に以下が設定されていること:
  - `GOOGLE_MAPS_API_KEY`
  - `ANTHROPIC_API_KEY`

## 最適化結果の適用

最終プロンプトは`output/optimization_history.json`の`finalPrompt`に保存されます。

本番適用する場合は、`src/prompts.ts`の該当プロンプトを更新してください:

```typescript
// prompts.ts
const promptEn = `...最適化後のプロンプト...`;
```

## トラブルシューティング

### サンプルが見つからない

```
エラー: サンプルが不足しています。各クラス最低25件必要です。
```

→ `target.json`に`geometry_check_list`が含まれるエントリが少ない可能性があります。
  `has_center_line`が設定された座標が`geometry_check_list`に存在するか確認してください。

### 次地点が見つからない

```
スキップ: (35.xxx, 137.xxx) の次地点が見つかりません
```

→ サンプル座標が`geometry_check_list`に含まれていません。
  サンプラーのフィルタリングで除外されるはずですが、座標の精度差で発生する場合があります。

### Claude APIエラー

→ API制限に達した可能性があります。しばらく待ってから再実行してください。
