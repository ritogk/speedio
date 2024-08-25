from geopandas import GeoDataFrame
from pandas import Series
import numpy as np
from pyproj import Transformer
from geopy.distance import geodesic

# 各座標毎のステアリング角を計算する
def generate(gdf: GeoDataFrame) -> Series:
    wheelbase = 2.5  # 一般的な車のホイールベース（メートル）
    steering_ratio = 15  # 一般的なステアリングギア比

    def func(row):
        angles_info = []
        coords = row['geometry'].coords
        adjustedCoords = [coords[0]]
        # 各座標間の中間点を求めて追加する
        for i in range(1, len(coords)):
            p1 = coords[i - 1]
            p2 = coords[i]
            betweenPoint = ((p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2)
            adjustedCoords.append(betweenPoint)
            adjustedCoords.append(p2)

        # 計算を行いやすくするために平面座標系(m単位)に変換
        xy_adjustedCoords = generate_xy_coords(adjustedCoords)

        group_size = 3
        for i in range(1, len(xy_adjustedCoords) - group_size, 2):
            group = xy_adjustedCoords[i:i + group_size]
            if len(group) < group_size:
                print("break")
                break
            p1 = group[0]
            p2 = group[1]
            p3 = group[2]
            angle = 0
            try:
                center, radius = calc_circle_center_and_radius(p1 ,p2, p3)
                angle = steering_angle(wheelbase, radius, steering_ratio)
                # 一般的はステアリングがまっすぐの状態で左右に1.7回転切れる。よって片側の回転角度の最大値は612度。
                # osmのラインの形状がおかしいと思われるので、一旦異常値いとして扱う。
                if angle > 612:
                    print(f"  🚨 ステアリング角が異常値です。ステアリング角: {angle}, 座標: {adjustedCoords[i]}")
                    # 一旦以上値を10度にしておく
                    angle = 10
            except ValueError as e:
                # 3点が直線上にある場合はステアリング角を0とする
                angle = 0
            # p1, p2, p3の距離を求める
            distance = np.linalg.norm(p1 - p2) + np.linalg.norm(p2 - p3)
            direction = calc_direction(p1, p2, p3)
            angles_info.append({'start':adjustedCoords[i],
                                'center': adjustedCoords[i+1],
                                'end': adjustedCoords[i+2],
                                'steering_angle': angle,
                                'radius': radius,
                                'distance': distance,
                                'direction': direction})
        # # 結果を出力
        # for info in angles_info:
        #     print(f"座標 {info['center']} でのステアリングホイールの回転角度: {info['steering_angle']:.2f} 度")
        return angles_info
    results = gdf.apply(func, axis=1)
    return results

# 平面直角座標に変換
def generate_xy_coords(coords: list):
    # MEMO: 東京の平面直角座標のEPSGだが本当によいのか？値はそれっぽいが。
    # https://lemulus.me/column/epsg-list-gis
    transformer = Transformer.from_crs(4326, 6677)
    trans_coords = transformer.itransform(coords, switch=True)
    return np.array(list(trans_coords))

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

# 3点の方向を計算
def calc_direction(pm1, p2, p3):
    det = (p2[0] - pm1[0]) * (p3[1] - p2[1]) - (p2[1] - pm1[1]) * (p3[0] - p2[0])
    if det > 0:
        direction = "left"
    elif det < 0:
        direction = "right"
    else:
        direction = "straight"
    return direction