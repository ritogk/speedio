"""路面の綺麗さ(0-1)のPoC — CLIPゼロショット方式

損傷の個数ではなく「舗装が綺麗か古びているか」の全体印象をスコア化する。
セグメンテーションの舗装マスクから路面領域を切り出し、CLIPで
「綺麗な舗装」系プロンプトと「古びた舗装」系プロンプトの一致度を比較する。

usage: conda run -n vit-centerline python smoothness_poc.py <samples.csv>
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
OUTPUT_DIR = Path(__file__).parent / "output_smooth"

# safetensors配布があるのはlarge-patch14のみ(base系は.binのみでtorch<2.6では読めない)
CLIP_MODEL_ID = "openai/clip-vit-large-patch14"

# プロンプト設計: 綺麗(+) vs 古びた(-)。複数書いて平均することで言い回し依存を減らす
POS_PROMPTS = [
    "a photo of smooth freshly paved dark asphalt road surface",
    "a photo of clean new asphalt pavement in good condition",
    "a photo of well-maintained road with uniform black asphalt",
]
NEG_PROMPTS = [
    "a photo of old faded gray asphalt with cracks and patches",
    "a photo of deteriorated rough road surface in poor condition",
    "a photo of worn out pavement with repair seams and potholes",
]


def load_clip(device: str):
    from transformers import CLIPModel, CLIPProcessor
    model = CLIPModel.from_pretrained(CLIP_MODEL_ID).to(device).eval()
    proc = CLIPProcessor.from_pretrained(CLIP_MODEL_ID)
    return model, proc


def road_crop(img: Image.Image, seg: np.ndarray) -> Image.Image | None:
    """舗装マスクの近景領域(画像下半分)を正方形で切り出す"""
    road = np.isin(seg, list(measure.ROAD_IDS))
    h, w = seg.shape
    road[: h // 2] = False  # 近景のみ(遠景は解像度不足)
    ys, xs = np.where(road)
    if len(ys) < 5000:
        return None
    x0, x1 = xs.min(), xs.max()
    y0, y1 = ys.min(), ys.max()
    return img.crop((x0, y0, x1, y1))


@torch.no_grad()
def smoothness(img: Image.Image, seg: np.ndarray, clip) -> float | None:
    """0=古びた舗装 〜 1=綺麗な舗装"""
    model, proc = clip
    crop = road_crop(img, seg)
    if crop is None:
        return None
    inputs = proc(text=POS_PROMPTS + NEG_PROMPTS, images=crop,
                  return_tensors="pt", padding=True).to(model.device)
    sims = model(**inputs).logits_per_image[0]  # (n_prompts,) 温度スケール済み
    n_pos = len(POS_PROMPTS)
    pos = sims[:n_pos].mean()
    neg = sims[n_pos:].mean()
    return float(torch.sigmoid(pos - neg))


def render(img: Image.Image, score: float) -> Image.Image:
    out = img.convert("RGB").copy()
    draw = ImageDraw.Draw(out)
    try:
        font = ImageFont.truetype("/usr/share/fonts/opentype/ipafont-gothic/ipag.ttf", 34)
    except OSError:
        font = ImageFont.load_default()
    draw.text((20, 16), f"綺麗さ {score:.2f}", fill=(255, 255, 255), font=font,
              stroke_width=3, stroke_fill=(0, 0, 0))
    return out


def main():
    samples_csv = sys.argv[1]
    OUTPUT_DIR.mkdir(exist_ok=True)
    device = "cuda" if torch.cuda.is_available() else "cpu"
    print("loading models...")
    seg_proc, seg_model, _, _ = measure.load_models(device)
    clip = load_clip(device)

    rows = list(csv.DictReader(open(samples_csv)))
    results = []
    for i, row in enumerate(rows):
        img_path = IMAGE_DIR / row["image"]
        if not img_path.exists():
            continue
        img = Image.open(img_path).convert("RGB")
        t0 = time.time()
        seg = measure.segment(img, seg_proc, seg_model, device)
        score = smoothness(img, seg, clip)
        if score is None:
            print(f"[{i+1}/{len(rows)}] skip (no road) {row['image']}")
            continue
        name = f"sm_{i:03d}.jpg"
        render(img, score).save(OUTPUT_DIR / name, "JPEG", quality=82)
        results.append({**row, "smoothness": round(score, 3), "overlay": name})
        print(f"[{i+1}/{len(rows)}] smooth={score:.2f} ({time.time()-t0:.1f}s) {row['image']}")

    with open(OUTPUT_DIR / "smooth_results.csv", "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(results[0].keys()))
        w.writeheader()
        w.writerows(results)
    print(f"saved: {OUTPUT_DIR}/smooth_results.csv")


if __name__ == "__main__":
    main()
