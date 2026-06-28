#!/usr/bin/env python3
"""
Overpass APIから国道・県道の路線ラインデータを取得し、県別GeoJSONを生成する。

出力:
  route_numbers/{code}.geojson — ref付き幹線道路のラインデータ（同一ref+highwayをMultiLineStringにマージ）

使用例:
  python generate_route_numbers.py 21          # 岐阜県のみ
  python generate_route_numbers.py             # 全47県
  python generate_route_numbers.py --skip-existing  # 既存ファイルをスキップ
"""

import json
import math
import time
import sys
import urllib.request
import urllib.parse
from collections import defaultdict
from pathlib import Path

OVERPASS_ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.openstreetmap.fr/api/interpreter",
]

PREFECTURES = {
    "01": "北海道", "02": "青森県", "03": "岩手県", "04": "宮城県", "05": "秋田県",
    "06": "山形県", "07": "福島県", "08": "茨城県", "09": "栃木県", "10": "群馬県",
    "11": "埼玉県", "12": "千葉県", "13": "東京都", "14": "神奈川県", "15": "新潟県",
    "16": "富山県", "17": "石川県", "18": "福井県", "19": "山梨県", "20": "長野県",
    "21": "岐阜県", "22": "静岡県", "23": "愛知県", "24": "三重県", "25": "滋賀県",
    "26": "京都府", "27": "大阪府", "28": "兵庫県", "29": "奈良県", "30": "和歌山県",
    "31": "鳥取県", "32": "島根県", "33": "岡山県", "34": "広島県", "35": "山口県",
    "36": "徳島県", "37": "香川県", "38": "愛媛県", "39": "高知県", "40": "福岡県",
    "41": "佐賀県", "42": "長崎県", "43": "熊本県", "44": "大分県", "45": "宮崎県",
    "46": "鹿児島県", "47": "沖縄県",
}

PREF_BBOX = {
    "01":(41.33,139.33,45.56,145.82),"02":(40.22,139.49,41.56,141.69),"03":(38.73,139.02,40.47,142.08),
    "04":(37.77,140.27,39.00,141.68),"05":(38.87,139.70,40.52,140.99),"06":(37.73,139.53,39.21,140.64),
    "07":(36.79,139.16,37.97,141.05),"08":(35.73,139.69,36.97,140.85),"09":(36.19,139.32,37.16,140.29),
    "10":(35.99,138.43,37.06,139.68),"11":(35.75,138.91,36.29,139.92),"12":(34.90,139.74,36.11,140.87),
    "13":(35.50,138.94,35.90,139.92),"14":(35.12,138.91,35.67,139.79),"15":(36.73,137.84,38.56,140.04),
    "16":(36.27,136.77,37.00,137.77),"17":(36.07,136.24,37.86,137.40),"18":(35.36,135.47,36.29,136.83),
    "19":(35.18,138.16,35.96,139.15),"20":(35.19,137.32,37.03,138.73),"21":(35.14,136.27,36.47,137.66),
    "22":(34.58,137.47,35.64,139.18),"23":(34.57,136.67,35.43,137.84),"24":(33.73,135.85,35.17,137.04),
    "25":(34.77,135.75,35.71,136.47),"26":(34.77,134.85,35.78,136.06),"27":(34.27,135.07,35.05,135.75),
    "28":(34.15,134.25,35.68,135.47),"29":(33.85,135.55,34.78,136.24),"30":(33.43,135.07,34.38,136.02),
    "31":(35.05,133.15,35.62,134.52),"32":(34.07,131.66,36.35,133.39),"33":(34.38,133.30,35.35,134.41),
    "34":(33.92,132.05,35.12,133.40),"35":(33.74,130.82,34.78,132.27),"36":(33.55,133.46,34.27,134.81),
    "37":(34.05,133.42,34.91,134.45),"38":(32.90,132.01,34.16,133.68),"39":(32.70,132.48,33.88,134.31),
    "40":(33.00,130.02,34.25,131.19),"41":(32.97,129.73,33.60,130.55),"42":(32.57,128.56,34.67,130.32),
    "43":(31.95,129.98,33.24,131.30),"44":(32.71,130.82,33.75,132.12),"45":(31.36,130.68,32.94,131.89),
    "46":(27.01,128.40,32.32,131.21),"47":(24.04,122.93,27.89,131.33),
}

OUT_DIR = Path(__file__).parent / "route_numbers"


def overpass_query(query: str, retries: int = 3) -> dict:
    data = urllib.parse.urlencode({"data": query}).encode()
    for endpoint in OVERPASS_ENDPOINTS:
        for attempt in range(retries):
            try:
                req = urllib.request.Request(endpoint, data=data, headers={
                    "Content-Type": "application/x-www-form-urlencoded",
                    "User-Agent": "speedio-route-generator/1.0",
                })
                with urllib.request.urlopen(req, timeout=180) as resp:
                    return json.loads(resp.read().decode())
            except Exception as e:
                wait = 10 * (attempt + 1)
                print(f"  retry {attempt+1}/{retries} ({endpoint}): {e}, waiting {wait}s")
                time.sleep(wait)
    raise RuntimeError("All Overpass endpoints failed")


SIMPLIFY_TOLERANCE = 0.0003  # ~30m at mid-latitudes
MIN_LINE_LENGTH = 0.001  # ~100m — drop shorter segments
COORD_PRECISION = 4  # decimal places (~11m)


def _perpendicular_dist(px, py, ax, ay, bx, by):
    dx, dy = bx - ax, by - ay
    if dx == 0 and dy == 0:
        return math.hypot(px - ax, py - ay)
    t = max(0, min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
    return math.hypot(px - (ax + t * dx), py - (ay + t * dy))


def simplify_line(coords: list, tolerance: float) -> list:
    if len(coords) <= 2:
        return coords
    max_dist = 0
    max_idx = 0
    ax, ay = coords[0]
    bx, by = coords[-1]
    for i in range(1, len(coords) - 1):
        d = _perpendicular_dist(coords[i][0], coords[i][1], ax, ay, bx, by)
        if d > max_dist:
            max_dist = d
            max_idx = i
    if max_dist > tolerance:
        left = simplify_line(coords[:max_idx + 1], tolerance)
        right = simplify_line(coords[max_idx:], tolerance)
        return left[:-1] + right
    return [coords[0], coords[-1]]


def line_length(coords: list) -> float:
    total = 0
    for i in range(len(coords) - 1):
        total += math.hypot(coords[i+1][0] - coords[i][0], coords[i+1][1] - coords[i][1])
    return total


def merge_contiguous(lines: list[list]) -> list[list]:
    if len(lines) <= 1:
        return lines
    end_map: dict[tuple, int] = {}
    chains: list[list | None] = []
    for line in lines:
        start = tuple(line[0])
        end = tuple(line[-1])
        if start in end_map and chains[end_map[start]] is not None:
            idx = end_map[start]
            chain = chains[idx]
            del end_map[start]
            chain.extend(line[1:])
            end_map[tuple(chain[-1])] = idx
        else:
            idx = len(chains)
            chains.append(list(line))
            end_map[end] = idx
    return [c for c in chains if c is not None]


def make_label(ref: str, highway: str) -> str:
    if highway in ("trunk", "primary"):
        return f"R{ref}"
    return f"県{ref}"


def fetch_route_numbers(code: str) -> list[dict]:
    s, w, n, e = PREF_BBOX[code]
    query = f"""[out:json][timeout:120];
way["highway"~"^(trunk|primary|secondary|tertiary)$"]["ref"]({s},{w},{n},{e});
out geom;"""
    result = overpass_query(query)

    groups = defaultdict(list)
    for el in result.get("elements", []):
        if el.get("type") != "way":
            continue
        geom = el.get("geometry", [])
        if len(geom) < 2:
            continue
        tags = el.get("tags") or {}
        ref = tags.get("ref", "")
        highway = tags.get("highway", "")
        if not ref:
            continue
        # ref can contain multiple values like "102;202" — split and create entries for each
        for r in ref.split(";"):
            r = r.strip()
            if r:
                coords = [[round(p["lon"], COORD_PRECISION), round(p["lat"], COORD_PRECISION)] for p in geom]
                coords = simplify_line(coords, SIMPLIFY_TOLERANCE)
                if len(coords) >= 2 and line_length(coords) >= MIN_LINE_LENGTH:
                    groups[(r, highway)].append(coords)

    features = []
    for (ref, highway), lines in sorted(groups.items()):
        merged = merge_contiguous(lines)
        features.append({
            "type": "Feature",
            "properties": {
                "ref": ref,
                "highway": highway,
                "label": make_label(ref, highway),
            },
            "geometry": {
                "type": "MultiLineString",
                "coordinates": merged,
            },
        })
    return features


def main():
    skip_existing = "--skip-existing" in sys.argv
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    codes = args if args else sorted(PREFECTURES.keys())

    OUT_DIR.mkdir(exist_ok=True)

    for code in codes:
        name = PREFECTURES.get(code)
        if not name:
            print(f"Unknown code: {code}")
            continue

        out_path = OUT_DIR / f"{code}.geojson"
        if skip_existing and out_path.exists():
            print(f"[{code}] {name} ... skip (exists)")
            continue

        print(f"[{code}] {name} ...", end="", flush=True)
        features = fetch_route_numbers(code)
        geojson = {"type": "FeatureCollection", "features": features}
        out_path.write_text(json.dumps(geojson, ensure_ascii=False), encoding="utf-8")
        size_kb = out_path.stat().st_size / 1024
        print(f" {len(features)} routes ({size_kb:.0f} KB)")

        if len(codes) > 1:
            time.sleep(5)

    print("Done!")


if __name__ == "__main__":
    main()
