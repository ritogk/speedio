# ViT-Small 中央線検出モデル

Google Street View画像から道路の中央線を検出するローカル機械学習モデル。

## 概要

Claude APIの代わりにViT-Small（Vision Transformer）を使用してローカルで推論を行い、コスト削減と高速化を実現。

| 項目 | Claude API | ViT-Small (本実装) |
|------|-----------|-------------------|
| F1 Score | 0.909 | **0.940** |
| コスト | $1.35/50枚 | 無料 |
| 速度 | 遅い (API往復) | 高速 (ローカル) |
| オフライン | 不可 | 可能 |

## クイックスタート（全体フロー）

```bash
# 1. 画像ダウンロード（DBから取得したデータの画像を取得）
./run.sh download_images.py

# 2. データ準備（train/val/test分割）
./run.sh prepare_data.py

# 3. 学習
./run.sh train.py --epochs 20 --batch-size 8

# 4. 評価
./run.sh evaluate.py

# 5. 推論→DB書き込み（教師データなしの都道府県）
./run.sh predict_to_db.py --pref 24 --write-db

# 6. 推論サーバー起動
./run.sh server.py
```

## 環境構築

### 1. Conda環境の作成（初回のみ）

```bash
conda create -n vit-centerline python=3.11 -y
conda activate vit-centerline

# PyTorch (CUDA)
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu121

# その他のパッケージ
pip install timm fastapi uvicorn psycopg2-binary pandas scikit-learn tqdm python-dotenv requests
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

### Step 1: 画像ダウンロード

DBからhas_center_lineが設定されているレコードを取得し、Google Street View画像をダウンロード。

```bash
./run.sh download_images.py
```

**オプション:**
| オプション | 説明 | 例 |
|-----------|------|-----|
| `--pref` | 都道府県コード指定（複数可） | `--pref 09 07 15` または `--pref 09,07,15` |
| `--limit` | ダウンロード上限数 | `--limit 100` |
| `--force` | 既存画像も再ダウンロード | |
| `--from-targets` | target.jsonから座標取得（教師データなしでもDL可能） | |

**都道府県コード例:**
| 都道府県 | コード |
|---------|--------|
| 青森 | 02 |
| 秋田 | 05 |
| 福島 | 07 |
| 栃木 | 09 |
| 新潟 | 15 |
| 岐阜 | 21 |
| 三重 | 24 |

**出力先:** `tmp/highres_{lat}_{lng}_h{heading}_1280x960.jpg`

### Step 2: データ準備

ダウンロードした画像を使って学習用データセットを作成。

```bash
./run.sh prepare_data.py
```

**オプション:**
| オプション | 説明 | 例 |
|-----------|------|-----|
| `--pref` | 都道府県コード指定（複数可） | `--pref 09 07 15` または `--pref 09,07,15` |
| `--no-check-images` | 画像存在チェックをスキップ | |

**出力:**
```
data/
├── train.csv   # 学習データ (70%)
├── val.csv     # 検証データ (15%)
└── test.csv    # テストデータ (15%)
```

### Step 3: 学習

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

### Step 4: 評価

```bash
./run.sh evaluate.py
```

**オプション:**
| オプション | デフォルト | 説明 |
|-----------|-----------|------|
| `--model` | best | モデルファイルパス |
| `--split` | test | 評価対象 (train/val/test) |
| `--batch-size` | 16 | バッチサイズ |

### Step 5: 推論してDBに書き込み

教師データがない都道府県に対して、学習済みモデルで推論し結果をDBに書き込む。

```bash
# ドライラン（確認のみ）
./run.sh predict_to_db.py --pref 24

# DB書き込み実行
./run.sh predict_to_db.py --pref 24 --write-db
```

**オプション:**
| オプション | デフォルト | 説明 |
|-----------|-----------|------|
| `--pref` | (必須) | 都道府県コード |
| `--batch-size` | 16 | バッチサイズ |
| `--write-db` | - | DBに書き込む（指定しないとドライラン） |

**書き込み先:** `locations.claude_center_line`

### Step 6: 推論サーバー起動

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
├── panorama.py         # Street View画像取得（Python版）
├── download_images.py  # 画像ダウンロードスクリプト
├── prepare_data.py     # データ準備
├── dataset.py          # PyTorch Dataset
├── model.py            # ViT-Smallモデル定義
├── train.py            # 学習スクリプト
├── inference.py        # 推論クラス
├── server.py           # FastAPI推論サーバー
├── evaluate.py         # 評価スクリプト
└── predict_to_db.py    # 推論→DB書き込みスクリプト

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

### GOOGLE_MAPS_API_KEY エラー
```bash
# .envファイルにAPIキーを設定
echo "GOOGLE_MAPS_API_KEY=your_api_key_here" >> ../.env
```

## ライセンス

内部使用のみ
