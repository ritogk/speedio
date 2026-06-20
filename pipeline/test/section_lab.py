#!/usr/bin/env python3
"""
セクション分割の実験用モジュール

本宮山スカイラインのOSMラインを読み込み、平面直角座標に変換して描画する。

usage: uv run --directory pipeline/analyzer python pipeline/test/section_lab.py
"""
import json
import os
import subprocess
import numpy as np
from pyproj import Transformer
import matplotlib.pyplot as plt

DATA_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(DATA_DIR, "..", ".."))
TARGET_FILE = os.path.join(PROJECT_ROOT, "data/targets/23/target.json")

EPSG_PLANE = 6677

# ===== 調整パラメータ =====
MIN_ANGLE_DEG = 2.0       # この角度未満の曲がりは「前の方向を維持」(デッドゾーン)
MIN_RUN = 2               # この点数未満の区間は隣にマージ
STRAIGHT_ANGLE_DEG = 3.0  # ストレート判定: 各セグメントの角度がこれ未満なら直線とみなす
STRAIGHT_MIN_DIST = 100.0 # ストレート判定: 最低距離(m)


# ========== データ読み込み ==========

def load_hongusan_geometry():
    with open(TARGET_FILE) as f:
        data = json.load(f)
    for item in data:
        if "本宮山" in item.get("name", ""):
            return item["geometry_list"]
    raise RuntimeError("本宮山スカイラインが見つかりません")


def to_plane_coords(geometry_list):
    """geometry_list ([lat, lng]) → 平面直角座標 (メートル) に変換"""
    coords = [(lng, lat) for lat, lng in geometry_list]
    transformer = Transformer.from_crs(4326, EPSG_PLANE)
    return np.array(list(transformer.itransform(coords, switch=True)))


# ========== ライン整形 ==========

def calc_angles(xy):
    """連続する3点から角度(度)と外積を計算して返す。"""
    angles = []
    for i in range(len(xy) - 2):
        v1 = xy[i + 1] - xy[i]
        v2 = xy[i + 2] - xy[i + 1]
        cross = v1[0] * v2[1] - v1[1] * v2[0]
        dot = v1[0] * v2[0] + v1[1] * v2[1]
        angle_deg = abs(np.degrees(np.arctan2(cross, dot)))
        angles.append({"angle": angle_deg, "cross": cross})
    return angles


def calc_directions(xy, min_angle_deg=0.0):
    """連続する3点から左右の方向を判定。min_angle_deg未満は前の方向を維持。"""
    angles = calc_angles(xy)
    directions = []
    prev_dir = "straight"
    for a in angles:
        if a["angle"] < min_angle_deg:
            directions.append(prev_dir)
        elif a["cross"] > 0:
            prev_dir = "left"
            directions.append("left")
        elif a["cross"] < 0:
            prev_dir = "right"
            directions.append("right")
        else:
            directions.append(prev_dir)
    return directions


def smooth_directions(directions, min_run=2):
    """短すぎる区間(min_run未満)を前の区間にマージ。"""
    if min_run < 2:
        return directions

    runs = []
    cur = directions[0]
    start = 0
    for i in range(1, len(directions)):
        if directions[i] != cur:
            runs.append({"dir": cur, "start": start, "end": i})
            cur = directions[i]
            start = i
    runs.append({"dir": cur, "start": start, "end": len(directions)})

    changed = True
    while changed:
        changed = False
        new_runs = []
        for r in runs:
            length = r["end"] - r["start"]
            if length < min_run and new_runs:
                new_runs[-1]["end"] = r["end"]
                changed = True
            else:
                new_runs.append(r)
        runs = new_runs

    result = directions[:]
    for r in runs:
        for i in range(r["start"], r["end"]):
            result[i] = r["dir"]
    return result


def normalize_directions(xy, min_angle_deg=MIN_ANGLE_DEG, min_run=MIN_RUN):
    """ライン整形: デッドゾーン + 短区間マージで方向のブレを除去して返す。"""
    dirs = calc_directions(xy, min_angle_deg=min_angle_deg)
    dirs = smooth_directions(dirs, min_run=min_run)
    return dirs


# ========== セクション分割 ==========

def segment_distance(xy, start, end):
    """xy[start] ~ xy[end] の距離(m)を計算。"""
    dist = 0.0
    for i in range(start, end):
        dist += np.linalg.norm(xy[i + 1] - xy[i])
    return dist


def find_straight_ranges(xy, angles, straight_angle_deg=STRAIGHT_ANGLE_DEG, straight_min_dist=STRAIGHT_MIN_DIST):
    """確実なストレート区間を厳しめに抽出。(start, end) のリストを返す。"""
    n = len(angles)
    straights = []
    i = 0
    while i < n:
        if angles[i]["angle"] < straight_angle_deg:
            j = i
            while j < n and angles[j]["angle"] < straight_angle_deg:
                j += 1
            dist = segment_distance(xy, i, j + 1)
            if dist >= straight_min_dist:
                straights.append((i, j))
            i = j
        else:
            i += 1
    return straights


def extract_sections(xy, directions, angles, straight_angle_deg=STRAIGHT_ANGLE_DEG, straight_min_dist=STRAIGHT_MIN_DIST):
    """ストレート区間を抽出し、残りを左右区間として確定する。"""
    n = len(directions)

    is_straight_candidate = [angles[i]["angle"] < straight_angle_deg for i in range(n)]

    sections = []
    i = 0
    while i < n:
        if is_straight_candidate[i]:
            j = i
            while j < n and is_straight_candidate[j]:
                j += 1
            dist = segment_distance(xy, i, j + 1)
            if dist >= straight_min_dist:
                sections.append({"type": "straight", "start": i, "end": j})
            else:
                for k in range(i, j):
                    sections.append({"type": directions[k], "start": k, "end": k + 1})
            i = j
        else:
            sections.append({"type": directions[i], "start": i, "end": i + 1})
            i += 1

    merged = [sections[0]]
    for s in sections[1:]:
        if s["type"] == merged[-1]["type"]:
            merged[-1]["end"] = s["end"]
        else:
            merged.append(s)
    return merged


# ========== 描画 ==========

def main():
    geometry_list = load_hongusan_geometry()
    xy = to_plane_coords(geometry_list)
    angles = calc_angles(xy)
    directions = normalize_directions(xy)
    sections = extract_sections(xy, directions, angles)

    print(f"points: {len(xy)}")
    print(f"params: MIN_ANGLE_DEG={MIN_ANGLE_DEG}, MIN_RUN={MIN_RUN}, "
          f"STRAIGHT_ANGLE_DEG={STRAIGHT_ANGLE_DEG}, STRAIGHT_MIN_DIST={STRAIGHT_MIN_DIST}")
    print(f"sections: {len(sections)}")
    for i, s in enumerate(sections):
        dist = segment_distance(xy, s["start"], s["end"] + 1 if s["end"] < len(xy) - 1 else s["end"])
        print(f"  {i:3d}: {s['type']:10s}  idx={s['start']:3d}-{s['end']:3d}  dist={dist:.0f}m")

    fig, ax = plt.subplots(figsize=(10, 12))

    color_map = {"left": "red", "right": "blue", "straight": "gray"}
    for s in sections:
        idx = slice(s["start"], s["end"] + 1)
        ax.plot(xy[idx, 0], xy[idx, 1], color=color_map[s["type"]], linewidth=2.0)

    from matplotlib.lines import Line2D
    legend = [
        Line2D([0], [0], color="red", linewidth=2, label="left"),
        Line2D([0], [0], color="blue", linewidth=2, label="right"),
        Line2D([0], [0], color="gray", linewidth=2, label="straight"),
    ]
    ax.legend(handles=legend, loc="best")
    ax.set_aspect("equal")
    ax.set_title(f"sections ({len(sections)})")
    plt.tight_layout()

    out_path = os.path.join(DATA_DIR, "section_lab.png")
    plt.savefig(out_path, dpi=150, bbox_inches="tight")
    plt.close()
    print(f"Plot saved: {out_path}")
    subprocess.Popen(["explorer.exe", subprocess.check_output(["wslpath", "-w", out_path]).decode().strip()])


if __name__ == "__main__":
    main()
