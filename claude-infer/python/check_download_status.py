#!/usr/bin/env python3
"""Check download status of Street View images per prefecture."""

import json
import os
import psycopg2

TARGETS_DIR = "/home/ubuntu/speedio/html/targets"
IMAGE_DIR = "/home/ubuntu/speedio/claude-infer/tmp"


def build_image_index():
    """Build a set of (lat, lng) keys from downloaded images."""
    index = set()
    for fname in os.listdir(IMAGE_DIR):
        if not fname.startswith("highres_") or not fname.endswith(".jpg"):
            continue
        parts = fname.split("_")
        if len(parts) >= 3:
            lat = parts[1]
            lng = parts[2]
            index.add((lat, lng))
    return index


def check_targets():
    """Check each prefecture's target.json for downloaded images."""
    image_index = build_image_index()
    print(f"Total unique (lat, lng) pairs in image cache: {len(image_index)}")
    print()

    results = []

    for pref_code in sorted(os.listdir(TARGETS_DIR)):
        target_file = os.path.join(TARGETS_DIR, pref_code, "target.json")
        if not os.path.exists(target_file):
            continue

        try:
            with open(target_file) as f:
                data = json.load(f)
        except Exception as e:
            print(f"  Error reading {target_file}: {e}")
            continue

        total_coords = 0
        downloaded = 0

        for entry in data:
            check_list = entry.get("geometry_check_list", [])
            for coord in check_list:
                lat, lng = coord[0], coord[1]
                total_coords += 1
                if (str(lat), str(lng)) in image_index:
                    downloaded += 1

        pct = (downloaded / total_coords * 100) if total_coords > 0 else 0
        results.append((pref_code, len(data), total_coords, downloaded, pct))

    return results


def check_db():
    """Check DB locations table for center_line data."""
    conn = psycopg2.connect(
        host="localhost", database="speedia",
        user="postgres", password="postgres"
    )
    cur = conn.cursor()

    cur.execute("""
        SELECT
            COUNT(*) as total,
            COUNT(has_center_line) as labeled,
            SUM(CASE WHEN has_center_line = true THEN 1 ELSE 0 END) as cl_true,
            SUM(CASE WHEN has_center_line = false THEN 1 ELSE 0 END) as cl_false,
            COUNT(claude_center_line) as claude_labeled,
            SUM(CASE WHEN claude_center_line = true THEN 1 ELSE 0 END) as ccl_true,
            SUM(CASE WHEN claude_center_line = false THEN 1 ELSE 0 END) as ccl_false
        FROM locations
    """)
    overall = cur.fetchone()

    # Try to group by approximate prefecture using longitude/latitude ranges
    # We can use the point geometry to get lat/lng
    cur.execute("""
        SELECT
            COUNT(*) as total,
            COUNT(has_center_line) as labeled,
            COUNT(claude_center_line) as claude_labeled
        FROM locations
        WHERE has_center_line IS NOT NULL
    """)
    labeled_stats = cur.fetchone()

    cur.close()
    conn.close()
    return overall, labeled_stats


def main():
    # ---- Target-based image download status ----
    print("=" * 105)
    print("STREET VIEW IMAGE DOWNLOAD STATUS (from target.json / geometry_check_list)")
    print("=" * 105)
    print(f"{'Pref':>4}  {'Roads':>6}  {'CheckPts':>10}  {'Downloaded':>10}  {'Pct':>7}  {'Status'}")
    print("-" * 105)

    results = check_targets()
    total_coords_all = 0
    total_downloaded_all = 0

    for pref_code, num_roads, total_coords, downloaded, pct in results:
        total_coords_all += total_coords
        total_downloaded_all += downloaded

        if pct >= 99.5:
            status = "DONE"
        elif pct >= 75:
            status = "MOSTLY"
        elif pct > 0:
            status = "PARTIAL"
        else:
            status = "NONE"

        print(f"{pref_code:>4}  {num_roads:>6}  {total_coords:>10}  {downloaded:>10}  {pct:>6.1f}%  {status}")

    overall_pct = (total_downloaded_all / total_coords_all * 100) if total_coords_all > 0 else 0
    print("-" * 105)
    print(f"{'ALL':>4}  {'':>6}  {total_coords_all:>10}  {total_downloaded_all:>10}  {overall_pct:>6.1f}%")

    # ---- DB status ----
    print()
    print("=" * 105)
    print("DATABASE STATUS (locations table)")
    print("=" * 105)

    overall, labeled_stats = check_db()
    total, labeled, cl_true, cl_false, claude_labeled, ccl_true, ccl_false = overall

    print(f"  Total rows:              {total:>8}")
    print(f"  has_center_line labeled:  {labeled:>8}  (TRUE: {cl_true}, FALSE: {cl_false})")
    print(f"  claude_center_line done:  {claude_labeled:>8}  (TRUE: {ccl_true}, FALSE: {ccl_false})")

    # ---- Summary ----
    print()
    print("=" * 105)
    print("SUMMARY")
    print("=" * 105)

    done = [r for r in results if r[4] >= 99.5]
    mostly = [r for r in results if 75 <= r[4] < 99.5]
    partial = [r for r in results if 0 < r[4] < 75]
    not_started = [r for r in results if r[4] == 0]

    print(f"  Done (>= 99.5%):   [{len(done):>2}]  {', '.join(r[0] for r in done) or '(none)'}")
    print(f"  Mostly (>= 75%):   [{len(mostly):>2}]  {', '.join(r[0] for r in mostly) or '(none)'}")
    print(f"  Partial (< 75%):   [{len(partial):>2}]  {', '.join(f'{r[0]}({r[4]:.0f}%)' for r in partial)}")
    print(f"  Not started (0%):  [{len(not_started):>2}]  {', '.join(r[0] for r in not_started)}")


if __name__ == "__main__":
    main()
