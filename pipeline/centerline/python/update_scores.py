"""既存のclaude_center_lineレコードにscoreを追加するスクリプト.

DBからclaude_center_lineが設定済みのpointを取得し、
対応する画像で推論してclaude_center_line_scoreを更新する。
"""

import argparse
import os
from pathlib import Path

import psycopg2
from psycopg2.extras import execute_batch
import torch
from PIL import Image
from tqdm import tqdm

from config import DB_CONFIG, TMP_DIR, MODELS_DIR
from dataset import get_transforms
from model import CenterLineClassifier


def build_image_index(tmp_dir: Path) -> dict:
    """画像ディレクトリから (lat, lng) → ファイルパス のインデックスを構築"""
    index = {}
    for fname in os.listdir(tmp_dir):
        if not fname.startswith("highres_") or not fname.endswith(".jpg"):
            continue
        parts = fname.split("_")
        if len(parts) >= 3:
            lat = parts[1]
            lng = parts[2]
            index[(lat, lng)] = tmp_dir / fname
    return index


def main():
    parser = argparse.ArgumentParser(description="既存claude_center_lineレコードにscoreを追加")
    parser.add_argument("--model", type=str, help="モデルパス")
    parser.add_argument("--batch-size", type=int, default=32)
    parser.add_argument("--dry-run", action="store_true", help="DBに書き込まない")
    args = parser.parse_args()

    # 1. 画像インデックス構築
    print("Building image index...")
    image_index = build_image_index(TMP_DIR)
    print(f"  画像数: {len(image_index)}")

    # 2. DBからclaude_center_lineが設定済み & scoreが未設定のレコードを取得
    print("\nQuerying DB for records with claude_center_line but no score...")
    conn = psycopg2.connect(**DB_CONFIG)
    cur = conn.cursor()
    cur.execute("""
        SELECT ST_Y(point) as lat, ST_X(point) as lng
        FROM locations
        WHERE claude_center_line_score IS NULL
    """)
    rows = cur.fetchall()
    cur.close()
    print(f"  対象レコード: {len(rows)}")

    # 3. 画像とマッチング
    print("\nMatching with images...")
    items = []
    missing = 0
    for lat, lng in rows:
        key = (str(lat), str(lng))
        if key in image_index:
            items.append({
                "lat": lat,
                "lng": lng,
                "image_path": image_index[key],
            })
        else:
            missing += 1

    print(f"  画像あり: {len(items)}")
    print(f"  画像なし: {missing}")

    if not items:
        print("推論対象がありません")
        conn.close()
        return

    # 4. モデルロード
    print("\nLoading model...")
    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"  Device: {device}")

    model_path = Path(args.model) if args.model else MODELS_DIR / "vit_centerline_best.pt"
    model = CenterLineClassifier(pretrained=False)
    model.load_state_dict(torch.load(model_path, map_location=device, weights_only=True))
    model.to(device)
    model.eval()
    print(f"  Model: {model_path}")

    # 5. 推論
    print(f"\nRunning inference on {len(items)} images...")
    transform = get_transforms(is_training=False)
    results = []

    with torch.no_grad():
        for i in tqdm(range(0, len(items), args.batch_size), desc="Predicting"):
            batch_items = items[i:i + args.batch_size]

            images = []
            for item in batch_items:
                img = Image.open(item["image_path"]).convert("RGB")
                img = transform(img)
                images.append(img)

            images = torch.stack(images).to(device)
            logits = model(images)
            probs = torch.sigmoid(logits).cpu().tolist()

            for item, prob in zip(batch_items, probs):
                results.append({
                    "lat": item["lat"],
                    "lng": item["lng"],
                    "probability": prob,
                    "has_center_line": prob >= 0.5,
                })

    # 6. 統計
    true_count = sum(1 for r in results if r["has_center_line"])
    false_count = len(results) - true_count
    print(f"\n推論結果:")
    print(f"  中央線あり: {true_count}")
    print(f"  中央線なし: {false_count}")

    # 7. DB書き込み
    if not args.dry_run:
        print("\nWriting scores to database...")
        cur = conn.cursor()
        try:
            update_query = """
                UPDATE locations
                SET claude_center_line = %s, claude_center_line_score = %s
                WHERE ST_Y(point) = %s AND ST_X(point) = %s
            """
            update_data = [
                (r["has_center_line"], r["probability"], r["lat"], r["lng"])
                for r in results
            ]
            execute_batch(cur, update_query, update_data, page_size=100)
            conn.commit()
            print(f"  Updated: {len(results)} records")
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            cur.close()
    else:
        print("\n[DRY RUN] --dry-run を外すとDBに書き込みます")

    conn.close()
    print("\n=== 完了 ===")


if __name__ == "__main__":
    main()
