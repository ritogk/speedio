"""学習済みモデルで推論し、結果をDBに書き込むスクリプト"""

import argparse
import json
import math
from pathlib import Path

import psycopg2
from psycopg2.extras import execute_batch
import torch
from PIL import Image
from tqdm import tqdm

from config import MODELS_DIR, TMP_DIR, TARGETS_DIR, IMAGE_CONFIG, DB_CONFIG
from dataset import get_transforms
from model import CenterLineClassifier


def coord_key(lat: float, lng: float) -> str:
    return f"{lat:.6f},{lng:.6f}"


def calculate_heading(from_lat: float, from_lng: float, to_lat: float, to_lng: float) -> float:
    lat1 = math.radians(from_lat)
    lat2 = math.radians(to_lat)
    delta_lng = math.radians(to_lng - from_lng)

    x = math.sin(delta_lng) * math.cos(lat2)
    y = math.cos(lat1) * math.sin(lat2) - math.sin(lat1) * math.cos(lat2) * math.cos(delta_lng)

    heading = math.degrees(math.atan2(x, y))
    return (heading + 360) % 360


def get_next_point(lat: float, lng: float, geometry_list: list):
    if not geometry_list or len(geometry_list) < 2:
        return None

    min_dist = float("inf")
    current_idx = 0

    for i, (glat, glng) in enumerate(geometry_list):
        dist = (glat - lat) ** 2 + (glng - lng) ** 2
        if dist < min_dist:
            min_dist = dist
            current_idx = i

    if current_idx < len(geometry_list) - 1:
        return geometry_list[current_idx + 1]
    return None


def get_image_path(lat: float, lng: float, heading: float) -> Path:
    width = IMAGE_CONFIG["width"]
    height = IMAGE_CONFIG["height"]
    return TMP_DIR / f"highres_{lat}_{lng}_h{round(heading)}_{width}x{height}.jpg"


def load_targets(pref_code: str):
    """target.jsonから座標とgeometry情報をロード"""
    target_path = TARGETS_DIR / pref_code / "target.json"
    if not target_path.exists():
        raise FileNotFoundError(f"target.json not found: {target_path}")

    print(f"Loading targets from {target_path}...")
    with open(target_path, "r", encoding="utf-8") as f:
        entries = json.load(f)

    geometry_map = {}
    coords = []

    for entry in entries:
        geometry_list = entry.get("geometry_list", [])
        geometry_check_list = entry.get("geometry_check_list", [])

        if not geometry_check_list or len(geometry_check_list) < 3:
            continue

        check_points = geometry_check_list[1:-1]

        for lat, lng in check_points:
            key = coord_key(lat, lng)
            if key not in geometry_map:
                geometry_map[key] = geometry_list
                coords.append((lat, lng))

    print(f"  座標数: {len(coords)}")
    return geometry_map, coords


def predict_to_db(pref_code: str, batch_size: int = 16, write_db: bool = False):
    """推論してDBに書き込み"""
    print(f"=== 都道府県コード {pref_code} の推論 ===\n")

    # 1. ターゲット読み込み
    geometry_map, coords = load_targets(pref_code)

    # 2. 画像パスを準備
    print("\nPreparing images...")
    items = []
    missing = 0

    for lat, lng in coords:
        key = coord_key(lat, lng)
        geometry_list = geometry_map.get(key)
        next_point = get_next_point(lat, lng, geometry_list)

        if next_point is None:
            continue

        next_lat, next_lng = next_point
        heading = calculate_heading(lat, lng, next_lat, next_lng)
        image_path = get_image_path(lat, lng, heading)

        if not image_path.exists():
            missing += 1
            continue

        items.append({
            "lat": lat,
            "lng": lng,
            "image_path": image_path,
        })

    print(f"  有効画像: {len(items)}")
    print(f"  画像なし: {missing}")

    if not items:
        print("推論対象がありません")
        return

    # 3. モデルロード
    print("\nLoading model...")
    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"  Device: {device}")

    model_path = MODELS_DIR / "vit_centerline_best.pt"
    model = CenterLineClassifier(pretrained=False)
    model.load_state_dict(torch.load(model_path, map_location=device, weights_only=True))
    model.to(device)
    model.eval()
    print(f"  Model: {model_path}")

    # 4. 推論
    print(f"\nRunning inference...")
    transform = get_transforms(is_training=False)
    results = []

    with torch.no_grad():
        for i in tqdm(range(0, len(items), batch_size), desc="Predicting"):
            batch_items = items[i:i + batch_size]

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

    # 5. 統計
    true_count = sum(1 for r in results if r["has_center_line"])
    false_count = len(results) - true_count
    print(f"\n推論結果:")
    print(f"  中央線あり: {true_count}")
    print(f"  中央線なし: {false_count}")

    # 6. DB書き込み
    if write_db:
        print("\nWriting to database (claude_center_line)...")
        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor()

        try:
            update_query = """
                UPDATE locations
                SET claude_center_line = %s
                WHERE ST_Y(point) = %s AND ST_X(point) = %s
            """

            update_data = [
                (r["has_center_line"], r["lat"], r["lng"])
                for r in results
            ]

            execute_batch(cursor, update_query, update_data, page_size=100)
            conn.commit()

            print(f"  Updated: {len(results)} records")

        except Exception as e:
            conn.rollback()
            raise e
        finally:
            cursor.close()
            conn.close()
    else:
        print("\n[DRY RUN] --write-db を指定するとDBに書き込みます")

    print("\n=== 完了 ===")
    return results


def main():
    parser = argparse.ArgumentParser(description="推論結果をDBに書き込み")
    parser.add_argument("--pref", type=str, required=True, help="都道府県コード（例: 24）")
    parser.add_argument("--batch-size", type=int, default=16, help="バッチサイズ")
    parser.add_argument("--write-db", action="store_true", help="DBに書き込む")
    args = parser.parse_args()

    predict_to_db(
        pref_code=args.pref,
        batch_size=args.batch_size,
        write_db=args.write_db,
    )


if __name__ == "__main__":
    main()
