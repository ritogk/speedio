#!/usr/bin/env python3
"""
S3上の targets/{pref}/target.json からビュワー(index_3.html)用の軽量版
target.slim.json を生成し、gzip圧縮(+Content-Encoding: gzip)でS3に併置する。

- 元の target.json は変更しない（バックアップ: targets_bk_20260611/）
- CloudFrontの自動圧縮は10MB超で効かないため、事前gzipで配信する
- 座標は小数5桁(≈1m精度)に丸める

usage: python3 build_slim_targets.py [--local] [--refresh-null] [pref_code ...]   # 省略時は全県
       --local: S3にアップせず tools/viewer/targets/ に直接書き出す
       --refresh-null: city_cache.json内のnullエントリを再取得する
"""
import gzip
import json
import re
import subprocess
import sys
import tempfile
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import psycopg2
from shapely import wkt
from shapely.geometry import LineString

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from analyzer.analysis.column_generater_module.core.linstring_to_polygon import create_vertical_polygon


BUCKET = "speedio-old-viewer-788594208758"
LOCAL_TARGETS = Path(__file__).resolve().parents[2] / "data" / "targets"
VIEWER_TARGETS = Path(__file__).resolve().parents[2] / "tools" / "viewer" / "targets"
PREFS = [f"{i:02d}" for i in range(1, 48)]
PREFECTURES = {
    "01":"北海道","02":"青森県","03":"岩手県","04":"宮城県","05":"秋田県","06":"山形県","07":"福島県",
    "08":"茨城県","09":"栃木県","10":"群馬県","11":"埼玉県","12":"千葉県","13":"東京都","14":"神奈川県",
    "15":"新潟県","16":"富山県","17":"石川県","18":"福井県","19":"山梨県","20":"長野県","21":"岐阜県",
    "22":"静岡県","23":"愛知県","24":"三重県","25":"滋賀県","26":"京都府","27":"大阪府","28":"兵庫県",
    "29":"奈良県","30":"和歌山県","31":"鳥取県","32":"島根県","33":"岡山県","34":"広島県","35":"山口県",
    "36":"徳島県","37":"香川県","38":"愛媛県","39":"高知県","40":"福岡県","41":"佐賀県","42":"長崎県",
    "43":"熊本県","44":"大分県","45":"宮崎県","46":"鹿児島県","47":"沖縄県",
}

CITY_CONCURRENCY = 10
CITY_CACHE_FILE = Path(__file__).resolve().parent / "city_cache.json"
_city_cache = {}


def _load_city_cache(refresh_null=False):
    global _city_cache
    if CITY_CACHE_FILE.exists():
        raw = json.loads(CITY_CACHE_FILE.read_text())
        if refresh_null:
            null_count = sum(1 for v in raw.values() if v is None)
            _city_cache = {k: v for k, v in raw.items() if v is not None}
            print(f"  キャッシュファイル読み込み: {len(_city_cache)}件（null {null_count}件を再取得対象に）", flush=True)
        else:
            _city_cache = raw
            print(f"  キャッシュファイル読み込み: {len(_city_cache)}件", flush=True)


def _save_city_cache():
    CITY_CACHE_FILE.write_text(json.dumps(_city_cache, ensure_ascii=False, separators=(",", ":")))


def _fetch_city_single(lat, lng):
    url = f"https://geoapi.heartrails.com/api/json?method=searchByGeoLocation&x={lng}&y={lat}"
    for attempt in range(3):
        try:
            with urllib.request.urlopen(url, timeout=5) as res:
                data = json.loads(res.read())
            city = data.get("response", {}).get("location", [{}])[0].get("city", "")
            city = re.sub(r"^.+郡(?=.+[町村]$)", "", city)
            city = re.sub(r"^(.+市).+区$", r"\1", city)
            return city or None
        except Exception:
            if attempt < 2:
                time.sleep(0.5)
    return None


def prefetch_cities(coord_keys):
    """座標キーのリストからユニークなものだけAPIで取得し、全件成功するまでリトライする。"""
    unique = [k for k in set(coord_keys) if k not in _city_cache]
    if not unique:
        print(f"  市区町村名: 全{len(set(coord_keys))}件キャッシュ済み（API呼び出しなし）", flush=True)
        return
    print(f"  市区町村名を取得中... {len(unique)}件 (キャッシュ済み{len(set(coord_keys))-len(unique)}件)", flush=True)

    def fetch_one(key):
        lat, lng = (float(x) for x in key.split("_"))
        city = _fetch_city_single(lat, lng)
        if city is not None:
            _city_cache[key] = city
        return city is not None

    attempt = 0
    no_progress_count = 0
    remaining = list(unique)
    while remaining:
        attempt += 1
        if attempt > 1:
            wait = min(30, 5 * attempt)
            print(f"  リトライ {attempt}回目: 残り{len(remaining)}件 ({wait}秒待機)", flush=True)
            time.sleep(wait)

        failed_keys = []
        done = 0
        with ThreadPoolExecutor(max_workers=CITY_CONCURRENCY) as pool:
            futures = {pool.submit(fetch_one, k): k for k in remaining}
            for f in as_completed(futures):
                done += 1
                if not f.result():
                    failed_keys.append(futures[f])
                if done % 200 == 0:
                    print(f"    {done}/{len(remaining)} ({len(failed_keys)} failed)", flush=True)

        succeeded = len(remaining) - len(failed_keys)
        if failed_keys:
            print(f"  {succeeded}/{len(remaining)}件 成功 ({len(failed_keys)}件 失敗)", flush=True)

        if succeeded == 0:
            no_progress_count += 1
        else:
            no_progress_count = 0

        if no_progress_count >= 2:
            print(f"  ⚠ {len(failed_keys)}件はAPI取得不可のため city=null で続行", flush=True)
            for k in failed_keys:
                _city_cache[k] = None
            break
        remaining = failed_keys

    _save_city_cache()
    print(f"  全{len(unique)}件 取得完了（キャッシュ保存済み）", flush=True)


def lookup_city(lat, lng):
    key = f"{lat:.3f}_{lng:.3f}"
    return _city_cache.get(key)


def r5(v):
    return round(v, 5)


def elevation_fluctuation(elevations):
    """pipeline/analyzer/analysis/column_generater_module/elevation_fluctuation.py と同一ロジック。
    target.json に elevation_fluctuation が無い既存データ向けに elevation_smooth から再計算する。"""
    up = down = 0.0
    prev = None
    for e in elevations or []:
        if prev is not None:
            diff = e - prev
            # 標高の変化量が40m以上の場合はtif範囲外を見ている可能性があるため、無視する
            if abs(diff) < 40:
                if diff > 0:
                    up += diff
                else:
                    down += abs(diff)
        prev = e
    return round(up, 1), round(down, 1)


def fetch_buildings_nearby(cur, geometry_list, buffer_m=15):
    if not geometry_list or len(geometry_list) < 2:
        return []
    lats = [p[0] for p in geometry_list]
    lngs = [p[1] for p in geometry_list]
    line_coords = [(p[1], p[0]) for p in geometry_list]  # (lng, lat) for shapely
    polygon = create_vertical_polygon(line_coords, buffer_m)

    cur.execute("""
        SELECT ST_AsText(geometry)
        FROM buildings
        WHERE ST_Intersects(geometry, ST_MakeEnvelope(%s, %s, %s, %s, 4326))
    """, (min(lngs), min(lats), max(lngs), max(lats)))

    result = []
    for (wkt_str,) in cur:
        geom = wkt.loads(wkt_str)
        if not geom.intersects(polygon):
            continue
        if geom.geom_type == "Polygon":
            result.append([[r5(c[1]), r5(c[0])] for c in geom.exterior.coords])
        elif geom.geom_type == "MultiPolygon":
            for poly in geom.geoms:
                result.append([[r5(c[1]), r5(c[0])] for c in poly.exterior.coords])
    return result


def slim_touge(t, cur=None, pref_code=None):
    fluct = t.get("elevation_fluctuation")
    if fluct is None:
        fluct = elevation_fluctuation(t.get("elevation_smooth"))
    buildings = fetch_buildings_nearby(cur, t.get("geometry_list")) if cur else []
    geo = t.get("geometry_list") or []
    mid = geo[len(geo) // 2] if geo else None
    city = lookup_city(mid[0], mid[1]) if mid else None
    return {
        "prefecture": PREFECTURES.get(pref_code, ""),
        "city": re.sub(r"^(.{2,})島\1[町村]$", r"\1島", city) if city else city,
        "length": t.get("length"),
        "highway": t.get("highway"),
        "name": t.get("name"),
        "elevation_height": t.get("elevation_height"),
        "score_elevation": t.get("score_elevation"),
        "score_elevation_unevenness": t.get("score_elevation_unevenness"),
        "score_width": t.get("score_width"),
        "score_length": t.get("score_length"),
        "score_building": t.get("score_building"),
        "score_tunnel_outside": t.get("score_tunnel_outside"),
        "score_corner_week": t.get("score_corner_week"),
        "score_corner_medium": t.get("score_corner_medium"),
        "score_corner_strong": t.get("score_corner_strong"),
        "score_corner_none": t.get("score_corner_none"),
        "score_corner_balance": t.get("score_corner_balance"),
        "score_claude_center_line_section": t.get("score_claude_center_line_section"),
        "elevation_up": fluct[0],
        "elevation_down": fluct[1],
        "elevation_unevenness_count": t.get("elevation_unevenness_count"),
        "elevation_unevenness": [
            {"point": [r5(u["point"][0]), r5(u["point"][1])], "prominence": round(u["prominence"], 1)}
            for u in t.get("elevation_unevenness") or []
        ],
        "building_nearby_cnt": len(buildings),
        "uphill_cnt": len((t.get("elevation_unevenness_sections") or {}).get("uphill") or []) if t.get("elevation_unevenness_sections") else None,
        "downhill_cnt": len((t.get("elevation_unevenness_sections") or {}).get("downhill") or []) if t.get("elevation_unevenness_sections") else None,
        "geometry_list": [[r5(p[0]), r5(p[1])] for p in t.get("geometry_list") or []],
        "road_section": [
            {
                "section_type": s.get("section_type"),
                "corner_level": s.get("corner_level"),
                "points": [[r5(p[0]), r5(p[1])] for p in s.get("points") or []],
            }
            for s in t.get("road_section") or []
        ],
        "elevation_smooth": [round(e, 1) for e in t.get("elevation_smooth") or []],
        "elevation_unevenness_sections": {
            k: [{"start": [r5(s["start"][0]), r5(s["start"][1])], "end": [r5(s["end"][0]), r5(s["end"][1])]} for s in v]
            for k, v in (t.get("elevation_unevenness_sections") or {}).items()
        } if t.get("elevation_unevenness_sections") else None,
        "buildings": buildings,
    }


def main():
    args = sys.argv[1:]
    local_mode = "--local" in args
    refresh_null = "--refresh-null" in args
    prefs = [a for a in args if not a.startswith("--")] or PREFS
    conn = psycopg2.connect(host="localhost", dbname="speedia", user="postgres", password="postgres")
    cur = conn.cursor()

    _load_city_cache(refresh_null=refresh_null)

    # Phase 1: 全県のtarget.jsonを読み込み、全ユニーク座標を収集してAPI一括取得
    all_data = {}
    all_coord_keys = []
    for code in prefs:
        raw_path = LOCAL_TARGETS / code / "target.json"
        if not raw_path.exists():
            print(f"[{code}] SKIP (local target.json not found)", flush=True)
            continue
        data = json.loads(raw_path.read_text())
        all_data[code] = data
        for t in data:
            geo = t.get("geometry_list") or []
            if geo:
                mid = geo[len(geo) // 2]
                all_coord_keys.append(f"{mid[0]:.3f}_{mid[1]:.3f}")

    print(f"全{len(all_data)}県 {sum(len(v) for v in all_data.values())}件のルート、{len(set(all_coord_keys))}ユニーク座標", flush=True)
    prefetch_cities(all_coord_keys)

    # Phase 2: slim生成（API呼び出しなし、キャッシュから引くだけ）
    try:
        for code, data in all_data.items():
            slim = [slim_touge(t, cur, pref_code=code) for t in data]
            body = json.dumps(slim, ensure_ascii=False, separators=(",", ":")).encode()
            if local_mode:
                out_dir = VIEWER_TARGETS / code
                out_dir.mkdir(parents=True, exist_ok=True)
                (out_dir / "target.slim.json").write_bytes(body)
                print(f"[{code}] {len(body)/1e6:5.2f}MB ({len(slim)}件) -> {out_dir / 'target.slim.json'}", flush=True)
            else:
                dst = f"s3://{BUCKET}/targets/{code}/target.slim.json"
                with tempfile.TemporaryDirectory() as tmp:
                    gz_path = Path(tmp) / "target.slim.json"
                    gz_path.write_bytes(gzip.compress(body, 9))
                    subprocess.run([
                        "aws", "s3", "cp", str(gz_path), dst,
                        "--content-type", "application/json",
                        "--content-encoding", "gzip",
                        "--cache-control", "public, max-age=2592000",
                        "--only-show-errors",
                    ], check=True)
                print(f"[{code}] {raw_path.stat().st_size/1e6:6.1f}MB -> slim {len(body)/1e6:5.2f}MB -> gzip {len(gzip.compress(body,9))/1e6:5.2f}MB ({len(slim)}件)", flush=True)
    finally:
        cur.close()
        conn.close()


if __name__ == "__main__":
    main()
