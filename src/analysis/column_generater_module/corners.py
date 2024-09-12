from geopandas import GeoDataFrame
from pandas import Series
from src.analysis.column_generater_module.core.calculate_angle_between_vectors import calculate_angle_between_vectors
from geopy.distance import geodesic
import matplotlib.pyplot as plt
# 色の設定: セクションタイプごとの色
color_map = {
    'straight': 'lightgray',
    'right': 'red',
    'left': 'green'
}
def generate(gdf: GeoDataFrame) -> Series:
    def func(row):
        # ステアリングの方向が変わる毎にグループ化
        target = row['steering_wheel_angle_info']
        old_direction = target[0]['direction']
        corners = []
        corner = [target[0]]
        straight =[]
        straightDistance = 0 
        for i in range(1, len(target)):
            current_segment = target[i]
            angle = current_segment['steering_angle']
            distance = current_segment['distance']  # 各セグメントの距離が存在する前提
            point = current_segment['center']

            # angleが10度以下かつ距離の累計が50mを超える場合にストレートの候補として扱う。
            if point == (136.4137515, 35.0098451):
                print(point)
            # else:
            #     print("なしです。")
            if angle < 10:
                straight.append(current_segment)
                straightDistance += distance
                if straightDistance >= 50:
                    # 直前のコーナーを登録
                    # ここの登録タイミングがおかしい。
                    corners.append({'type': old_direction, 'steering_angle_info': corner})
                    # 累積距離が50mを超えたらストレートとして登録
                    corners.append({'type': 'straight', 'steering_angle_info': straight})
                    straight = []
                    straightDistance = 0
                    # old_direction = current_segment['direction']

                    # コーナーの初期化
                    corner = [current_segment]
                    old_direction = current_segment['direction'] # これでよいのか？
            else:
                # ストレートが途中でもコーナー扱いに戻る場合
                if len(straight) > 0:
                    corner += straight # 未登録のストレートを格納
                    # corners.append({'type': 'straight', 'steering_angle_info': straight})
                    straight = []
                    straightDistance = 0

                if current_segment['direction'] == old_direction:
                    corner.append(current_segment)
                else:
                    corners.append({'type': old_direction, 'steering_angle_info': corner})
                    corner = [current_segment]
                    old_direction = current_segment['direction']

        # 最後の未処理のセグメントを追加
        if len(straight) > 0:
            corners.append({'type': 'straight', 'steering_angle_info': straight})
        if len(corner) > 0:
            corners.append({'type': corner[0]['direction'], 'steering_angle_info': corner})
        
        # print(corners)
        
        datas = []
        for corner in corners:
            steering_angle_info = corner['steering_angle_info']
            # The line `max_steering_angle = max(steering_angle_info, key=lambda x:
            # x['steering_angle'])['steering_angle']` is finding the maximum steering angle value
            # within a list of dictionaries.
            # print(steering_angle_info)
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

    # # Matplotlibを使ってプロット
    # fig, ax = plt.subplots()

    # # 各データのセクションごとに色を変えて描画
    # for data in series:
    #     for section in data:
    #         points = section['points']
    #         section_type = section['section_type']
    #         x, y = zip(*points)  # x, y 座標に分割

    #         # セクションタイプごとに色を変える
    #         ax.plot(x, y, color=color_map[section_type])

    # # 凡例を表示
    # handles, labels = ax.get_legend_handles_labels()
    # by_label = dict(zip(labels, handles))
    # ax.legend(by_label.values(), by_label.keys())

    # plt.show()

    return series
