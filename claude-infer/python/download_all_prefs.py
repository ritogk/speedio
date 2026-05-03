"""全都道府県のStreet View画像を順番にダウンロードするスクリプト

都道府県ごとに処理することでOOMを回避する。
skip_existingにより途中から再開可能。

使い方:
  python download_all_prefs.py                  # 全都道府県
  python download_all_prefs.py --start 26       # 26番以降から開始
  python download_all_prefs.py --only 01 03 10  # 指定した都道府県のみ
  python download_all_prefs.py --force           # 既存画像も再ダウンロード
"""

import argparse
import gc
import json
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path

from config import TARGETS_DIR, TMP_DIR, IMAGE_CONFIG


def count_target_images(pref_code: str) -> int:
    """target.jsonからダウンロード対象の座標数を取得"""
    target_path = TARGETS_DIR / pref_code / "target.json"
    if not target_path.exists():
        return 0

    try:
        with open(target_path, "r", encoding="utf-8") as f:
            entries = json.load(f)

        coords = set()
        for entry in entries:
            check_list = entry.get("geometry_check_list", [])
            if len(check_list) < 3:
                continue
            for lat, lng in check_list[1:-1]:
                coords.add((lat, lng))
        return len(coords)
    except (json.JSONDecodeError, KeyError):
        return 0


def count_existing_images(pref_code: str) -> int:
    """既にダウンロード済みの画像数を概算（target.jsonの座標とマッチ）"""
    target_path = TARGETS_DIR / pref_code / "target.json"
    if not target_path.exists():
        return 0

    try:
        with open(target_path, "r", encoding="utf-8") as f:
            entries = json.load(f)

        width = IMAGE_CONFIG["width"]
        height = IMAGE_CONFIG["height"]
        count = 0
        seen = set()

        for entry in entries:
            check_list = entry.get("geometry_check_list", [])
            if len(check_list) < 3:
                continue
            for lat, lng in check_list[1:-1]:
                key = (lat, lng)
                if key in seen:
                    continue
                seen.add(key)
                # headingは不明なので、ファイル名パターンでglob
                pattern = f"highres_{lat}_{lng}_h*_{width}x{height}.jpg"
                matches = list(TMP_DIR.glob(pattern))
                if matches:
                    count += 1
        return count
    except (json.JSONDecodeError, KeyError):
        return 0


PREF_NAMES = {
    "01": "北海道", "02": "青森", "03": "岩手", "04": "宮城", "05": "秋田",
    "06": "山形", "07": "福島", "08": "茨城", "09": "栃木", "10": "群馬",
    "11": "埼玉", "12": "千葉", "13": "東京", "14": "神奈川", "15": "新潟",
    "16": "富山", "17": "石川", "18": "福井", "19": "山梨", "20": "長野",
    "21": "岐阜", "22": "静岡", "23": "愛知", "24": "三重", "25": "滋賀",
    "26": "京都", "27": "大阪", "28": "兵庫", "29": "奈良", "30": "和歌山",
    "31": "鳥取", "32": "島根", "33": "岡山", "34": "広島", "35": "山口",
    "36": "徳島", "37": "香川", "38": "愛媛", "39": "高知", "40": "福岡",
    "41": "佐賀", "42": "長崎", "43": "熊本", "44": "大分", "45": "宮崎",
    "46": "鹿児島", "47": "沖縄",
}


def run_download(pref_code: str, force: bool = False) -> dict:
    """1つの都道府県のダウンロードをサブプロセスで実行"""
    cmd = [
        "conda", "run", "--no-capture-output", "-n", "vit-centerline",
        "python", "-u", "download_images.py",
        "--pref", pref_code,
        "--from-targets",
    ]
    if force:
        cmd.append("--force")

    start_time = time.time()
    result = subprocess.run(
        cmd,
        cwd=str(Path(__file__).parent),
        capture_output=False,
        timeout=3600,  # 1時間タイムアウト
    )
    elapsed = time.time() - start_time

    return {
        "pref_code": pref_code,
        "returncode": result.returncode,
        "elapsed": elapsed,
    }


def main():
    parser = argparse.ArgumentParser(description="全都道府県のStreet View画像ダウンロード")
    parser.add_argument("--start", type=str, default="01", help="開始都道府県コード（デフォルト: 01）")
    parser.add_argument("--end", type=str, default="47", help="終了都道府県コード（デフォルト: 47）")
    parser.add_argument("--only", type=str, nargs="+", help="指定した都道府県のみ実行")
    parser.add_argument("--force", action="store_true", help="既存画像も再ダウンロード")
    parser.add_argument("--dry-run", action="store_true", help="実行せずDL状況のみ表示")
    args = parser.parse_args()

    # 対象都道府県を決定
    if args.only:
        pref_codes = [p.zfill(2) for p in args.only]
    else:
        start = int(args.start)
        end = int(args.end)
        pref_codes = [f"{i:02d}" for i in range(start, end + 1)]

    print(f"{'='*60}")
    print(f"全都道府県ダウンロード {'(dry-run)' if args.dry_run else ''}")
    print(f"対象: {len(pref_codes)}都道府県")
    print(f"開始: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'='*60}")

    # 状況一覧表示
    print(f"\n{'コード':>4} {'都道府県':<6} {'ターゲット':>8} {'DL済':>8} {'残り':>8} {'進捗':>6}")
    print("-" * 50)

    total_targets = 0
    total_existing = 0
    pref_status = []

    for pref in pref_codes:
        target_path = TARGETS_DIR / pref / "target.json"
        if not target_path.exists():
            print(f"  {pref}  {PREF_NAMES.get(pref, '???'):<6} target.json なし - スキップ")
            continue

        targets = count_target_images(pref)
        existing = count_existing_images(pref)
        remaining = targets - existing
        pct = (existing / targets * 100) if targets > 0 else 0

        total_targets += targets
        total_existing += existing

        status = "完了" if remaining == 0 else ""
        print(f"  {pref}  {PREF_NAMES.get(pref, '???'):<6} {targets:>8} {existing:>8} {remaining:>8} {pct:>5.1f}% {status}")
        pref_status.append((pref, targets, existing, remaining))

    total_remaining = total_targets - total_existing
    total_pct = (total_existing / total_targets * 100) if total_targets > 0 else 0
    print("-" * 50)
    print(f"  合計{' '*13} {total_targets:>8} {total_existing:>8} {total_remaining:>8} {total_pct:>5.1f}%")

    if args.dry_run:
        print("\n(dry-run モード: 実際のダウンロードは行いません)")
        return

    # 残りがある都道府県のみ実行
    to_download = [(pref, targets, remaining) for pref, targets, _, remaining in pref_status if remaining > 0]

    if not to_download:
        print("\n全都道府県のダウンロードが完了しています。")
        return

    print(f"\n{len(to_download)}都道府県のダウンロードを開始します...")
    print(f"{'='*60}\n")

    results = []
    for i, (pref, targets, remaining) in enumerate(to_download, 1):
        name = PREF_NAMES.get(pref, "???")
        print(f"\n[{i}/{len(to_download)}] {pref} {name} ({remaining}件残り)")
        print("-" * 40)

        try:
            result = run_download(pref, force=args.force)
            results.append(result)

            if result["returncode"] == 0:
                print(f"  -> 完了 ({result['elapsed']:.0f}秒)")
            else:
                print(f"  -> エラー (code={result['returncode']}, {result['elapsed']:.0f}秒)")

        except subprocess.TimeoutExpired:
            print(f"  -> タイムアウト (1時間超過)")
            results.append({"pref_code": pref, "returncode": -1, "elapsed": 3600})

        except Exception as e:
            print(f"  -> 例外: {e}")
            results.append({"pref_code": pref, "returncode": -1, "elapsed": 0})

        # メモリ解放
        gc.collect()

    # 結果サマリ
    print(f"\n{'='*60}")
    print("実行結果サマリ")
    print(f"{'='*60}")

    success = [r for r in results if r["returncode"] == 0]
    failed = [r for r in results if r["returncode"] != 0]
    total_time = sum(r["elapsed"] for r in results)

    print(f"  成功: {len(success)}都道府県")
    print(f"  失敗: {len(failed)}都道府県")
    print(f"  合計時間: {total_time/60:.1f}分")

    if failed:
        print("\n失敗した都道府県:")
        for r in failed:
            name = PREF_NAMES.get(r["pref_code"], "???")
            print(f"  {r['pref_code']} {name} (code={r['returncode']})")

    print(f"\n完了: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")


if __name__ == "__main__":
    main()
