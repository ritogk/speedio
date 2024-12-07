import numpy as np

## 3座標を自動車が走行するのに必要なステアリング舵角の求め方
# 1. linestring内から座標を3つ抜きだす
# 2. 抜き出した座標が円の外周と重なる円を作り半径を求める
# 3. 半径(斜辺)と自動車のホイールベース(底辺)から直角三角形のθを求める。
# 4. タイヤの舵角(90° - θ)を求める
# 5. タイヤの舵角をステアリングの舵角に変換する
# 上記を1座標ずらしながら全座座標間の計算を行えばステアリング舵角の推移が求まる

# 3座標を通過するステアリングホイールの角度を計算する
# p1, p2, p3は平面直角座標系であること
def calc_steering_wheel_angle(p1: np.ndarray
                              , p2: np.ndarray
                              , p3: np.ndarray
                              , wheel_base: int
                              , steering_ratio: int) -> tuple[float, float, tuple, str]:
    direction = calc_direction(p1, p2, p3)
    
    p2_adjusted = offset_point(p1, p2, p3, direction)
    p2 = p2_adjusted

    angle = 0
    try:
        # 3点を通る円の中心と半径を計算
        center, radius = calc_circle_center_and_radius(p1 ,p2, p3)
        angle = steering_angle(wheel_base, radius, steering_ratio)
        # 一般的はステアリングがまっすぐの状態で左右に1.7回転切れる。よって片側の回転角度の最大値は612度。
        # osmのラインの形状がおかしいと思われるので、一旦異常値いとして扱う。
        if angle > 612:
            print(f"  🚨 ステアリング角が異常値です。ステアリング角: {angle}, 座標: {p2}")
            # 一旦以上値を10度にしておく
            angle = 10
    except ValueError as e:
        # 3点が直線上にある場合はステアリング角を0とする
        angle = 0
        radius = 0
        center = (0, 0)
        direction = "straight"
        print("直線だよ")
    return angle, radius, center, direction

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
    tire_angle = 90 - (np.arccos(wheelbase / radius) * (180 / np.pi))  # タイヤの舵角を計算. (180 / np.pi)はラジアンから度に変換するため
    steering_wheel_angle = tire_angle * steering_ratio  # タイヤの舵角をステアリングの舵角に変換
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
        # print(f"offset_distance:{offset_distance} distance_to_line:{distance_to_line}")
        # print("★★★★★★★★★★★★★★★★★★")
        # ほぼ直線にする
        offset_distance = distance_to_line * 0.8
    # p2を垂線方向に指定された距離だけオフセットする
    if direction == "left":
        p2_adjusted = np.array(p2) + v_perpendicular_unit * offset_distance
    elif direction == "right":
        p2_adjusted = np.array(p2) - v_perpendicular_unit * offset_distance
    return p2_adjusted