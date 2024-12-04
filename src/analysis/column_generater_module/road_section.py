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
        # 連続する左コーナー、右コーナー、ストレートをグループ化してセクションとする
        sections = group_continuous_section(row['steering_wheel_angle_info'])
        
        # ストレート区間が100m未満の場合は半分に分割して前後のセクションと結合する ※1
        sections = merge_min_straight_section(sections)

        # # 連続する同一方向のセクションをマージ(※1で結合した場合に同一方向のコーナーが連続する場合があるため)
        sections = merge_continuous_section_section(sections)

        # データを整形
        datas = []
        for section in sections:
            steering_angle_info = section['steering_angle_info']
            # セクション内の座標を1つにまとめる
            points = []
            for x in steering_angle_info:
                points.append(x['start'])
                points.append(x['center'])
                points.append(x['end'])
            points = list(dict.fromkeys(points))

            # セクションの距離を計算
            distance = 0
            for i in range(len(points) - 1):
                distance += geodesic(reversed(points[i]), reversed(points[i+1])).meters
            
            # ステアリング角度の最大値、平均値を取得
            max_steering_angle = max(steering_angle_info, key=lambda x: x['steering_angle'])['steering_angle']
            avg_steering_angle = sum([x['steering_angle'] for x in steering_angle_info]) / len(steering_angle_info)

            # ステアリング角度を調整する
            adjusted_steering_angle, elevation_height = adjust_steering_angle(max_steering_angle, points, row.elevation, distance, row.geometry.coords)
            
            datas.append({
                'max_steering_angle': max_steering_angle,
                'avg_steering_angle': avg_steering_angle,
                'adjusted_steering_angle': adjusted_steering_angle,
                'elevation_height_and_distance_ratio': elevation_height / distance,
                'section_type': section['type'],
                'steering_direction': steering_angle_info[0]['direction'],
                'points': points,
                'section_info': steering_angle_info,
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

# 連続する左コーナー、右コーナー、ストレートをグループ化
def group_continuous_section(target):
    # ステアリングの方向が変わる毎にグループ化
    old_direction = target[0]['direction']
    sections = []
    # 右左コーナーの情報
    section_work = [target[0]]
    for i in range(1, len(target)):
        current_segment = target[i]
        angle = current_segment['steering_angle']
        distance = current_segment['distance']
        direction = current_segment['direction']
        if angle < STRAIGHT_ANGLE:
            direction = 'straight'
        
        if direction == old_direction:
            section_work.append(current_segment)
        else:
            sections.append({'type': old_direction, 'steering_angle_info': section_work})
            section_work = [current_segment]
            old_direction = direction
    # 最後の未処理のセグメントを追加
    if len(section_work) > 0:
        sections.append({'type': old_direction, 'steering_angle_info': section_work})
    return sections


# 線形変換: 0.05~0.125 を 1~1.25 の範囲に変換
def scale_to_range(val):
    if val <= 0.05:
        return 1.0
    elif val >= 0.125:
        return 1.25
    else:
        return 1 + (val - 0.05) * (1.25 - 1) / (0.11 - 0.05)

# 短いストレート区間をコーナーセクションにマージ
def merge_min_straight_section(sections):
    # ストレート区間が100m未満の場合は半分に分割して前後のコーナーと結合する
    adjusted_sections = copy.deepcopy(sections)
    is_not_exists_min_straight = True
    while is_not_exists_min_straight:
        # ストレートを抽出
        straights = [x for x in adjusted_sections if x['type'] == 'straight']
        # 100m以下のストレートを抽出
        min_straights = [x for x in straights if sum([y['distance'] for y in x['steering_angle_info']]) < STRAIGHT_DISTANCE]
        if len(min_straights) == 0:
            is_not_exists_min_straight = False
            break
        min_straight_first = min_straights[0]
        # 100m未満の先頭indexを取得
        min_straight_first_index = adjusted_sections.index(min_straight_first)
        steering_angle_info = min_straight_first['steering_angle_info']
        # 前後のコーナーを取得
        if min_straight_first_index == 0:
            # 先頭のコーナーの処理
            next_section = copy.deepcopy(adjusted_sections[min_straight_first_index + 1])
            next_section['steering_angle_info'] = steering_angle_info + next_section['steering_angle_info']
            adjusted_sections[min_straight_first_index + 1] = next_section
        elif min_straight_first_index == len(adjusted_sections) - 1:
            # 末尾のコーナーの処理
            previous_section = copy.deepcopy(adjusted_sections[min_straight_first_index - 1])
            previous_section['steering_angle_info'] += steering_angle_info
            adjusted_sections[min_straight_first_index - 1] = previous_section
        else:
            if(len(steering_angle_info)) >= 2:
                # 前後のコーナーにマージ
                previous_section = copy.deepcopy(adjusted_sections[min_straight_first_index - 1])
                next_section = copy.deepcopy(adjusted_sections[min_straight_first_index + 1])
                # 厳密にストレートの距離の半分を分割するべきだが、一旦は要素数から分割
                previous_section['steering_angle_info'] += steering_angle_info[:len(steering_angle_info)//2]
                next_section['steering_angle_info'] = steering_angle_info[len(steering_angle_info)//2:] + next_section['steering_angle_info']

                adjusted_sections[min_straight_first_index - 1] = previous_section
                adjusted_sections[min_straight_first_index + 1] = next_section
            else:
                # 1件だけの場合は直前のコーナーにマージ
                previous_section = copy.deepcopy(adjusted_sections[min_straight_first_index - 1])
                previous_section['steering_angle_info'] += steering_angle_info
                adjusted_sections[min_straight_first_index - 1] = previous_section

        # ストレートを削除
        adjusted_sections.remove(min_straight_first)
    return adjusted_sections
    

# 連続する同一方向のコーナーをマージ
# 同じ方向のコーナーが連続する場合は結合する。
def merge_continuous_section_section(road_sections):
    merged_lst = []
    i = 0
    target_sections = road_sections
    while i < len(target_sections):
        current_section = target_sections[i].copy()  # 現在のセクションをコピーして使用
        # 次のセクションが同じタイプか確認
        while i + 1 < len(target_sections) and target_sections[i]['type'] == target_sections[i + 1]['type']:
            # 次のセクションが同じタイプであれば、steering_angle_infoを結合
            current_section['steering_angle_info'] += target_sections[i + 1]['steering_angle_info']
            i += 1  # 次のセクションをスキップ

        # 結合したセクション（または単一のセクション）をリストに追加
        merged_lst.append(current_section)
        i += 1  # 次のセクションに移動
    return merged_lst

# ステアリング角度を調整する
def adjust_steering_angle(steering_angle, points, elevation, distance, coords) -> tuple[float, float]:
    # 標高の変化量を計算する。始点と終点を間の値を使っているためindex番号をずらす。
    point_st = points[1]
    point_end = points[-2]
    coords = list(coords)
    
    index_st = coords.index(point_st)
    index_end = coords.index(point_end)
    elevation_section = elevation[index_st:index_end+1]
    # 始点と終点の間の標高値を追加(ステアリング切れ角の座標は中間点なのでそれを補完するためのもの)
    elevation_section.insert(0, (elevation[index_st - 1] + elevation[index_st]) / 2)
    elevation_section.append((elevation[index_end + 1] + elevation[index_end]) / 2)
    
    # 標高の高さを取得
    elevation_min = min(elevation_section)
    elevation_max = max(elevation_section)
    elevation_height = elevation_max - elevation_min

    # 勾配がついている場合はステアリング角度を増やす
    elevation_height_and_distance_ratio = elevation_height / distance
    adjusted_steering_angle = steering_angle * scale_to_range(elevation_height_and_distance_ratio)
    return adjusted_steering_angle, elevation_height