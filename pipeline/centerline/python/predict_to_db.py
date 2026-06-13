"""学習済みモデルで推論し、結果をDBに書き込むスクリプト"""

import argparse
import json
import math
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from queue import Queue

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


def predict_to_db(pref_code: str, batch_size: int = 128, write_db: bool = False, model_path: str = None):
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

    if model_path is None:
        model_path = MODELS_DIR / "vit_centerline_best.pt"
    else:
        model_path = Path(model_path)
    model = CenterLineClassifier(pretrained=False)
    model.load_state_dict(torch.load(model_path, map_location=device, weights_only=True))
    model.to(device)
    model.eval()
    print(f"  Model: {model_path}")

    # 4. 推論 + DB書き込み（プリフェッチ + バッチごと）
    print(f"\nRunning inference (batch={batch_size}, prefetch=2)...")
    transform = get_transforms(is_training=False)
    true_count = 0
    false_count = 0
    total_updated = 0

    conn = None
    cursor = None
    if write_db:
        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor()

    update_query = """
        UPDATE locations
        SET claude_center_line = %s, claude_center_line_score = %s
        WHERE ST_Y(point) = %s AND ST_X(point) = %s
    """

    NUM_LOAD_WORKERS = 4

    def load_single(item):
        img = Image.open(item["image_path"]).convert("RGB")
        return transform(img)

    def load_batch_parallel(batch_items):
        with ThreadPoolExecutor(max_workers=NUM_LOAD_WORKERS) as pool:
            tensors = list(pool.map(load_single, batch_items))
        return torch.stack(tensors)

    prefetch_queue = Queue(maxsize=2)

    def prefetch_worker():
        for i in range(0, len(items), batch_size):
            batch_items = items[i:i + batch_size]
            tensor = load_batch_parallel(batch_items)
            prefetch_queue.put((batch_items, tensor))
        prefetch_queue.put(None)

    try:
        executor = ThreadPoolExecutor(max_workers=1)
        executor.submit(prefetch_worker)

        n_batches = (len(items) + batch_size - 1) // batch_size
        with torch.no_grad():
            for _ in tqdm(range(n_batches), desc="Predicting"):
                entry = prefetch_queue.get()
                if entry is None:
                    break
                batch_items, images = entry

                images = images.to(device)
                logits = model(images)
                probs = torch.sigmoid(logits).cpu().tolist()

                batch_data = []
                for item, prob in zip(batch_items, probs):
                    has_cl = prob >= 0.5
                    if has_cl:
                        true_count += 1
                    else:
                        false_count += 1
                    batch_data.append((has_cl, prob, item["lat"], item["lng"]))

                if write_db:
                    execute_batch(cursor, update_query, batch_data, page_size=100)
                    conn.commit()
                    total_updated += len(batch_data)

        executor.shutdown(wait=True)

        print(f"\n推論結果:")
        print(f"  中央線あり: {true_count}")
        print(f"  中央線なし: {false_count}")
        if write_db:
            print(f"  Updated: {total_updated} records")
        else:
            print("\n[DRY RUN] --write-db を指定するとDBに書き込みます")

    except Exception as e:
        if conn:
            conn.rollback()
        raise e
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

    print("\n=== 完了 ===")


def main():
    parser = argparse.ArgumentParser(description="推論結果をDBに書き込み")
    parser.add_argument("--pref", type=str, nargs="+", required=True, help="都道府県コード（例: 24、複数指定可）")
    parser.add_argument("--model", type=str, help="モデルパス（デフォルト: vit_centerline_best.pt）")
    parser.add_argument("--batch-size", type=int, default=128, help="バッチサイズ")
    parser.add_argument("--write-db", action="store_true", help="DBに書き込む")
    args = parser.parse_args()

    for pref_code in args.pref:
        predict_to_db(
            pref_code=pref_code,
            batch_size=args.batch_size,
            write_db=args.write_db,
            model_path=args.model,
        )


if __name__ == "__main__":
    main()
