#!/usr/bin/env python3
"""
S3上の targets/{pref}/target.json からビュワー(index_3.html)用の軽量版
target.slim.json を生成し、gzip圧縮(+Content-Encoding: gzip)でS3に併置する。

- 元の target.json は変更しない（バックアップ: targets_bk_20260611/）
- CloudFrontの自動圧縮は10MB超で効かないため、事前gzipで配信する
- 座標は小数5桁(≈1m精度)に丸める

usage: python3 build_slim_targets.py [pref_code ...]   # 省略時は全県
"""
import gzip
import json
import subprocess
import sys
import tempfile
from pathlib import Path

import psycopg2
from shapely import wkt
from shapely.geometry import LineString

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from analyzer.analysis.column_generater_module.core.linstring_to_polygon import create_vertical_polygon


BUCKET = "speedio-old-viewer-788594208758"
LOCAL_TARGETS = Path(__file__).resolve().parents[2] / "data" / "targets"
PREFS = [f"{i:02d}" for i in range(1, 48)]


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


def slim_touge(t, cur=None):
    fluct = t.get("elevation_fluctuation")
    if fluct is None:
        fluct = elevation_fluctuation(t.get("elevation_smooth"))
    buildings = fetch_buildings_nearby(cur, t.get("geometry_list")) if cur else []
    return {
        "length": t.get("length"),
        "highway": t.get("highway"),
        "name": t.get("name"),
        "elevation_height": t.get("elevation_height"),
        "score_elevation": t.get("score_elevation"),
        "score_elevation_unevenness": t.get("score_elevation_unevenness"),
        "score_width": t.get("score_width"),
        "score_claude_center_line_section": t.get("score_claude_center_line_section"),
        "score_corner_none": t.get("score_corner_none"),
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
    prefs = sys.argv[1:] or PREFS
    conn = psycopg2.connect(host="localhost", dbname="speedia", user="postgres", password="postgres")
    cur = conn.cursor()
    try:
        for code in prefs:
            raw_path = LOCAL_TARGETS / code / "target.json"
            if not raw_path.exists():
                print(f"[{code}] SKIP (local target.json not found)")
                continue
            dst = f"s3://{BUCKET}/targets/{code}/target.slim.json"
            data = json.loads(raw_path.read_text())
            slim = [slim_touge(t, cur) for t in data]
            body = json.dumps(slim, ensure_ascii=False, separators=(",", ":")).encode()
            with tempfile.TemporaryDirectory() as tmp:
                gz_path = Path(tmp) / "target.slim.json"
                gz_path.write_bytes(gzip.compress(body, 9))
                subprocess.run([
                    "aws", "s3", "cp", str(gz_path), dst,
                    "--content-type", "application/json",
                    "--content-encoding", "gzip",
                    "--cache-control", "public, max-age=86400",
                    "--only-show-errors",
                ], check=True)
            print(f"[{code}] {raw_path.stat().st_size/1e6:6.1f}MB -> slim {len(body)/1e6:5.2f}MB -> gzip {len(gzip.compress(body,9))/1e6:5.2f}MB ({len(slim)}件)")
    finally:
        cur.close()
        conn.close()


if __name__ == "__main__":
    main()
