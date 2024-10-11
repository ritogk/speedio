from geopandas import GeoDataFrame
from pandas import Series
from geopy.distance import geodesic
import matplotlib.pyplot as plt
import copy

STRAIGHT_DISTANCE = 100
STRAIGHT_ANGLE = 7
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
        for i in range(1, len(target)):
            current_segment = target[i]
            angle = current_segment['steering_angle']
            distance = current_segment['distance']
            direction = current_segment['direction']
            if angle < STRAIGHT_ANGLE:
                direction = 'straight'
            
            if direction == old_direction:
                corner.append(current_segment)
            else:
                corners.append({'type': old_direction, 'steering_angle_info': corner})
                corner = [current_segment]
                old_direction = direction
        # 最後の未処理のセグメントを追加
        if len(corner) > 0:
            corners.append({'type': old_direction, 'steering_angle_info': corner})

        # ストレート区間が100m未満の場合は半分に分割して前後のコーナーと結合する
        corners = merge_min_straight_section(corners)

        # 同じ方向のコーナーが連続する場合は結合する。
        # 60m以下のコーナーがマージの対象。
        # ステアリングアングルが大きい方に取り込む
        adjusted_corners = copy.deepcopy(corners)
        

        # データを整形
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
            
            # 標高の変化量を計算する。始点と終点を間の値を使っているためindex番号をずらす。
            point_st = points[1]
            point_end = points[-2]
            coords = list(row.geometry.coords)
            index_st = coords.index(point_st)
            index_end = coords.index(point_end)
            elevation_corner = row.elevation[index_st:index_end+1]
            # 始点と終点の間の標高値を追加
            elevation_corner.insert(0, (row.elevation[index_st - 1] + row.elevation[index_st]) / 2)
            elevation_corner.append((row.elevation[index_end + 1] + row.elevation[index_end]) / 2)
            
            # 標高の高さを取得
            elevation_min = min(elevation_corner)
            elevation_max = max(elevation_corner)
            elevation_height = elevation_max - elevation_min

            # 勾配におうじてステアリング角度を調整
            elevation_height_and_distance_ratio = elevation_height / distance
            adjusted_steering_angle = max_steering_angle * scale_to_range(elevation_height_and_distance_ratio)

            
            datas.append({
                'max_steering_angle': max_steering_angle,
                'avg_steering_angle': avg_steering_angle,
                'adjusted_steering_angle': adjusted_steering_angle,
                'elevation_height_and_distance_ratio': elevation_height / distance,
                'section_type': corner['type'],
                'steering_direction': steering_angle_info[0]['direction'],
                'points': points,
                'corner_info': steering_angle_info,
                'distance': distance,
                'elevation_height': elevation_height,
            })

        return datas

    series = gdf.apply(func, axis=1)

    # # 色の設定: セクションタイプごとの色
    # color_map = {
    #     'straight': 'lightgray',
    #     'right': 'red',
    #     'left': 'green'
    # }
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

# 線形変換: 0.05~0.125 を 1~1.25 の範囲に変換
def scale_to_range(val):
    if val <= 0.05:
        return 1.0
    elif val >= 0.125:
        return 1.25
    else:
        return 1 + (val - 0.05) * (1.25 - 1) / (0.11 - 0.05)

# 短いストレート区間をコーナーセクションにマージ
def merge_min_straight_section(corners):
    # ストレート区間が100m未満の場合は半分に分割して前後のコーナーと結合する
    adjusted_corners = copy.deepcopy(corners)
    is_not_exists_min_straight = True
    while is_not_exists_min_straight:
        # ストレートを抽出
        straights = [x for x in adjusted_corners if x['type'] == 'straight']
        # 100m以下のストレートを抽出
        min_straights = [x for x in straights if sum([y['distance'] for y in x['steering_angle_info']]) < STRAIGHT_DISTANCE]
        if len(min_straights) == 0:
            is_not_exists_min_straight = False
            break
        min_straight_first = min_straights[0]
        # 100m未満の先頭indexを取得
        min_straight_first_index = adjusted_corners.index(min_straight_first)
        steering_angle_info = min_straight_first['steering_angle_info']
        # 前後のコーナーを取得
        if min_straight_first_index == 0:
            # 先頭のコーナーの処理
            next_corner = copy.deepcopy(adjusted_corners[min_straight_first_index + 1])
            next_corner['steering_angle_info'] = steering_angle_info + next_corner['steering_angle_info']
            adjusted_corners[min_straight_first_index + 1] = next_corner
        elif min_straight_first_index == len(adjusted_corners) - 1:
            # 末尾のコーナーの処理
            previous_corner = copy.deepcopy(adjusted_corners[min_straight_first_index - 1])
            previous_corner['steering_angle_info'] += steering_angle_info
            adjusted_corners[min_straight_first_index - 1] = previous_corner
        else:
            if(len(steering_angle_info)) >= 2:
                # 前後のコーナーにマージ
                previous_corner = copy.deepcopy(adjusted_corners[min_straight_first_index - 1])
                next_corner = copy.deepcopy(adjusted_corners[min_straight_first_index + 1])
                # 厳密にストレートの距離の半分を分割するべきだが、一旦は要素数から分割
                previous_corner['steering_angle_info'] += steering_angle_info[:len(steering_angle_info)//2]
                next_corner['steering_angle_info'] = steering_angle_info[len(steering_angle_info)//2:] + next_corner['steering_angle_info']

                adjusted_corners[min_straight_first_index - 1] = previous_corner
                adjusted_corners[min_straight_first_index + 1] = next_corner
            else:
                # 1件だけの場合は直前のコーナーにマージ
                previous_corner = copy.deepcopy(adjusted_corners[min_straight_first_index - 1])
                previous_corner['steering_angle_info'] += steering_angle_info
                adjusted_corners[min_straight_first_index - 1] = previous_corner

        # ストレートを削除
        adjusted_corners.remove(min_straight_first)
    return adjusted_corners