"""Street View画像から舗装幅・路肩余地をメートル単位で実測する

方式: セマンティックセグメンテーション + メートル単眼深度 + 地面平面フィット
- セグ: Mask2Former Swin-L (Mapillary Vistas 65クラス: Guard Rail/Curb/Vegetation等が独立)
- 深度: Depth Anything V2 Metric Outdoor Small
- スケール校正: 道路ピクセルにRANSAC平面フィット → カメラ高2.45m基準で深度スケールを補正

カメラ内部パラメータは panorama.py の投影仕様から既知:
  fov=90 は縦方向 (y = ny*tan(45°)) → fx = fy = H/2 = 480, cx=640, cy=480
"""

import numpy as np
import torch
from PIL import Image, ImageDraw, ImageFont

# カメラパラメータ (1280x960, 縦FOV90°の合成透視投影)
FX = 480.0
FY = 480.0
CX = 640.0
CY = 480.0
CAM_HEIGHT = 2.45  # Street View撮影車のカメラ高 [m]

# Mapillary Vistas クラスID
ROAD_IDS = {13, 24, 23, 8, 7, 14, 10, 41, 43}  # Road, Lane Marking, Crosswalk, Bike/Service Lane, Parking, Manhole, Pothole
MARGIN_IDS = {15, 9, 29, 26, 11}  # Sidewalk, Curb Cut, Terrain, Sand, Pedestrian Area (平坦・非障害物)
OBSTACLE_IDS = ({2, 3, 4, 5, 6, 16, 17, 18, 25, 30, 31}  # Curb, Fence, Guard Rail, Barrier, Wall, Bridge, Building, Tunnel, Mountain, Vegetation, Water
                | set(range(19, 23))  # 人・ライダー
                | set(range(32, 52))  # ポール・標識・街灯等の路上オブジェクト
                | set(range(52, 63)))  # 車両

SEG_MODEL_ID = "facebook/mask2former-swin-large-mapillary-vistas-semantic"
DEPTH_MODEL_ID = "depth-anything/Depth-Anything-V2-Metric-Outdoor-Small-hf"

CLEARANCE_CAP = 3.0  # 余地の計測上限 [m]


def load_models(device: str):
    from transformers import (AutoImageProcessor, AutoModelForDepthEstimation,
                              Mask2FormerForUniversalSegmentation)
    seg_proc = AutoImageProcessor.from_pretrained(SEG_MODEL_ID)
    seg_model = Mask2FormerForUniversalSegmentation.from_pretrained(SEG_MODEL_ID).to(device).eval()
    dep_proc = AutoImageProcessor.from_pretrained(DEPTH_MODEL_ID)
    dep_model = AutoModelForDepthEstimation.from_pretrained(DEPTH_MODEL_ID).to(device).eval()
    return seg_proc, seg_model, dep_proc, dep_model


@torch.no_grad()
def segment(img: Image.Image, seg_proc, seg_model, device: str) -> np.ndarray:
    inputs = seg_proc(images=img, return_tensors="pt").to(device)
    outputs = seg_model(**inputs)
    seg = seg_proc.post_process_semantic_segmentation(
        outputs, target_sizes=[(img.height, img.width)])[0]
    return seg.cpu().numpy().astype(np.uint8)


@torch.no_grad()
def estimate_depth(img: Image.Image, dep_proc, dep_model, device: str) -> np.ndarray:
    inputs = dep_proc(images=img, return_tensors="pt").to(device)
    depth = dep_model(**inputs).predicted_depth
    depth = torch.nn.functional.interpolate(
        depth.unsqueeze(1), size=(img.height, img.width), mode="bilinear", align_corners=False)
    return depth[0, 0].cpu().numpy()


def backproject(depth: np.ndarray) -> np.ndarray:
    """深度マップを3D点群に変換 (X右, Y下, Z前方) -> (H, W, 3)"""
    h, w = depth.shape
    u = np.arange(w)[None, :].repeat(h, axis=0)
    v = np.arange(h)[:, None].repeat(w, axis=1)
    x = (u - CX) * depth / FX
    y = (v - CY) * depth / FY
    return np.stack([x, y, depth], axis=-1)


def fit_ground_plane(points: np.ndarray, iterations: int = 300, threshold: float = 0.08):
    """RANSACで平面フィット。n·p + d = 0 (nは上向き・単位ベクトル, d>0=カメラ高) を返す"""
    rng = np.random.default_rng(0)
    n_pts = len(points)
    best_inliers = None
    best_count = 0
    for _ in range(iterations):
        idx = rng.choice(n_pts, 3, replace=False)
        p0, p1, p2 = points[idx]
        n = np.cross(p1 - p0, p2 - p0)
        norm = np.linalg.norm(n)
        if norm < 1e-9:
            continue
        n = n / norm
        d = -np.dot(n, p0)
        dist = np.abs(points @ n + d)
        count = int((dist < threshold).sum())
        if count > best_count:
            best_count = count
            best_inliers = dist < threshold
    if best_inliers is None or best_count < 100:
        return None
    # インライアで最小二乗リファイン (SVD)
    pts = points[best_inliers]
    centroid = pts.mean(axis=0)
    _, _, vt = np.linalg.svd(pts - centroid, full_matrices=False)
    n = vt[2]
    # 上向き (Y下向き座標系なので n_y < 0) に揃える
    if n[1] > 0:
        n = -n
    d = -np.dot(n, centroid)
    return n, d, best_count / n_pts


def contiguous_road_interval(t_values: np.ndarray, bin_size: float = 0.1, gap_bins: int = 3):
    """横方向座標の集合から、カメラ直下(t=0)を含む連続した道路区間 [t_left, t_right] を求める"""
    if len(t_values) == 0:
        return None
    t_min, t_max = t_values.min(), t_values.max()
    nbins = max(1, int(np.ceil((t_max - t_min) / bin_size)))
    hist, edges = np.histogram(t_values, bins=nbins, range=(t_min, t_min + nbins * bin_size))
    occupied = hist > 0
    # t=0 に最も近い占有ビンを起点にする
    centers = (edges[:-1] + edges[1:]) / 2
    occ_idx = np.where(occupied)[0]
    start = occ_idx[np.argmin(np.abs(centers[occ_idx]))]
    # 左右にギャップ許容で拡張
    left = start
    gap = 0
    for i in range(start - 1, -1, -1):
        if occupied[i]:
            left = i
            gap = 0
        else:
            gap += 1
            if gap > gap_bins:
                break
    right = start
    gap = 0
    for i in range(start + 1, nbins):
        if occupied[i]:
            right = i
            gap = 0
        else:
            gap += 1
            if gap > gap_bins:
                break
    return edges[left], edges[right + 1]


def measure_cross_section(coords_st: np.ndarray, labels: np.ndarray, heights: np.ndarray,
                          s_center: float, band: float = 0.75):
    """前方距離 s_center の断面で舗装幅と左右余地を計測

    coords_st: (N,2) 平面座標 [前方s, 横t] / labels: (N,) クラスID / heights: (N,) 平面からの高さ
    """
    in_band = np.abs(coords_st[:, 0] - s_center) < band
    if in_band.sum() < 50:
        return None
    band_t = coords_st[in_band, 1]
    band_labels = labels[in_band]
    band_h = heights[in_band]

    road_t = band_t[np.isin(band_labels, list(ROAD_IDS))]
    if len(road_t) < 30:
        return None
    interval = contiguous_road_interval(road_t)
    if interval is None:
        return None
    t_left, t_right = interval
    paved_width = t_right - t_left

    # 余地: 舗装端から最初の障害物(地面から高さ-0.5〜2.5mの範囲)までの距離
    is_obstacle = np.isin(band_labels, list(OBSTACLE_IDS)) & (band_h > -0.5) & (band_h < 2.5)
    obs_t = band_t[is_obstacle]
    left_obs = obs_t[(obs_t < t_left) & (obs_t > t_left - CLEARANCE_CAP - 1)]
    right_obs = obs_t[(obs_t > t_right) & (obs_t < t_right + CLEARANCE_CAP + 1)]
    clearance_left = min(CLEARANCE_CAP, t_left - left_obs.max()) if len(left_obs) else CLEARANCE_CAP
    clearance_right = min(CLEARANCE_CAP, right_obs.min() - t_right) if len(right_obs) else CLEARANCE_CAP

    return {
        "s": s_center,
        "paved_width": round(float(paved_width), 2),
        "t_left": float(t_left),
        "t_right": float(t_right),
        "clearance_left": round(float(clearance_left), 2),
        "clearance_right": round(float(clearance_right), 2),
    }


def ipm_cross_section(seg: np.ndarray, dist: float):
    """純IPM計測: 平面仮定(カメラ高2.45m, pitch0)で前方dist[m]の断面を測る

    深度モデルを使わず、既知のカメラジオメトリのみで計算する。
    舗装幅 + 左右の平坦余地(sidewalk/terrain等)幅を返す。
    """
    v = int(round(CY + FY * CAM_HEIGHT / dist))
    if v >= seg.shape[0] - 2:
        return None
    # 3行分の多数決でノイズ低減
    rows = seg[v - 1:v + 2]
    m_per_px = dist / FX

    is_road = np.isin(rows, list(ROAD_IDS)).sum(axis=0) >= 2
    is_margin = np.isin(rows, list(MARGIN_IDS)).sum(axis=0) >= 2
    if is_road.sum() < 10:
        return None

    # 画像中央直下(自車位置)を含む連続舗装区間
    center = int(CX)
    road_cols = np.where(is_road)[0]
    start = road_cols[np.argmin(np.abs(road_cols - center))]
    gap_px = max(1, int(0.3 / m_per_px))
    left = start
    gap = 0
    for u in range(start - 1, -1, -1):
        if is_road[u]:
            left = u
            gap = 0
        else:
            gap += 1
            if gap > gap_px:
                break
    right = start
    gap = 0
    for u in range(start + 1, seg.shape[1]):
        if is_road[u]:
            right = u
            gap = 0
        else:
            gap += 1
            if gap > gap_px:
                break
    paved_width = (right - left) * m_per_px

    # 舗装端の外側に続く平坦余地(margin)の幅
    def margin_run(edge: int, step: int) -> float:
        n = 0
        u = edge + step
        while 0 <= u < seg.shape[1] and is_margin[u] and n * m_per_px < CLEARANCE_CAP:
            n += 1
            u += step
        return min(CLEARANCE_CAP, n * m_per_px)

    return {
        "s": dist,
        "paved_width": round(float(paved_width), 2),
        "u_left": left,
        "u_right": right,
        "v": v,
        "margin_left": round(margin_run(left, -1), 2),
        "margin_right": round(margin_run(right, 1), 2),
    }


def measure_image(img: Image.Image, models, device: str, sections=(5.0, 8.0)):
    """1画像の計測。結果dictと可視化用中間データを返す"""
    seg_proc, seg_model, dep_proc, dep_model = models
    seg = segment(img, seg_proc, seg_model, device)
    depth = estimate_depth(img, dep_proc, dep_model, device)
    pts = backproject(depth)

    road_mask = np.isin(seg, list(ROAD_IDS))
    road_pts = pts[road_mask]
    # 平面フィットは近距離(3〜25m)の道路点に限定して勾配の影響を抑える
    near = (road_pts[:, 2] > 3) & (road_pts[:, 2] < 25)
    road_near = road_pts[near]
    if len(road_near) < 500:
        return None, None
    sub = road_near[np.random.default_rng(0).choice(len(road_near), min(15000, len(road_near)), replace=False)]
    fit = fit_ground_plane(sub)
    if fit is None:
        return None, None
    n, d, inlier_ratio = fit

    # カメラ高でメートルスケールを校正
    raw_cam_height = d
    scale = CAM_HEIGHT / d
    pts_scaled = pts * scale
    d_scaled = CAM_HEIGHT

    # 平面座標系: forward = カメラz軸の平面への射影, lateral = n × forward
    f = np.array([0.0, 0.0, 1.0]) - n[2] * n
    f = f / np.linalg.norm(f)
    lat = np.cross(n, f)

    flat = pts_scaled.reshape(-1, 3)
    s_coord = flat @ f
    t_coord = flat @ lat
    h_coord = flat @ n + d_scaled
    coords_st = np.stack([s_coord, t_coord], axis=-1)
    labels = seg.reshape(-1)

    results = []
    for s in sections:
        r = measure_cross_section(coords_st, labels, h_coord, s)
        if r is not None:
            results.append(r)

    ipm_results = []
    for s in sections:
        r = ipm_cross_section(seg, s)
        if r is not None:
            ipm_results.append(r)

    meta = {
        "raw_cam_height": round(float(raw_cam_height), 2),
        "scale": round(float(scale), 3),
        "inlier_ratio": round(float(inlier_ratio), 3),
        "sections": results,
        "ipm_sections": ipm_results,
    }
    viz = {"seg": seg, "n": n, "d": d_scaled, "f": f, "lat": lat}
    return meta, viz


def project_plane_point(s: float, t: float, viz) -> tuple[float, float]:
    """平面座標(s,t)を画像座標(u,v)に投影"""
    p = -viz["d"] * viz["n"] + s * viz["f"] + t * viz["lat"]
    u = FX * p[0] / p[2] + CX
    v = FY * p[1] / p[2] + CY
    return u, v


def render_overlay(img: Image.Image, meta, viz) -> Image.Image:
    """セグメンテーションと計測断面を重畳描画

    IPM断面のみをクリーンに描く:
    - シアン線+端点ティック = 舗装幅、線上中央に数値バッジ
    - オレンジ線 = 舗装端の外の平坦余地(値>0のときのみ)
    - 左端に前方距離ラベル(5m/8m)
    """
    seg = viz["seg"]
    overlay = np.zeros((seg.shape[0], seg.shape[1], 4), dtype=np.uint8)
    overlay[np.isin(seg, list(ROAD_IDS))] = (50, 130, 255, 70)
    overlay[np.isin(seg, list(MARGIN_IDS))] = (255, 210, 60, 70)
    out = Image.alpha_composite(img.convert("RGBA"), Image.fromarray(overlay))
    draw = ImageDraw.Draw(out)

    def load_font(size):
        for path in ["/usr/share/fonts/opentype/ipafont-gothic/ipag.ttf",
                     "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"]:
            try:
                return ImageFont.truetype(path, size)
            except OSError:
                continue
        return ImageFont.load_default()

    font_big = load_font(34)
    font_small = load_font(24)
    CYAN = (0, 230, 255, 255)
    ORANGE = (255, 160, 0, 255)

    def badge(cx, cy, text, font, fg, bg=(10, 20, 25, 230), pad=8):
        box = draw.textbbox((0, 0), text, font=font)
        w, h = box[2] - box[0], box[3] - box[1]
        x0, y0 = cx - w / 2 - pad, cy - h / 2 - pad
        draw.rounded_rectangle([x0, y0, x0 + w + 2 * pad, y0 + h + 2 * pad], radius=6, fill=bg)
        draw.text((cx - w / 2 - box[0], cy - h / 2 - box[1]), text, fill=fg, font=font)

    for sec in meta.get("ipm_sections", []):
        v = sec["v"]
        m_per_px = sec["s"] / FX
        ul, ur = sec["u_left"], sec["u_right"]

        # 余地(オレンジ): 舗装端の外側
        for edge, margin, step in [(ul, sec["margin_left"], -1), (ur, sec["margin_right"], 1)]:
            if margin <= 0.05:
                continue
            px = int(margin / m_per_px)
            draw.line([(edge, v), (edge + step * px, v)], fill=ORANGE, width=5)
            draw.line([(edge + step * px, v - 12), (edge + step * px, v + 12)], fill=ORANGE, width=4)
            badge(edge + step * px / 2, v + 30, f"+{margin}m", font_small, ORANGE)

        # 舗装幅(シアン): 線 + 端点ティック + 中央バッジ
        draw.line([(ul, v), (ur, v)], fill=CYAN, width=6)
        for u in (ul, ur):
            draw.line([(u, v - 16), (u, v + 16)], fill=CYAN, width=5)
        badge((ul + ur) / 2, v - 32, f"{sec['paved_width']}m", font_big, CYAN)

        # 前方距離ラベル(左端)
        badge(70, v, f"前方{sec['s']:.0f}m", font_small, (255, 255, 255, 255))

    return out.convert("RGB")
