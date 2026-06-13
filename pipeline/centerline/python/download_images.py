"""Street View画像をダウンロードするスクリプト"""

import argparse
import json
import math
import os
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import psycopg2
from psycopg2.extras import RealDictCursor
from tqdm import tqdm

from config import DB_CONFIG, TMP_DIR, TARGETS_DIR, IMAGE_CONFIG, GOOGLE_MAPS_API_KEY
from panorama import download_image, calculate_heading


def coord_key(lat: float, lng: float) -> str:
    """座標のキーを生成（小数点以下6桁で丸め）"""
    return f"{lat:.6f},{lng:.6f}"


def build_geometry_lookup(pref_codes: list = None) -> dict:
    """target.jsonからgeometry_listをロード"""
    geometry_map = {}
    valid_coords = set()
    raw_coords = {}

    if not TARGETS_DIR.exists():
        print(f"警告: targetsディレクトリが見つかりません: {TARGETS_DIR}")
        return {"geometry_map": geometry_map, "valid_coords": valid_coords, "raw_coords": raw_coords}

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
                        raw_coords[key] = (lat, lng)

        except (json.JSONDecodeError, KeyError):
            continue

    print(f"有効座標数: {len(valid_coords)}")
    return {"geometry_map": geometry_map, "valid_coords": valid_coords, "raw_coords": raw_coords}


def get_next_point(lat: float, lng: float, geometry_list: list) -> tuple:
    """geometry_listから次地点を取得"""
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


def download_images(pref_codes: list = None, limit: int = None, skip_existing: bool = True, from_targets: bool = False):
    """画像をダウンロード"""
    print("=== 画像ダウンロード開始 ===")

    if not GOOGLE_MAPS_API_KEY:
        print("エラー: GOOGLE_MAPS_API_KEY が設定されていません")
        print("  .env ファイルに GOOGLE_MAPS_API_KEY=xxx を追加してください")
        return

    # 1. geometry_lookupを構築
    print("\n1. Geometry lookup構築中...")
    if pref_codes:
        print(f"  対象都道府県コード: {', '.join(pref_codes)}")
    lookup = build_geometry_lookup(pref_codes)
    geometry_map = lookup["geometry_map"]
    valid_coords = lookup["valid_coords"]

    # 2. 座標を取得（DBまたはtarget.jsonから）
    if from_targets:
        print("\n2. target.jsonから座標取得中...")
        raw_coords = lookup["raw_coords"]
        rows = [{"lat": raw_coords[k][0], "lng": raw_coords[k][1], "has_center_line": None}
                for k in valid_coords]
        print(f"  取得座標数: {len(rows)}")
    else:
        print("\n2. DBからサンプル取得中...")
        rows = fetch_samples_from_db()
        print(f"  取得レコード数: {len(rows)}")

    # 3. ダウンロード対象を特定
    print("\n3. ダウンロード対象を特定中...")
    targets = []

    for row in rows:
        lat = row["lat"]
        lng = row["lng"]
        key = coord_key(lat, lng)

        if not from_targets and key not in valid_coords:
            continue

        geometry_list = geometry_map.get(key)
        next_point = get_next_point(lat, lng, geometry_list)
        if next_point is None:
            continue

        next_lat, next_lng = next_point
        heading = calculate_heading(lat, lng, next_lat, next_lng)
        image_path = get_image_path(lat, lng, heading)

        # 既存チェック
        if skip_existing and image_path.exists():
            continue

        targets.append({
            "lat": lat,
            "lng": lng,
            "next_lat": next_lat,
            "next_lng": next_lng,
            "heading": heading,
            "image_path": image_path,
            "has_center_line": row["has_center_line"],
        })

    if limit:
        targets = targets[:limit]

    print(f"  ダウンロード対象: {len(targets)}件")

    if not targets:
        print("\nダウンロードする画像がありません（すべてキャッシュ済み）")
        return

    # 4. ダウンロード実行（15並列）
    print("\n4. 画像ダウンロード中（8並列）...")
    TMP_DIR.mkdir(exist_ok=True)

    success = 0
    failed = 0
    failed_list = []

    def download_task(target):
        """並列ダウンロード用タスク"""
        download_image(
            target["lat"],
            target["lng"],
            GOOGLE_MAPS_API_KEY,
            target["next_lat"],
            target["next_lng"],
        )
        return target

    with ThreadPoolExecutor(max_workers=8) as executor:
        futures = {executor.submit(download_task, t): t for t in targets}
        for future in tqdm(as_completed(futures), total=len(targets), desc="Downloading"):
            target = futures[future]
            try:
                future.result()
                success += 1
            except Exception as e:
                failed += 1
                failed_list.append({
                    "lat": target["lat"],
                    "lng": target["lng"],
                    "error": str(e)
                })
                if failed <= 5:  # 最初の5件だけエラー表示
                    tqdm.write(f"  エラー: ({target['lat']}, {target['lng']}): {e}")

    print(f"\n=== ダウンロード完了 ===")
    print(f"  成功: {success}件")
    print(f"  失敗: {failed}件")

    if failed > 5:
        print(f"  ※ 残り{failed - 5}件のエラーは省略")


def main():
    parser = argparse.ArgumentParser(description="Street View画像のダウンロード")
    parser.add_argument("--pref", type=str, nargs='+', help="都道府県コード（例: 09 07 15 または 09,07,15）")
    parser.add_argument("--limit", type=int, help="ダウンロード上限数")
    parser.add_argument("--force", action="store_true", help="既存画像も再ダウンロード")
    parser.add_argument("--from-targets", action="store_true", help="target.jsonから座標取得（教師データなしでもDL可能）")
    args = parser.parse_args()

    # カンマ区切りとスペース区切り両方に対応
    pref_codes = None
    if args.pref:
        pref_codes = []
        for p in args.pref:
            pref_codes.extend(p.split(','))
        pref_codes = [c.strip() for c in pref_codes if c.strip()]

    download_images(
        pref_codes=pref_codes,
        limit=args.limit,
        skip_existing=not args.force,
        from_targets=args.from_targets,
    )


if __name__ == "__main__":
    main()
