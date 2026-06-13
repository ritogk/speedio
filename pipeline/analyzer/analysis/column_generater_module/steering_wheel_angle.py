from geopandas import GeoDataFrame
from pandas import Series
import numpy as np
from pyproj import Transformer
from ...core.calc_steering_wheel_angle import calc_steering_wheel_angle

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
            
            angle, radius, center, direction = calc_steering_wheel_angle(p1, p2, p3, wheelbase, steering_ratio)
            # p1, p2, p3の距離を求める
            distance = np.linalg.norm(p1 - p2) + np.linalg.norm(p2 - p3)
            # print(f"direction: {direction}")
            # print(f"distance {distance}")
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