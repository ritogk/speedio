# ViT-Small 中央線検出モデル

Google Street View画像から道路の中央線を検出するローカル機械学習モデル。

## 概要

Claude APIの代わりにViT-Small（Vision Transformer）を使用してローカルで推論を行い、コスト削減と高速化を実現。

| 項目 | Claude API | ViT-Small (本実装) |
|------|-----------|-------------------|
| F1 Score | 0.909 | **0.930** |
| コスト | $1.35/50枚 | 無料 |
| 速度 | 遅い (API往復) | 高速 (ローカル) |
| オフライン | 不可 | 可能 |

## 環境構築

### 1. Conda環境の作成（初回のみ）

```bash
conda create -n vit-centerline python=3.11 -y
conda activate vit-centerline

# PyTorch (CUDA)
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu121

# その他のパッケージ
pip install timm fastapi uvicorn psycopg2-binary pandas scikit-learn tqdm python-dotenv
```

### 2. 環境のアクティベート

```bash
conda activate vit-centerline
```

または `run.sh` を使用（自動でアクティベート）:

```bash
./run.sh <スクリプト名>
```

## 使い方

### Step 1: データ準備

PostgreSQLから教師データを取得し、学習用データセットを作成。

```bash
./run.sh prepare_data.py
```

**オプション:**
| オプション | 説明 | 例 |
|-----------|------|-----|
| `--pref` | 都道府県コード指定 | `--pref 21` (岐阜県) |
| `--no-check-images` | 画像存在チェックをスキップ | |

**出力:**
```
data/
├── train.csv   # 学習データ (70%)
├── val.csv     # 検証データ (15%)
└── test.csv    # テストデータ (15%)
```

### Step 2: 学習

```bash
./run.sh train.py --epochs 20 --batch-size 8
```

**オプション:**
| オプション | デフォルト | 説明 |
|-----------|-----------|------|
| `--epochs` | 20 | エポック数 |
| `--batch-size` | 8 | バッチサイズ (VRAM 4GBなら8-16) |
| `--lr` | 0.0001 | 学習率 |
| `--patience` | 5 | Early Stopping patience |
| `--workers` | 4 | データローダーのワーカー数 |

**高速化版（リソースに余裕がある場合）:**
```bash
./run.sh train.py --epochs 20 --batch-size 16 --workers 8
```

**出力:**
```
models/
├── vit_centerline_best.pt   # ベストモデル
└── vit_centerline_last.pt   # 最終モデル
```

### Step 3: 評価

```bash
./run.sh evaluate.py
```

**オプション:**
| オプション | デフォルト | 説明 |
|-----------|-----------|------|
| `--model` | best | モデルファイルパス |
| `--split` | test | 評価対象 (train/val/test) |
| `--batch-size` | 16 | バッチサイズ |

### Step 4: 推論サーバー起動

```bash
./run.sh server.py --port 8000
```

**API エンドポイント:**

| エンドポイント | メソッド | 説明 |
|---------------|---------|------|
| `/health` | GET | ヘルスチェック |
| `/predict` | POST | 単一画像推論 |
| `/predict_batch` | POST | バッチ推論 |

**リクエスト例:**
```bash
# Base64画像で推論
curl -X POST http://localhost:8000/predict \
  -H "Content-Type: application/json" \
  -d '{"image_base64": "..."}'

# 画像パスで推論
curl -X POST http://localhost:8000/predict \
  -H "Content-Type: application/json" \
  -d '{"image_path": "/path/to/image.jpg"}'
```

**レスポンス:**
```json
{
  "has_center_line": true,
  "probability": 0.9234,
  "confidence": 0.9234
}
```

## TypeScriptからの利用

```typescript
import { predictCenterLineFromBase64 } from "./local-inference";

const result = await predictCenterLineFromBase64(imageBase64);
// { hasCenterLine: true, confidence: 0.92, probability: 0.92 }
```

## ファイル構成

```
python/
├── run.sh              # 環境起動スクリプト
├── requirements.txt    # 依存パッケージ
├── config.py           # 設定管理
├── prepare_data.py     # データ準備
├── dataset.py          # PyTorch Dataset
├── model.py            # ViT-Smallモデル定義
├── train.py            # 学習スクリプト
├── inference.py        # 推論クラス
├── server.py           # FastAPI推論サーバー
└── evaluate.py         # 評価スクリプト

models/
└── vit_centerline_best.pt  # 学習済みモデル

data/
├── train.csv
├── val.csv
└── test.csv
```

## モデル仕様

| 項目 | 値 |
|------|-----|
| アーキテクチャ | ViT-Small (patch16) |
| 入力サイズ | 384 × 384 |
| パラメータ数 | 21.8M |
| 出力 | 二値分類 (中央線あり/なし) |
| 推定VRAM | ~3.5GB (学習時) |

## トラブルシューティング

### CUDA out of memory
```bash
# バッチサイズを下げる
./run.sh train.py --batch-size 4
```

### データが見つからない
```bash
# PostgreSQLが起動しているか確認
sudo systemctl status postgresql

# 画像キャッシュの確認
ls -la ../tmp/highres_*.jpg | head
```

### モデルが見つからない
```bash
# 学習を実行してモデルを生成
./run.sh train.py --epochs 1
```

## ライセンス

内部使用のみ
