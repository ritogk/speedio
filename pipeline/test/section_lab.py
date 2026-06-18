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
MIN_ANGLE_DEG = 2.0  # この角度未満の曲がりは「前の方向を維持」(デッドゾーン)
MIN_RUN = 2          # この点数未満の区間は隣にマージ


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

def calc_directions(xy, min_angle_deg=0.0):
    """連続する3点から左右の方向を判定。min_angle_deg未満は前の方向を維持。"""
    directions = []
    prev_dir = "straight"
    for i in range(len(xy) - 2):
        p1, p2, p3 = xy[i], xy[i + 1], xy[i + 2]
        v1 = p2 - p1
        v2 = p3 - p2
        cross = v1[0] * v2[1] - v1[1] * v2[0]
        dot = v1[0] * v2[0] + v1[1] * v2[1]
        angle_deg = abs(np.degrees(np.arctan2(cross, dot)))

        if angle_deg < min_angle_deg:
            directions.append(prev_dir)
        elif cross > 0:
            prev_dir = "left"
            directions.append("left")
        elif cross < 0:
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


# ========== 描画 ==========

def main():
    geometry_list = load_hongusan_geometry()
    xy = to_plane_coords(geometry_list)

    dirs_raw = calc_directions(xy)
    dirs_smooth = normalize_directions(xy)

    print(f"points: {len(xy)}")
    print(f"params: MIN_ANGLE_DEG={MIN_ANGLE_DEG}, MIN_RUN={MIN_RUN}")

    fig, ax = plt.subplots(figsize=(10, 12))

    for i, d in enumerate(dirs_smooth):
        color = {"left": "red", "right": "blue", "straight": "gray"}[d]
        ax.plot(xy[i:i + 2, 0], xy[i:i + 2, 1], color=color, linewidth=2.0)

    from matplotlib.lines import Line2D
    legend = [
        Line2D([0], [0], color="red", linewidth=2, label="left"),
        Line2D([0], [0], color="blue", linewidth=2, label="right"),
    ]
    ax.legend(handles=legend, loc="best")
    ax.set_aspect("equal")
    ax.set_title(f"min_angle={MIN_ANGLE_DEG}deg, min_run={MIN_RUN}")
    plt.tight_layout()

    out_path = os.path.join(DATA_DIR, "section_lab.png")
    plt.savefig(out_path, dpi=150, bbox_inches="tight")
    plt.close()
    print(f"Plot saved: {out_path}")
    subprocess.Popen(["explorer.exe", subprocess.check_output(["wslpath", "-w", out_path]).decode().strip()])


if __name__ == "__main__":
    main()
