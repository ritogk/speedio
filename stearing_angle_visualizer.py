import numpy as np
import matplotlib.pyplot as plt
from pyproj import Transformer

# 座標のリスト
coords = [(137.0004548, 35.3743498), (137.0004336, 35.3745886), (137.0003903, 35.3748235), (137.0003694, 35.3750441), (137.0004961, 35.3753101), (137.0006078, 35.3754559), (137.0007034, 35.3756092), (137.0007325, 35.3756998), (137.0007227, 35.375798), (137.0006654, 35.3758627), (137.0005872, 35.375951), (137.0004296, 35.3761273), (137.0002505, 35.3763875), (137.0000388, 35.3767593), (136.9999281, 35.3770514), (136.9998629, 35.3774284), (136.9998923, 35.3777126), (136.9999379, 35.377917), (136.9999151, 35.3781958), (136.9998629, 35.3784162), (136.9996513, 35.3788145), (136.9995168, 35.3791836), (136.9994168, 35.3795182), (136.9993972, 35.3797014), (136.999394, 35.3798714), (136.9993582, 35.3799484), (136.9992865, 35.3799882), (136.9991934, 35.379994), (136.9989185, 35.3799479), (136.9987089, 35.3799316), (136.9985854, 35.3799377), (136.998434, 35.379968), (136.998254, 35.380069), (136.9980413, 35.3802207), (136.9977763, 35.3803834), (136.9975054, 35.3805074), (136.9973234, 35.3806093), (136.9971941, 35.3807409), (136.997147, 35.38086), (136.997155, 35.381012), (136.997182, 35.381149), (136.9972479, 35.381462), (136.9972548, 35.3816153), (136.9972371, 35.3817673), (136.9970588, 35.3819846), (136.9969234, 35.3821377), (136.9967785, 35.3822962), (136.9967249, 35.3825182), (136.996741, 35.3828244), (136.9966592, 35.3830245), (136.9964084, 35.3833579), (136.9962957, 35.3835679), (136.9961616, 35.3840227), (136.9957703, 35.3846258), (136.995357, 35.385272), (136.9951669, 35.3855567), (136.9949696, 35.3858473), (136.994911, 35.385986), (136.994878, 35.3861332), (136.9949169, 35.3864959), (136.9948351, 35.3866961), (136.994711, 35.386859), (136.9945158, 35.387097)]

def generate_xy_coords(coords: list):
    # MEMO: 東京の平面直角座標のEPSGだが本当によいのか？値はそれっぽいが。
    # https://lemulus.me/column/epsg-list-gis
    transformer = Transformer.from_crs(4326, 6677)
    trans_coords = transformer.itransform(coords, switch=True)
    return np.array(list(trans_coords))

# 緯度経度をメートルに変換
points_m = generate_xy_coords(coords)


# 車のパラメータ
wheelbase = 2.5  # 一般的な車のホイールベース（メートル）
steering_ratio = 15  # 一般的なステアリングギア比

# 3点を通る円の中心の座標と半径を計算
def calc_circle_center_and_radius(p1, p2, p3):
    # chatgptに作ってもらいました。
    temp = p2[0]**2 + p2[1]**2
    bc = (p1[0]**2 + p1[1]**2 - temp) / 2
    cd = (temp - p3[0]**2 - p3[1]**2) / 2
    det = (p1[0] - p2[0]) * (p2[1] - p3[1]) - (p2[0] - p3[0]) * (p1[1] - p2[1])

    if abs(det) < 1.0e-10:
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

# 結果を保持するリスト
angles_info = []

# 3つのポイントずつ処理してステアリングホイールの回転角度を計算
for i in range(1, len(points_m) - 1):
    p1 = points_m[i - 1]
    p2 = points_m[i]
    p3 = points_m[i + 1]
    center, radius = calc_circle_center_and_radius(p1, p2, p3)
    angle = steering_angle(wheelbase, radius, steering_ratio)
    angles_info.append((i, coords[i], angle))

# 結果を出力
for i, coord, angle in angles_info:
    print(f"座標 {coord} でのステアリングホイールの回転角度: {angle:.2f} 度")

# プロット
plt.figure(figsize=(10, 10))
plt.plot(points_m[:, 0], points_m[:, 1], 'b-', label='Path')
plt.plot(points_m[:, 0], points_m[:, 1], 'ro', label='points',markersize=2, color='darkgray')

# ターンポイントをプロット
for i, coord, angle in angles_info:
    color= "green"
    size = 4
    if angle <= 15:
        continue
    if angle < 25:
        color = "orange"
        size = 4
    elif angle < 45:
        color="orange"
        size = 4
    elif angle < 65:
        color="orange"
        size = 7
    elif angle < 89:
        color="red"
        size = 9
    elif angle < 115:
        color="red"
        size = 12
    elif angle < 145:
        color="darkred"
        size = 14
    else:
        color="darkred"
        size = 20
    color="red"

    plt.plot(points_m[i, 0], points_m[i, 1], 'go', markersize=size, color=color, alpha=0.2)
        # if angle >= 45:
        #     plt.text(points_m[i, 0], points_m[i, 1], f"{angle:.2f}°", fontsize=7, ha='right')

plt.xlabel('Meters (X)')
plt.ylabel('Meters (Y)')
plt.legend()
plt.title('Turning Points with Steering Wheel Angles')
plt.grid(True)
plt.gca().set_aspect('equal', adjustable='box')
plt.show()
