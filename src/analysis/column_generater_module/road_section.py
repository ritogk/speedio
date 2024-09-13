from geopandas import GeoDataFrame
from pandas import Series
from geopy.distance import geodesic
import matplotlib.pyplot as plt

STRAIGHT_DISTANCE = 50
STRAIGHT_ANGLE = 8
#
# 右左コーナー、ストレートの情報を抽出する
# ストレートはステアリング角度が8度以下で50m以上の区間とする。
#
def generate(gdf: GeoDataFrame) -> Series:
    def func(row):
        # ステアリングの方向が変わる毎にグループ化
        target = row['steering_wheel_angle_info']
        old_direction = target[0]['direction']
        corners = []
        # 右左コーナーの情報
        corner = [target[0]]
        # ストレート区間の情報
        straight =[]
        straightDistance = 0 
        for i in range(1, len(target)):
            current_segment = target[i]
            angle = current_segment['steering_angle']
            distance = current_segment['distance']
            direction = current_segment['direction']
            if angle < STRAIGHT_ANGLE:
                straight.append(current_segment)
                straightDistance += distance
            else:
                if straightDistance >= STRAIGHT_DISTANCE:
                    corners.append({'type': old_direction, 'steering_angle_info': corner})
                    old_direction = direction
                    corner = [current_segment]
                    corners.append({'type': 'straight', 'steering_angle_info': straight})
                    straight = []
                    straightDistance = 0
                    continue
                # 途中でコーナーに戻る場合。angle: 20→ angle: 5→ angle:30の要な場合はストレート情報を破棄してコーナーにマージする。
                if len(straight) >=1 and straightDistance < STRAIGHT_DISTANCE:
                    corner += straight
                    straight = []
                    straightDistance = 0

                if direction == old_direction:
                    corner.append(current_segment)
                else:
                    corners.append({'type': old_direction, 'steering_angle_info': corner})
                    corner = [current_segment]
                    old_direction = direction

        # 最後の未処理のセグメントを追加
        if len(straight) > 0:
            corners.append({'type': 'straight', 'steering_angle_info': straight})
        if len(corner) > 0:
            corners.append({'type': corner[0]['direction'], 'steering_angle_info': corner})
        
        datas = []
        for corner in corners:
            steering_angle_info = corner['steering_angle_info']
            max_steering_angle = max(steering_angle_info, key=lambda x: x['steering_angle'])['steering_angle']
            avg_steering_angle = sum([x['steering_angle'] for x in steering_angle_info]) / len(steering_angle_info)
            # コーナー内の座標をつなげる。
            points = []
            for x in steering_angle_info:
                points.append(x['start'])
                points.append(x['center'])
                points.append(x['end'])
            # 並び順を維持したまま重複を削除
            points = list(dict.fromkeys(points))
            # pointsから距離(m)を計算
            distance = 0
            for i in range(len(points) - 1):
                distance += geodesic(reversed(points[i]), reversed(points[i+1])).meters
            datas.append({
                'max_steering_angle': max_steering_angle,
                'avg_steering_angle': avg_steering_angle,
                'section_type': corner['type'],
                'steering_direction': steering_angle_info[0]['direction'],
                'points': points,
                'corner_info': steering_angle_info,
                'distance': distance,
            })

        return datas

    series = gdf.apply(func, axis=1)

    # 色の設定: セクションタイプごとの色
    color_map = {
        'straight': 'lightgray',
        'right': 'red',
        'left': 'green'
    }
    # Matplotlibを使ってプロット
    fig, ax = plt.subplots()

    # 各データのセクションごとに色を変えて描画
    for data in series:
        for section in data:
            points = section['points']
            section_type = section['section_type']
            x, y = zip(*points)  # x, y 座標に分割

            # セクションタイプごとに色を変える
            ax.plot(x, y, color=color_map[section_type])

    # 凡例を表示
    handles, labels = ax.get_legend_handles_labels()
    by_label = dict(zip(labels, handles))
    ax.legend(by_label.values(), by_label.keys())

    plt.show()

    return series
