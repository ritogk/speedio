"""路面の荒れ度 + 自然囲まれ度のPoC

- 荒れ度: RT-DETR (RDD2022学習済み) の損傷検出を面積加重で集約
- 自然囲まれ度: Mask2Formerセグメンテーションの左右の自然クラス比率（追加推論なし）

usage: conda run -n vit-centerline python surface_poc.py <samples.csv>
"""

import csv
import sys
import time
from pathlib import Path

import numpy as np
import torch
from PIL import Image, ImageDraw, ImageFont

import measure

IMAGE_DIR = Path(__file__).parent.parent / "centerline" / "tmp"
OUTPUT_DIR = Path(__file__).parent / "output_surface"

# oracl4/RoadDamageDetection のYOLOv8s (RDD2022学習済み、ユーザー許可の上で取得)
RDD_MODEL_PATH = Path(__file__).parent / "models" / "YOLOv8_Small_RDD.pt"
# 損傷クラスの重み。亀甲ひび割れとポットホールは「荒れた道」の決定打なので重く
DAMAGE_WEIGHTS = {"Longitudinal Crack": 1.0, "Transverse Crack": 1.0,
                  "Alligator Crack": 3.0, "Potholes": 3.0}
DETECT_THRESHOLD = 0.25

# 自然クラス (Mapillary Vistas): Mountain, Sand, Terrain, Vegetation, Water, Snow
NATURE_IDS = {25, 26, 29, 30, 31, 28}
# 人工物クラス: Curb, Fence, Barrier, Wall, Bridge, Building, Tunnel, 路上オブジェクト, 車両
# ※ガードレール(4)は峠の一部なので囲まれ度からは中立扱い(除外)し、独立指標として別に出す
GUARDRAIL_ID = 4
ARTIFICIAL_IDS = {2, 3, 5, 6, 16, 17, 18} | set(range(32, 52)) | set(range(52, 63))
SKY_ID = 27


def load_rdd_model(device: str):
    from ultralytics import YOLO
    return YOLO(str(RDD_MODEL_PATH))


def detect_damage(img: Image.Image, model):
    res = model.predict(img, conf=DETECT_THRESHOLD, verbose=False)[0]
    dets = []
    for b in res.boxes:
        name = model.names[int(b.cls)]
        if name not in DAMAGE_WEIGHTS:
            continue
        dets.append({"cls": name, "score": float(b.conf), "box": [float(x) for x in b.xyxy[0]]})
    return dets


def roughness_score(dets, road_px: int, img_area: int) -> float:
    """損傷の加重面積 / 舗装面積 → 0-1の荒れ度（0=綺麗）"""
    if road_px < 1000:
        return 0.0
    total = 0.0
    for d in dets:
        x0, y0, x1, y1 = d["box"]
        area = max(0.0, (x1 - x0) * (y1 - y0))
        total += DAMAGE_WEIGHTS[d["cls"]] * area * d["score"]
    ratio = total / road_px
    return float(min(1.0, ratio * 3.0))  # 経験的スケール: 舗装の1/3が重損傷でスコア1.0


def nature_enclosure(seg: np.ndarray) -> dict:
    """左右それぞれの帯で「自然 vs 人工物」比率を計算（空・舗装・ガードレールは分母から除外）

    ガードレールは独立指標: 帯の中でガードレールを含む「列」の割合（=道沿いの連続度）
    """
    h, w = seg.shape
    out = {}
    gr = {}
    for name, band in [("left", seg[:, : w // 3]), ("right", seg[:, -w // 3:])]:
        nature = np.isin(band, list(NATURE_IDS)).sum()
        artificial = np.isin(band, list(ARTIFICIAL_IDS)).sum()
        denom = nature + artificial
        out[name] = float(nature / denom) if denom > 500 else 1.0  # 何も無ければ自然扱い
        # ガードレール連続度: 列単位のカバレッジ(3px以上あればその列は「ガードレールあり」)
        gr[name] = float(((band == GUARDRAIL_ID).sum(axis=0) >= 3).mean())
    # 頭上の緑被覆（森のトンネル感）: 画像上部1/4の植生率
    top = seg[: h // 4]
    out["canopy"] = round(float(np.isin(top, list(NATURE_IDS)).sum() / top.size), 3)
    out["enclosure"] = round(min(out["left"], out["right"]), 3)
    out["left"] = round(out["left"], 3)
    out["right"] = round(out["right"], 3)
    out["guardrail_left"] = round(gr["left"], 3)
    out["guardrail_right"] = round(gr["right"], 3)
    out["guardrail"] = round(max(gr["left"], gr["right"]), 3)
    return out


def render(img: Image.Image, seg: np.ndarray, nat: dict) -> Image.Image:
    out = img.convert("RGB").copy()
    draw = ImageDraw.Draw(out)
    try:
        font = ImageFont.truetype("/usr/share/fonts/opentype/ipafont-gothic/ipag.ttf", 26)
        font_big = ImageFont.truetype("/usr/share/fonts/opentype/ipafont-gothic/ipag.ttf", 32)
    except OSError:
        font = font_big = ImageFont.load_default()
    label = (f"囲まれ度 {nat['enclosure']:.2f} (左{nat['left']:.2f} 右{nat['right']:.2f} 頭上{nat['canopy']:.2f})"
             f" ／ ガードレール {nat['guardrail']:.2f}")
    draw.text((20, 16), label, fill=(255, 255, 255), font=font_big, stroke_width=3, stroke_fill=(0, 0, 0))
    return out


def main():
    samples_csv = sys.argv[1]
    OUTPUT_DIR.mkdir(exist_ok=True)
    device = "cuda" if torch.cuda.is_available() else "cpu"
    print("loading models...")
    seg_proc, seg_model, _, _ = measure.load_models(device)

    rows = list(csv.DictReader(open(samples_csv)))
    results = []
    for i, row in enumerate(rows):
        img_path = IMAGE_DIR / row["image"]
        if not img_path.exists():
            continue
        img = Image.open(img_path).convert("RGB")
        t0 = time.time()
        seg = measure.segment(img, seg_proc, seg_model, device)
        nat = nature_enclosure(seg)
        name = f"surf_{i:03d}.jpg"
        render(img, seg, nat).save(OUTPUT_DIR / name, "JPEG", quality=82)
        results.append({**row, **{f"nat_{k}": v for k, v in nat.items()}, "overlay": name})
        print(f"[{i+1}/{len(rows)}] encl={nat['enclosure']:.2f} gr={nat['guardrail']:.2f} "
              f"({time.time()-t0:.1f}s) {row['image']}")

    with open(OUTPUT_DIR / "surface_results.csv", "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(results[0].keys()))
        w.writeheader()
        w.writerows(results)
    print(f"saved: {OUTPUT_DIR}/surface_results.csv")


if __name__ == "__main__":
    main()
