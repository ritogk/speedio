"""国交省 道路情報提供システムから通行止め情報をスクレイピングする.

データ取得:
  1. 9つの地方整備局HTMLページ → 路線名・区間・日付・都道府県
  2. メッシュJSON (TukoKisei) → 緯度経度座標
  3. ID で結合 → 座標付き通行止めデータ

ローカル実行:
    python3 pipeline/road_closure/scrape.py
    → tools/viewer/road_closures/{pref_code}.json

Lambda実行:
    handler: scrape.lambda_handler
    → S3 road_closures/{pref_code}.json
"""

import json
import os
import re
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone, timedelta
from pathlib import Path

JST = timezone(timedelta(hours=9))
USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"

PREF_NAMES = {
    "01": "北海道", "02": "青森県", "03": "岩手県", "04": "宮城県",
    "05": "秋田県", "06": "山形県", "07": "福島県", "08": "茨城県",
    "09": "栃木県", "10": "群馬県", "11": "埼玉県", "12": "千葉県",
    "13": "東京都", "14": "神奈川県", "15": "新潟県", "16": "富山県",
    "17": "石川県", "18": "福井県", "19": "山梨県", "20": "長野県",
    "21": "岐阜県", "22": "静岡県", "23": "愛知県", "24": "三重県",
    "25": "滋賀県", "26": "京都府", "27": "大阪府", "28": "兵庫県",
    "29": "奈良県", "30": "和歌山県", "31": "鳥取県", "32": "島根県",
    "33": "岡山県", "34": "広島県", "35": "山口県", "36": "徳島県",
    "37": "香川県", "38": "愛媛県", "39": "高知県", "40": "福岡県",
    "41": "佐賀県", "42": "長崎県", "43": "熊本県", "44": "大分県",
    "45": "宮崎県", "46": "鹿児島県", "47": "沖縄県",
}
NAME_TO_CODE = {v: k for k, v in PREF_NAMES.items()}

BUREAU_AREAS = [
    ("81", "北海道"),
    ("82", "東北"),
    ("83", "関東"),
    ("84", "北陸"),
    ("85", "中部"),
    ("86", "近畿"),
    ("87", "中国"),
    ("88", "四国"),
    ("89", "九州"),
]

LIST_URL = "https://www.road-info-prvs.mlit.go.jp/roadinfo/pc/pcTukokiseiList_{area}_1.html"
PAGE_URL = "https://www.road-info-prvs.mlit.go.jp/roadinfo/pc/pcTukokisei_81_1.html"


def _request(url: str, timeout: int = 15) -> bytes:
    req = urllib.request.Request(url, headers={
        "User-Agent": USER_AGENT,
        "Referer": PAGE_URL,
    })
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read()


# ── Step 1: HTML → テキストデータ + ID ────────────────────────


def _detect_pref(item_name: str, area_code: str) -> str | None:
    if area_code == "81":
        return "01"
    return NAME_TO_CODE.get(item_name)


def parse_html_closures(html: str, area_code: str) -> dict[str, list]:
    result: dict[str, list] = {}
    sections = re.split(r'class="itemName">', html)

    for section in sections[1:]:
        name_match = re.match(r"([^<]+)<", section)
        if not name_match:
            continue
        pref_code = _detect_pref(name_match.group(1).strip(), area_code)
        if not pref_code:
            continue

        rows = re.findall(
            r'<tr\s+class="roadClosed[^"]*">(.*?)</tr>\s*<tr[^>]*>(.*?)</tr>',
            section, re.DOTALL,
        )
        for header, detail in rows:
            if "icon_stop" not in header:
                continue

            cause = "construction" if "icon_stop_kouji" in header else "disaster"
            tid_m = re.search(r"listMarkerClickEvent\('([^']+)'\)", header)
            tid = tid_m.group(1) if tid_m else None

            cells_h = re.findall(r"<td[^>]*>(.*?)</td>", header, re.DOTALL)
            cells_d = re.findall(r"<td[^>]*>(.*?)</td>", detail, re.DOTALL)

            def clean(s: str) -> str:
                return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", s).replace("\n", "")).strip()

            if len(cells_h) < 5:
                continue

            road = clean(cells_h[1])
            start_loc = clean(cells_h[2]).removeprefix("始：")
            start_date = clean(cells_h[3])
            end_date_raw = clean(cells_h[4])
            end_date = None if "--/--/--" in end_date_raw else end_date_raw or None
            length_str = clean(cells_h[5]) if len(cells_h) > 5 else ""
            length_m = re.search(r"([\d.]+)", length_str)
            length_km = float(length_m.group(1)) if length_m else None
            end_loc = clean(cells_d[0]).removeprefix("終：") if cells_d else ""

            entry = {
                "id": tid,
                "road": road,
                "cause": cause,
                "start_loc": start_loc,
                "end_loc": end_loc,
                "start_date": start_date,
                "end_date": end_date,
                "length_km": length_km,
            }
            result.setdefault(pref_code, []).append(entry)

    return result


def scrape_html() -> tuple[dict[str, list], str]:
    """全HTMLページをスクレイピング。backup_path も返す。"""
    all_closures: dict[str, list] = {}
    backup_path = ""

    for area_code, region_name in BUREAU_AREAS:
        print(f"  html: {region_name} ({area_code})...", flush=True)
        try:
            html = _request(LIST_URL.format(area=area_code)).decode("utf-8", errors="replace")
            closures = parse_html_closures(html, area_code)
            for pref_code, entries in closures.items():
                all_closures.setdefault(pref_code, []).extend(entries)

            if not backup_path:
                page_html = _request(
                    f"https://www.road-info-prvs.mlit.go.jp/roadinfo/pc/pcTukokisei_{area_code}_1.html"
                ).decode("utf-8", errors="replace")
                m = re.search(r"(backup/\d+/[^/]+/)", page_html)
                if m:
                    backup_path = m.group(1)
        except Exception as e:
            print(f"  ERROR html {region_name}: {e}", flush=True)
        time.sleep(1)

    return all_closures, backup_path


# ── Step 2: メッシュJSON → 座標 ───────────────────────────────


def _japan_mesh_codes() -> list[str]:
    """日本の陸地を覆うプライマリメッシュコード一覧."""
    codes = []
    for lat_code in range(36, 69):
        for lng_code in range(22, 54):
            codes.append(f"{lat_code}{lng_code}")
    return codes


def _fetch_mesh(mesh: str, base_url: str) -> list[dict]:
    """1メッシュのTukoKisei JSONを取得し、通行止めエントリのみ返す."""
    url = f"{base_url}/{mesh}.json"
    try:
        data = _request(url, timeout=10)
        if len(data) <= 2:
            return []
        items = json.loads(data)
        results = []
        for item in items:
            icon = item.get("iconData", {})
            icon_name = icon.get("icon_name", "")
            if "icon_stop" not in icon_name:
                continue
            point = icon.get("point", [])
            if len(point) < 2:
                continue
            results.append({
                "id": item.get("same_tukokisei_info_id"),
                "lng": float(point[0]),
                "lat": float(point[1]),
                "cause": "construction" if "kouji" in icon_name else "disaster",
            })
        return results
    except Exception:
        return []


def scrape_mesh_coords(backup_path: str) -> dict[str, dict]:
    """全メッシュをスキャンして id→{lat,lng} マッピングを返す."""
    base_url = f"https://www.road-info-prvs.mlit.go.jp/roadinfo/{backup_path}TukoKisei"
    meshes = _japan_mesh_codes()
    coord_map: dict[str, dict] = {}

    print(f"  mesh: scanning {len(meshes)} meshes (parallel)...", flush=True)
    with ThreadPoolExecutor(max_workers=20) as pool:
        futures = {pool.submit(_fetch_mesh, m, base_url): m for m in meshes}
        for future in as_completed(futures):
            for entry in future.result():
                if entry["id"]:
                    coord_map[entry["id"]] = {
                        "lat": entry["lat"],
                        "lng": entry["lng"],
                    }

    print(f"  mesh: found {len(coord_map)} closure coordinates", flush=True)
    return coord_map


# ── Step 3: マージ + 出力 ──────────────────────────────────────


def merge_and_build(
    html_data: dict[str, list],
    coord_map: dict[str, dict],
    updated: str,
) -> dict[str, dict]:
    """HTML データに座標を結合して都道府県別出力を生成."""
    outputs: dict[str, dict] = {}

    for pref_code in sorted(PREF_NAMES.keys()):
        closures = html_data.get(pref_code, [])
        merged = []
        for c in closures:
            entry = {k: v for k, v in c.items() if k != "id"}
            coords = coord_map.get(c.get("id", ""))
            if coords:
                entry["lat"] = round(coords["lat"], 6)
                entry["lng"] = round(coords["lng"], 6)
            merged.append(entry)
        outputs[pref_code] = {
            "updated": updated,
            "prefecture": PREF_NAMES[pref_code],
            "closures": merged,
        }

    return outputs


def save_local(outputs: dict[str, dict]):
    out_dir = Path(__file__).resolve().parent.parent.parent / "tools" / "viewer" / "road_closures"
    out_dir.mkdir(exist_ok=True)
    total = 0
    for pref_code, data in outputs.items():
        path = out_dir / f"{pref_code}.json"
        path.write_text(
            json.dumps(data, ensure_ascii=False, separators=(",", ":")),
            encoding="utf-8",
        )
        total += len(data["closures"])
    with_coords = sum(
        1 for d in outputs.values()
        for c in d["closures"] if "lat" in c
    )
    print(f"done: {total} closures ({with_coords} with coords) → {out_dir}")


def save_s3(outputs: dict[str, dict]):
    import boto3

    bucket = os.environ["S3_BUCKET"]
    prefix = os.environ.get("S3_PREFIX", "road_closures")
    s3 = boto3.client("s3")

    total = 0
    for pref_code, data in outputs.items():
        body = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
        s3.put_object(
            Bucket=bucket,
            Key=f"{prefix}/{pref_code}.json",
            Body=body.encode("utf-8"),
            ContentType="application/json; charset=utf-8",
            CacheControl="max-age=3600",
        )
        total += len(data["closures"])

    print(f"done: {total} closures → s3://{bucket}/{prefix}/")


def run():
    updated = datetime.now(JST).strftime("%Y-%m-%dT%H:%M:%S")

    html_data, backup_path = scrape_html()
    if not backup_path:
        print("ERROR: could not find backup path", flush=True)
        return html_data, {}

    coord_map = scrape_mesh_coords(backup_path)
    outputs = merge_and_build(html_data, coord_map, updated)
    return outputs


def lambda_handler(event=None, context=None):
    print("start scraping road closures")
    outputs = run()
    save_s3(outputs)
    total = sum(len(d["closures"]) for d in outputs.values())
    return {"statusCode": 200, "body": f"{total} closures saved"}


if __name__ == "__main__":
    print("scraping road closures...")
    outputs = run()
    save_local(outputs)
