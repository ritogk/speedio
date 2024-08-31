from geopandas import GeoDataFrame
from pandas import Series
import numpy as np
from pyproj import Transformer

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
            direction = calc_direction(p1, p2, p3)
            
            p2_adjusted = offset_point(p1, p2, p3, direction)
            p2 = p2_adjusted

            angle = 0
            try:
                center, radius = calc_circle_center_and_radius(p1 ,p2, p3)
                angle = steering_angle(wheelbase, radius, steering_ratio)
                print("before")
                # print(p1_t, p2_t, p3_t) 
                print(f" angle:🚨 {angle}")
                # center_, radius_ = calc_circle_center_and_radius(p1 ,p2_adjusted, p3)
                # angle_ = steering_angle(wheelbase, radius_, steering_ratio)
                # print("after")
                # # print(p1_t, p2_adjusted_t, p3_t) 
                # print(f" angle-2:🚨 {angle_}")
                if(angle >= 100):
                    print(f"🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨")
                else:
                     pass   
                # 一般的はステアリングがまっすぐの状態で左右に1.7回転切れる。よって片側の回転角度の最大値は612度。
                # osmのラインの形状がおかしいと思われるので、一旦異常値いとして扱う。
                if angle > 612:
                    print(f"  🚨 ステアリング角が異常値です。ステアリング角: {angle}, 座標: {adjustedCoords[i]}")
                    # 一旦以上値を10度にしておく
                    angle = 10
            except ValueError as e:
                # 3点が直線上にある場合はステアリング角を0とする
                angle = 0
                print("直線だよ")
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

# p2をp1p3に垂直にオフセットする処理
def offset_point(p1, p2, p3, direction):
    default_offset_distance = 0.7
    if direction == "straight":
        return p2
    # p1-p3の距離が10mを超える場合はオフセット距離を縮める。
    distance_p1_p3 = np.linalg.norm(np.array(p3) - np.array(p1))
    if distance_p1_p3 > 10:
        offset_distance = default_offset_distance / np.sqrt(distance_p1_p3 / 10)
    else:
        offset_distance = default_offset_distance
    # p1からp3へのベクトルを計算
    v = np.array([p3[0] - p1[0], p3[1] - p1[1]])
    # ベクトルvに垂直なベクトルを計算 (右手系の90度回転)
    v_perpendicular = np.array([-v[1], v[0]])
    # 単位ベクトルに正規化
    v_perpendicular_unit = v_perpendicular / np.linalg.norm(v_perpendicular)
    
    # p2からp1-p3直線への垂直距離を計算
    distance_to_line = np.abs(np.dot(v_perpendicular_unit, np.array(p2) - np.array(p1)))

    # オフセット距離が垂直距離を超えないようにする
    if offset_distance > distance_to_line:
        print(f"offset_distance:{offset_distance} distance_to_line:{distance_to_line}")
        print("★★★★★★★★★★★★★★★★★★")
        # 直線にする
        offset_distance = distance_to_line * 0.8
    # p2を垂線方向に指定された距離だけオフセットする
    if direction == "left":
        p2_adjusted = np.array(p2) + v_perpendicular_unit * offset_distance
    elif direction == "right":
        p2_adjusted = np.array(p2) - v_perpendicular_unit * offset_distance
    return p2_adjusted