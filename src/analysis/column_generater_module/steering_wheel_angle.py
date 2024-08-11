from geopandas import GeoDataFrame
from pandas import Series
import numpy as np

# 各座標毎のステアリング角を計算する
def generate(gdf: GeoDataFrame) -> Series:
    wheelbase = 2.5  # 一般的な車のホイールベース（メートル）
    steering_ratio = 15  # 一般的なステアリングギア比

    def func(row):
        angles_info = []
        coords = row['geometry'].coords
        # 基準となる緯度を計算（最初の点の緯度を使用）
        ref_lat = coords[0][1]
        # 座標系をメートルに変換
        points_m = np.array([lat_lon_to_meters(lat, lon, ref_lat) for lat, lon in coords])
        for i in range(1, len(coords) - 1):
            p1 = points_m[i - 1]
            p2 = points_m[i]
            p3 = points_m[i + 1]
            angle = 0
            try:
                center, radius = calc_circle_center_and_radius(p1, p2, p3)
                angle = steering_angle(wheelbase, radius, steering_ratio)
                # p1, p2, p3の距離を求める
                distance = np.linalg.norm(p1 - p2) + np.linalg.norm(p2 - p3)
            except ValueError as e:
                # 3点が直線上にある場合はステアリング角を0とする
                angle = 0
            angles_info.append((i, coords[i], angle, radius, distance))
        # # 結果を出力
        # for i, coord, angle in angles_info:
        #     print(f"座標 {coord} でのステアリングホイールの回転角度: {angle:.2f} 度")
        return angles_info
    results = gdf.apply(func, axis=1)
    return results

# 緯度経度座標系メートルに変換する
def lat_lon_to_meters(lat, lon, ref_lat):
    lat_to_m = 111320  # 緯度1度あたりのメートル換算
    lon_to_m = 111320 * np.cos(np.deg2rad(ref_lat))  # 経度1度あたりのメートル換算（緯度に依存）
    return lat * lat_to_m, lon * lon_to_m

# 3点を通る円の中心の座標と半径を計算
def calc_circle_center_and_radius(p1, p2, p3):
    # chatgptに作ってもらいました。
    temp = p2[0]**2 + p2[1]**2
    bc = (p1[0]**2 + p1[1]**2 - temp) / 2
    cd = (temp - p3[0]**2 - p3[1]**2) / 2
    det = (p1[0] - p2[0]) * (p2[1] - p3[1]) - (p2[0] - p3[0]) * (p1[1] - p2[1])

    if abs(det) < 1.0e-10:
        # 3点が直線上にある場合
        raise ValueError("Points are collinear")

    # 円の中心 (cx, cy)
    cx = (bc * (p2[1] - p3[1]) - cd * (p1[1] - p2[1])) / det
    cy = ((p1[0] - p2[0]) * cd - (p2[0] - p3[0]) * bc) / det

    # 半径
    radius = np.sqrt((cx - p1[0])**2 + (cy - p1[1])**2)

    return (cx, cy), radius

# ステアリング切れ角を計算
def steering_angle(wheelbase, radius, steering_ratio):
    tire_angle = np.arctan(wheelbase / radius) * (180 / np.pi)  # タイヤの回転角度を度に変換
    steering_wheel_angle = tire_angle * steering_ratio  # ステアリングホイールの回転角度
    return steering_wheel_angle