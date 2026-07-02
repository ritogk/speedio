"""PoC: 人手ラベル済み地点のサンプル画像で舗装幅・余地の実測を試す

usage: conda run -n vit-centerline python poc.py <samples.csv>
  samples.csv: lat,lng,road_width_type,road_margin,image (ヘッダあり)
"""

import csv
import sys
import time
from pathlib import Path

import torch
from PIL import Image

import measure

IMAGE_DIR = Path(__file__).parent.parent / "centerline" / "tmp"
OUTPUT_DIR = Path(__file__).parent / "output"


def main():
    samples_csv = sys.argv[1]
    OUTPUT_DIR.mkdir(exist_ok=True)
    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"device: {device}")
    print("loading models...")
    models = measure.load_models(device)

    rows = list(csv.DictReader(open(samples_csv)))
    results = []
    for i, row in enumerate(rows):
        img_path = IMAGE_DIR / row["image"]
        if not img_path.exists():
            print(f"skip (no image): {row['image']}")
            continue
        img = Image.open(img_path).convert("RGB")
        t0 = time.time()
        meta, viz = measure.measure_image(img, models, device)
        elapsed = time.time() - t0
        if meta is None or not meta["sections"]:
            print(f"[{i+1}/{len(rows)}] FAILED {row['image']}")
            results.append({**row, "status": "failed"})
            continue
        overlay = measure.render_overlay(img, meta, viz)
        out_name = f"{row['road_width_type']}_{row['road_margin'] or 'X'}_{i:02d}.jpg"
        overlay.save(OUTPUT_DIR / out_name, "JPEG", quality=85)

        sec5 = next((s for s in meta["sections"] if s["s"] == 5.0), None)
        sec8 = next((s for s in meta["sections"] if s["s"] == 8.0), None)
        rec = {
            **row, "status": "ok", "overlay": out_name,
            "raw_cam_height": meta["raw_cam_height"],
            "inlier_ratio": meta["inlier_ratio"],
        }
        for tag, sec in [("5m", sec5), ("8m", sec8)]:
            if sec:
                rec[f"width_{tag}"] = sec["paved_width"]
                rec[f"clear_l_{tag}"] = sec["clearance_left"]
                rec[f"clear_r_{tag}"] = sec["clearance_right"]
        for sec in meta["ipm_sections"]:
            tag = f"{sec['s']:.0f}m"
            rec[f"ipm_width_{tag}"] = sec["paved_width"]
            rec[f"ipm_margin_l_{tag}"] = sec["margin_left"]
            rec[f"ipm_margin_r_{tag}"] = sec["margin_right"]
            rec[f"lane_width_{tag}"] = sec["lane_width"]
            rec[f"n_markings_{tag}"] = sec["n_markings"]
        results.append(rec)
        print(f"[{i+1}/{len(rows)}] {row['road_width_type']:18s} {row['road_margin'] or '-':6s} "
              f"D_w5={rec.get('width_5m')} I_w5={rec.get('ipm_width_5m')} I_w8={rec.get('ipm_width_8m')} "
              f"I_m5={rec.get('ipm_margin_l_5m')}/{rec.get('ipm_margin_r_5m')} "
              f"camH={meta['raw_cam_height']} ({elapsed:.1f}s) {row['image']}")

    fields = sorted({k for r in results for k in r})
    with open(OUTPUT_DIR / "results.csv", "w", newline="") as fp:
        w = csv.DictWriter(fp, fieldnames=fields)
        w.writeheader()
        w.writerows(results)
    print(f"\nsaved: {OUTPUT_DIR}/results.csv")


if __name__ == "__main__":
    main()
