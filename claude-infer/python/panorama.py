"""Google Street Viewパノラマ画像の取得（Python版）"""

import math
import os
from io import BytesIO
from pathlib import Path

import numpy as np
import requests
from PIL import Image

from config import TMP_DIR

STREET_VIEW_METADATA_URL = "https://maps.googleapis.com/maps/api/streetview/metadata"
TILE_BASE_URL = "https://streetviewpixels-pa.googleapis.com/v1/tile"
PANORAMA_DIR = TMP_DIR / "panorama"


def get_panorama_id(lat: float, lng: float, api_key: str) -> str:
    """Street Viewのpanorama IDを取得"""
    response = requests.get(
        STREET_VIEW_METADATA_URL,
        params={
            "location": f"{lat},{lng}",
            "key": api_key,
            "source": "outdoor",
        }
    )
    data = response.json()

    if data.get("status") != "OK" or not data.get("pano_id"):
        raise Exception(f"Street View not available: {data.get('status')}")

    copyright_text = data.get("copyright", "")
    if copyright_text and "Google" not in copyright_text:
        raise Exception(f"User-contributed image skipped: {copyright_text}")

    return data["pano_id"]


def get_panorama_heading_offset(pano_id: str) -> float:
    """パノラマのヘディングオフセットを取得"""
    try:
        url = f"https://www.google.com/maps/photometa/v1?authuser=0&hl=ja&gl=jp&pb=!1m4!1smaps_sv.tactile!11m2!2m1!1b1!2m2!1sja!2sjp!3m3!1m2!1e2!2s{pano_id}!4m57!1e1!1e2!1e3!1e4!1e5!1e6!1e8!1e12!2m1!1e1!4m1!1i48!5m1!1e1!5m1!1e2!6m1!1e1!6m1!1e2!9m36!1m3!1e2!2b1!3e2!1m3!1e2!2b0!3e3!1m3!1e3!2b1!3e2!1m3!1e3!2b0!3e3!1m3!1e8!2b0!3e3!1m3!1e1!2b0!3e3!1m3!1e4!2b0!3e3!1m3!1e10!2b1!3e2!1m3!1e10!2b0!3e3"

        response = requests.get(url, headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        })

        text = response.text
        json_str = text.replace(")]}'\\n", "").replace(")]}\\'\\n", "")
        if json_str.startswith(")]}'"):
            json_str = json_str[4:]

        import json
        data = json.loads(json_str)

        heading_data = data[1][0][5][0][1][2] if data else None
        if heading_data and isinstance(heading_data, list) and len(heading_data) >= 1:
            heading = heading_data[0]
            if isinstance(heading, (int, float)):
                return float(heading)

        return 0.0
    except Exception:
        return 0.0


def fetch_panorama_tile(pano_id: str, zoom: int, x: int, y: int) -> bytes:
    """パノラマタイルを取得"""
    PANORAMA_DIR.mkdir(parents=True, exist_ok=True)

    cache_file = PANORAMA_DIR / f"{pano_id}_z{zoom}_x{x}_y{y}.jpg"
    if cache_file.exists():
        return cache_file.read_bytes()

    url = f"{TILE_BASE_URL}?cb_client=maps_sv.tactile&panoid={pano_id}&x={x}&y={y}&zoom={zoom}&nbt=1&fover=2"

    response = requests.get(url, headers={
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    })

    if response.status_code != 200:
        raise Exception(f"Tile not available: {response.status_code}")

    content_type = response.headers.get("Content-Type", "")
    if not content_type.startswith("image/"):
        raise Exception(f"Invalid response: expected image, got {content_type}")

    if len(response.content) < 1000:
        raise Exception(f"Invalid tile data: too small ({len(response.content)} bytes)")

    cache_file.write_bytes(response.content)
    return response.content


def build_panorama(pano_id: str, zoom: int = 3) -> Image.Image:
    """パノラマタイルを結合してフルパノラマを作成"""
    PANORAMA_DIR.mkdir(parents=True, exist_ok=True)

    cache_file = PANORAMA_DIR / f"{pano_id}_full_z{zoom}.jpg"
    if cache_file.exists():
        return Image.open(cache_file)

    # zoom levelに応じたタイル数
    tiles_x = 2 ** zoom
    tiles_y = 2 ** (zoom - 1)
    tile_size = 512

    width = tiles_x * tile_size
    height = tiles_y * tile_size

    panorama = Image.new("RGB", (width, height), (0, 0, 0))

    for y in range(tiles_y):
        for x in range(tiles_x):
            try:
                tile_data = fetch_panorama_tile(pano_id, zoom, x, y)
                tile_image = Image.open(BytesIO(tile_data))
                panorama.paste(tile_image, (x * tile_size, y * tile_size))
            except Exception as e:
                print(f"  タイル取得失敗: zoom={zoom}, x={x}, y={y}: {e}")
                raise

    panorama.save(cache_file, "JPEG", quality=90)
    return panorama


def extract_perspective(
    panorama: Image.Image,
    heading: float,
    pitch: float,
    fov: float,
    output_width: int,
    output_height: int
) -> Image.Image:
    """等距円筒図法からパースペクティブ投影で画像を切り出す"""
    pano_width, pano_height = panorama.size
    pano_array = np.array(panorama)

    heading_rad = math.radians(heading)
    pitch_rad = math.radians(pitch)
    fov_rad = math.radians(fov)

    output_array = np.zeros((output_height, output_width, 3), dtype=np.uint8)

    half_fov = fov_rad / 2
    aspect_ratio = output_width / output_height

    for out_y in range(output_height):
        for out_x in range(output_width):
            # 正規化された画面座標 (-1 to 1)
            nx = (2 * out_x) / output_width - 1
            ny = 1 - (2 * out_y) / output_height

            # 視線ベクトルを計算
            x = nx * math.tan(half_fov) * aspect_ratio
            y = ny * math.tan(half_fov)
            z = 1

            # 正規化
            length = math.sqrt(x * x + y * y + z * z)
            vx, vy, vz = x / length, y / length, z / length

            # pitch回転（X軸周り）
            cos_pitch = math.cos(pitch_rad)
            sin_pitch = math.sin(pitch_rad)
            vy2 = vy * cos_pitch - vz * sin_pitch
            vz2 = vy * sin_pitch + vz * cos_pitch
            vy, vz = vy2, vz2

            # heading回転（Y軸周り）
            cos_heading = math.cos(heading_rad)
            sin_heading = math.sin(heading_rad)
            vx2 = vx * cos_heading + vz * sin_heading
            vz3 = -vx * sin_heading + vz * cos_heading
            vx, vz = vx2, vz3

            # 球面座標に変換
            theta = math.atan2(vx, vz)  # 経度 (-PI to PI)
            phi = math.asin(max(-1, min(1, vy)))  # 緯度 (-PI/2 to PI/2)

            # パノラマ画像の座標に変換
            pano_x = ((theta + math.pi) / (2 * math.pi)) * pano_width
            pano_y = ((math.pi / 2 - phi) / math.pi) * pano_height

            # 範囲を制限
            pano_x = max(0, min(pano_width - 1, pano_x))
            pano_y = max(0, min(pano_height - 1, pano_y))

            # 最近傍補間でピクセル値を取得
            src_x = int(pano_x)
            src_y = int(pano_y)
            output_array[out_y, out_x] = pano_array[src_y, src_x]

    return Image.fromarray(output_array)


def calculate_heading(from_lat: float, from_lng: float, to_lat: float, to_lng: float) -> float:
    """2点間の方位角を計算"""
    lat1 = math.radians(from_lat)
    lat2 = math.radians(to_lat)
    delta_lng = math.radians(to_lng - from_lng)

    x = math.sin(delta_lng) * math.cos(lat2)
    y = math.cos(lat1) * math.sin(lat2) - math.sin(lat1) * math.cos(lat2) * math.cos(delta_lng)

    heading = math.degrees(math.atan2(x, y))
    heading = (heading + 360) % 360

    return heading


def fetch_street_view_image(
    lat: float,
    lng: float,
    api_key: str,
    next_lat: float,
    next_lng: float,
    output_width: int = 1280,
    output_height: int = 960,
    zoom: int = 3
) -> str:
    """高解像度のStreet View画像を取得（Base64）"""
    import base64

    TMP_DIR.mkdir(exist_ok=True)

    # 実世界のheadingを計算
    real_world_heading = calculate_heading(lat, lng, next_lat, next_lng)
    pitch = 0
    fov = 90

    # キャッシュファイル名
    cache_file = TMP_DIR / f"highres_{lat}_{lng}_h{round(real_world_heading)}_{output_width}x{output_height}.jpg"

    if cache_file.exists():
        with open(cache_file, "rb") as f:
            return base64.b64encode(f.read()).decode()

    # pano_idを取得
    pano_id = get_panorama_id(lat, lng, api_key)

    # パノラマのヘディングオフセットを取得
    heading_offset = get_panorama_heading_offset(pano_id)

    # パノラマ座標系でのheadingを計算
    panorama_heading = (real_world_heading - heading_offset + 360) % 360

    # パノラマを構築
    panorama = build_panorama(pano_id, zoom)

    # パースペクティブ投影で切り出し
    perspective = extract_perspective(
        panorama,
        panorama_heading,
        pitch,
        fov,
        output_width,
        output_height
    )

    # キャッシュに保存
    perspective.save(cache_file, "JPEG", quality=90)

    with open(cache_file, "rb") as f:
        return base64.b64encode(f.read()).decode()


def download_image(
    lat: float,
    lng: float,
    api_key: str,
    next_lat: float,
    next_lng: float,
    output_width: int = 1280,
    output_height: int = 960,
) -> Path:
    """画像をダウンロードしてパスを返す"""
    real_world_heading = calculate_heading(lat, lng, next_lat, next_lng)
    cache_file = TMP_DIR / f"highres_{lat}_{lng}_h{round(real_world_heading)}_{output_width}x{output_height}.jpg"

    if cache_file.exists():
        return cache_file

    fetch_street_view_image(
        lat, lng, api_key, next_lat, next_lng,
        output_width, output_height
    )

    return cache_file
