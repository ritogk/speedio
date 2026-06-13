"""学習データの準備（PostgreSQLからサンプル取得、画像パス生成）"""

import argparse
import json
import math
import os
import random
from pathlib import Path

import pandas as pd
import psycopg2
from psycopg2.extras import RealDictCursor
from tqdm import tqdm

from config import (
    DB_CONFIG,
    TMP_DIR,
    DATA_DIR,
    TARGETS_DIR,
    IMAGE_CONFIG,
    TRAIN_CONFIG,
)


def coord_key(lat: float, lng: float) -> str:
    """座標のキーを生成（小数点以下6桁で丸め）"""
    return f"{lat:.6f},{lng:.6f}"


def calculate_heading(from_lat: float, from_lng: float, to_lat: float, to_lng: float) -> float:
    """2点間の方位角を計算（panorama.tsと同じロジック）"""
    to_radians = lambda deg: deg * math.pi / 180
    to_degrees = lambda rad: rad * 180 / math.pi

    lat1 = to_radians(from_lat)
    lat2 = to_radians(to_lat)
    delta_lng = to_radians(to_lng - from_lng)

    x = math.sin(delta_lng) * math.cos(lat2)
    y = math.cos(lat1) * math.sin(lat2) - math.sin(lat1) * math.cos(lat2) * math.cos(delta_lng)

    heading = to_degrees(math.atan2(x, y))
    heading = (heading + 360) % 360

    return heading


def build_geometry_lookup(pref_codes: list = None) -> dict:
    """target.jsonからgeometry_listをロード"""
    geometry_map = {}
    valid_coords = set()

    if not TARGETS_DIR.exists():
        print(f"警告: targetsディレクトリが見つかりません: {TARGETS_DIR}")
        return {"geometry_map": geometry_map, "valid_coords": valid_coords}

    # 都道府県ディレクトリを決定
    if pref_codes:
        pref_dirs = pref_codes
    else:
        pref_dirs = [
            d.name for d in TARGETS_DIR.iterdir()
            if d.is_dir() and d.name.isdigit()
        ]

    print(f"{len(pref_dirs)}個の都道府県ディレクトリを処理")

    for pref in tqdm(pref_dirs, desc="Loading targets"):
        target_path = TARGETS_DIR / pref / "target.json"
        if not target_path.exists():
            continue

        try:
            with open(target_path, "r", encoding="utf-8") as f:
                entries = json.load(f)

            for entry in entries:
                geometry_list = entry.get("geometry_list", [])
                geometry_check_list = entry.get("geometry_check_list", [])

                if not geometry_check_list or len(geometry_check_list) < 3:
                    continue

                # 先頭と末尾を除く
                check_points = geometry_check_list[1:-1]

                for lat, lng in check_points:
                    key = coord_key(lat, lng)
                    if key not in geometry_map:
                        geometry_map[key] = geometry_list
                        valid_coords.add(key)

        except (json.JSONDecodeError, KeyError):
            continue

    print(f"有効座標数: {len(valid_coords)}")
    return {"geometry_map": geometry_map, "valid_coords": valid_coords}


def get_next_point(lat: float, lng: float, geometry_list: list) -> tuple:
    """geometry_listから次地点を取得（進行方向決定用）"""
    if not geometry_list or len(geometry_list) < 2:
        return None

    # 現在地点のインデックスを探す
    min_dist = float("inf")
    current_idx = 0

    for i, (glat, glng) in enumerate(geometry_list):
        dist = (glat - lat) ** 2 + (glng - lng) ** 2
        if dist < min_dist:
            min_dist = dist
            current_idx = i

    # 次地点（インデックス+1）を返す
    if current_idx < len(geometry_list) - 1:
        next_lat, next_lng = geometry_list[current_idx + 1]
        return (next_lat, next_lng)

    return None


def get_image_path(lat: float, lng: float, heading: float) -> Path:
    """キャッシュされた画像のパスを生成"""
    width = IMAGE_CONFIG["width"]
    height = IMAGE_CONFIG["height"]
    return TMP_DIR / f"highres_{lat}_{lng}_h{round(heading)}_{width}x{height}.jpg"


def fetch_samples_from_db() -> list:
    """PostgreSQLからhas_center_line付きレコードを取得"""
    conn = psycopg2.connect(**DB_CONFIG)
    cursor = conn.cursor(cursor_factory=RealDictCursor)

    query = """
        SELECT ST_X(point) AS lng, ST_Y(point) AS lat, has_center_line
        FROM locations
        WHERE has_center_line IS NOT NULL
    """
    cursor.execute(query)
    rows = cursor.fetchall()

    cursor.close()
    conn.close()

    return rows


def prepare_dataset(pref_codes: list = None, check_images: bool = True):
    """学習用データセットを準備"""
    print("=== データセット準備開始 ===")

    # 1. geometry_lookupを構築
    print("\n1. Geometry lookup構築中...")
    if pref_codes:
        print(f"  対象都道府県コード: {', '.join(pref_codes)}")
    lookup = build_geometry_lookup(pref_codes)
    geometry_map = lookup["geometry_map"]
    valid_coords = lookup["valid_coords"]

    # 2. DBからサンプル取得
    print("\n2. DBからサンプル取得中...")
    rows = fetch_samples_from_db()
    print(f"  取得レコード数: {len(rows)}")

    # 3. フィルタリングと画像パス生成
    print("\n3. フィルタリングと画像パス生成中...")
    samples = []
    missing_images = 0
    missing_geometry = 0

    for row in tqdm(rows, desc="Processing samples"):
        lat = row["lat"]
        lng = row["lng"]
        has_center_line = row["has_center_line"]

        key = coord_key(lat, lng)

        # geometry_check_listに存在するか確認
        if key not in valid_coords:
            missing_geometry += 1
            continue

        # 次地点を取得
        geometry_list = geometry_map.get(key)
        next_point = get_next_point(lat, lng, geometry_list)
        if next_point is None:
            continue

        next_lat, next_lng = next_point
        heading = calculate_heading(lat, lng, next_lat, next_lng)
        image_path = get_image_path(lat, lng, heading)

        # 画像存在チェック（オプション）
        if check_images and not image_path.exists():
            missing_images += 1
            continue

        samples.append({
            "lat": lat,
            "lng": lng,
            "next_lat": next_lat,
            "next_lng": next_lng,
            "heading": heading,
            "image_path": str(image_path.relative_to(TMP_DIR.parent)),
            "has_center_line": has_center_line,
        })

    print(f"  有効サンプル数: {len(samples)}")
    print(f"  geometryなし: {missing_geometry}")
    if check_images:
        print(f"  画像なし: {missing_images}")

    # 4. 層化サンプリング（true/falseを均等に）
    true_samples = [s for s in samples if s["has_center_line"]]
    false_samples = [s for s in samples if not s["has_center_line"]]

    print(f"\n4. クラス分布:")
    print(f"  true (中央線あり): {len(true_samples)}")
    print(f"  false (中央線なし): {len(false_samples)}")

    # シャッフル
    random.shuffle(true_samples)
    random.shuffle(false_samples)

    # 5. Train/Val/Test分割
    print("\n5. データ分割中...")
    val_ratio = TRAIN_CONFIG["val_split"]
    test_ratio = TRAIN_CONFIG["test_split"]

    def split_data(data: list, val_ratio: float, test_ratio: float):
        n = len(data)
        n_test = int(n * test_ratio)
        n_val = int(n * val_ratio)
        n_train = n - n_test - n_val

        return data[:n_train], data[n_train:n_train+n_val], data[n_train+n_val:]

    true_train, true_val, true_test = split_data(true_samples, val_ratio, test_ratio)
    false_train, false_val, false_test = split_data(false_samples, val_ratio, test_ratio)

    train_data = true_train + false_train
    val_data = true_val + false_val
    test_data = true_test + false_test

    random.shuffle(train_data)
    random.shuffle(val_data)
    random.shuffle(test_data)

    print(f"  Train: {len(train_data)} (true={len(true_train)}, false={len(false_train)})")
    print(f"  Val: {len(val_data)} (true={len(true_val)}, false={len(false_val)})")
    print(f"  Test: {len(test_data)} (true={len(true_test)}, false={len(false_test)})")

    # 6. CSV保存
    print("\n6. CSV保存中...")
    DATA_DIR.mkdir(exist_ok=True)

    for name, data in [("train", train_data), ("val", val_data), ("test", test_data)]:
        df = pd.DataFrame(data)
        path = DATA_DIR / f"{name}.csv"
        df.to_csv(path, index=False)
        print(f"  保存: {path}")

    print("\n=== データセット準備完了 ===")
    return train_data, val_data, test_data


def main():
    parser = argparse.ArgumentParser(description="学習データの準備")
    parser.add_argument("--pref", type=str, nargs='+', help="都道府県コード（例: 09 07 15 または 09,07,15）")
    parser.add_argument("--no-check-images", action="store_true", help="画像存在チェックをスキップ")
    args = parser.parse_args()

    # カンマ区切りとスペース区切り両方に対応
    pref_codes = None
    if args.pref:
        pref_codes = []
        for p in args.pref:
            pref_codes.extend(p.split(','))
        pref_codes = [c.strip() for c in pref_codes if c.strip()]

    prepare_dataset(
        pref_codes=pref_codes,
        check_images=not args.no_check_images,
    )


if __name__ == "__main__":
    main()
