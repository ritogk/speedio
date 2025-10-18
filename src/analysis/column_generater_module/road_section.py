from geopandas import GeoDataFrame
from pandas import Series
from geopy.distance import geodesic
import matplotlib.pyplot as plt
import copy
from typing import Literal

STRAIGHT_DISTANCE = 100
STRAIGHT_ANGLE = 7
WEEK_CORNER_ANGLE_MIN = STRAIGHT_ANGLE
WEEK_CORNER_ANGLE_MAX = 45
MEDIUM_CORNER_ANGLE_MIN = 45
MEDIUM_CORNER_ANGLE_MAX = 80
STRONG_CORNER_ANGLE_MIN = 80
#
# 右左コーナー、ストレートの情報を抽出する
# ストレートはステアリング角度が8度以下で30m以上の区間とする。
#
def generate(gdf: GeoDataFrame) -> Series:
    def func(row):
        # 連続する左コーナー、右コーナー、ストレートをグループ化してセクションとする
        sections = group_continuous_section(row['steering_wheel_angle_info'])
        
        # ストレート区間が100m未満の場合は半分に分割して前後のセクションと結合する ※1
        # 100mの以下のストレートは踏めないのでコーナーにマージする。
        # ✨️ん？高速コーナーはアクセル全開で踏める区間という扱いなので、直前のコーナーが高速コーナーならマージしない方が良いのでは？
        sections = merge_min_straight_section(sections)
        
        sections = merge_corner_with_straight_if_short(sections, merge_distance=50)

        # # # 連続する同一方向のセクションをマージ(※1で結合した場合に同一方向のコーナーが連続する場合があるため)これは最後の処理。
        # # ✨️ん？これマージしちゃだめじゃね?低速と中速コーナーがまとまってしまう。
        # sections = merge_continuous_section_section(sections)

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
                'corner_level': generate_corner_level(max_steering_angle),
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
    

# left/rightコーナーの最大ステアリングangleから先頭・末尾までの距離が40m以下の場合、前後ストレートから40m分をコーナーに結合する
def merge_corner_with_straight_if_short(sections, merge_distance=40):
    new_sections = copy.deepcopy(sections)
    n = len(new_sections)
    for i, section in enumerate(new_sections):
        if section['type'] not in ['left', 'right']:
            continue
        steering_infos = section['steering_angle_info']
        if not steering_infos:
            continue
        # 最大ステアリングangleのindex
        max_idx = max(range(len(steering_infos)), key=lambda j: abs(steering_infos[j]['steering_angle']))
        # 先頭からmax_idxまでの距離
        st_dist = sum(x['distance'] for x in steering_infos[:max_idx+1])
        # max_idxから末尾までの距離
        ed_dist = sum(x['distance'] for x in steering_infos[max_idx:])

        # 前側が短い場合
        if st_dist < merge_distance and i > 0 and new_sections[i-1]['type'] == 'straight':
            prev_infos = new_sections[i-1]['steering_angle_info']
            dist = 0
            merge_idx = len(prev_infos)
            for j in range(len(prev_infos)-1, -1, -1):
                dist += prev_infos[j]['distance']
                if dist >= (merge_distance - st_dist):
                    merge_idx = j
                    break
            # ストレートから切り出してコーナー頭にマージ
            merge_infos = prev_infos[merge_idx:]
            # 先頭・末尾のstart/end座標重複を除去してマージ
            if merge_infos and steering_infos:
                if merge_infos[-1].get('end') == steering_infos[0].get('start'):
                    steering_infos[0]['start'] = merge_infos[-1]['start']
                    merge_infos = merge_infos[:-1]
            section['steering_angle_info'] = merge_infos + steering_infos
            new_sections[i-1]['steering_angle_info'] = prev_infos[:merge_idx]

        # 後ろ側が短い場合
        if ed_dist < merge_distance and i < n-1 and new_sections[i+1]['type'] == 'straight':
            next_infos = new_sections[i+1]['steering_angle_info']
            dist = 0
            merge_idx = 0
            for j in range(len(next_infos)):
                dist += next_infos[j]['distance']
                if dist >= (merge_distance - ed_dist):
                    merge_idx = j+1
                    break
            # ストレートから切り出してコーナー末尾にマージ
            merge_infos = next_infos[:merge_idx]
            # 末尾のend座標重複を除去してマージ
            if steering_infos and merge_infos:
                if steering_infos[-1].get('end') == merge_infos[0].get('start'):
                    steering_infos[-1]['end'] = merge_infos[0]['end']
                    merge_infos = merge_infos[1:]
            section['steering_angle_info'] = steering_infos + merge_infos
            new_sections[i+1]['steering_angle_info'] = next_infos[merge_idx:]

    # ステアリング情報が空になったストレートを除外
    return [s for s in new_sections if s['type'] != 'straight' or len(s['steering_angle_info']) > 0]

# コーナーの距離を伸ばす。max_stearing_angleの座標から前後30mをコーナーとしたい。これを実現するために、コーナーの前後に30mの範囲を持つストレートを探し、コーナーにマージする。
def extend_corner_distance(road_sections):
    # 指定距離
    merge_distance = 30
    new_sections = []
    n = len(road_sections)
    for i, section in enumerate(road_sections):
        if section['type'] not in ['left', 'right']:
            new_sections.append(section)
            continue

        # コーナーの最大ステアリング角度のインデックスを取得
        max_steering_angle_index = max(section['steering_angle_info'], key=lambda x: x['steering_angle'])['steering_angle']
        # 開始index ~ max_steering_Angleまでの距離を計算
        st_distance = sum([x['distance'] for x in section['steering_angle_info'][:max_steering_angle_index]])
        # 終了index ~ max_steering_Angleまでの距離を計算
        ed_distance = sum([x['distance'] for x in section['steering_angle_info'][max_steering_angle_index:]])

        # コーナーの前にあると好ましい距離
        corner_preferred_distance = 50

        st_straight_distance = 0
        if i > 0 and road_sections[i-1]['type'] == 'straight':
            prev_infos = road_sections[i-1]['steering_angle_info']
            # コーナー頭直前のストレートの末尾からmerge_distanceまで
            dist = 0
            merge_idx = len(prev_infos)
            for j in range(len(prev_infos)-1, -1, -1):
                dist += prev_infos[j]['distance']
                if dist >= merge_distance:
                    merge_idx = j
                    break
            st_straight_distance = dist
            # 必要ならストレートから切り出してコーナー頭にマージ
            if st_straight_distance < merge_distance:
                need = merge_distance - st_straight_distance
                # さらに前のストレートがあれば追加で切り出し
                add_infos = []
                if i > 1 and road_sections[i-2]['type'] == 'straight':
                    add_prev_infos = road_sections[i-2]['steering_angle_info']
                    add_dist = 0
                    add_merge_idx = len(add_prev_infos)
                    for j in range(len(add_prev_infos)-1, -1, -1):
                        add_dist += add_prev_infos[j]['distance']
                        if add_dist >= need:
                            add_merge_idx = j
                            break
                    if add_dist >= need:
                        add_infos = add_prev_infos[add_merge_idx:]
                        road_sections[i-2]['steering_angle_info'] = add_prev_infos[:add_merge_idx]
                # ストレートから切り出し
                merge_infos = prev_infos[merge_idx:] + add_infos
                section['steering_angle_info'] = merge_infos + section['steering_angle_info']
                road_sections[i-1]['steering_angle_info'] = prev_infos[:merge_idx]
            elif st_straight_distance >= merge_distance:
                # 既存ストレートからmerge_distance分だけ切り出してマージ
                section['steering_angle_info'] = prev_infos[merge_idx:] + section['steering_angle_info']
                road_sections[i-1]['steering_angle_info'] = prev_infos[:merge_idx]

        # コーナーケツ側のストレート距離を計算
        ed_straight_distance = 0
        if i < n-1 and road_sections[i+1]['type'] == 'straight':
            next_infos = road_sections[i+1]['steering_angle_info']
            dist = 0
            merge_idx = 0
            for j in range(len(next_infos)):
                dist += next_infos[j]['distance']
                if dist >= merge_distance:
                    merge_idx = j+1
                    break
            ed_straight_distance = dist
            # 必要ならストレートから切り出してコーナーケツにマージ
            if ed_straight_distance < merge_distance:
                need = merge_distance - ed_straight_distance
                add_infos = []
                if i < n-2 and road_sections[i+2]['type'] == 'straight':
                    add_next_infos = road_sections[i+2]['steering_angle_info']
                    add_dist = 0
                    add_merge_idx = 0
                    for j in range(len(add_next_infos)):
                        add_dist += add_next_infos[j]['distance']
                        if add_dist >= need:
                            add_merge_idx = j+1
                            break
                    if add_dist >= need:
                        add_infos = add_next_infos[:add_merge_idx]
                        road_sections[i+2]['steering_angle_info'] = add_next_infos[add_merge_idx:]
                # ストレートから切り出し
                merge_infos = next_infos[:merge_idx] + add_infos
                section['steering_angle_info'] = section['steering_angle_info'] + merge_infos
                road_sections[i+1]['steering_angle_info'] = next_infos[merge_idx:]
            elif ed_straight_distance >= merge_distance:
                # 既存ストレートからmerge_distance分だけ切り出してマージ
                section['steering_angle_info'] = section['steering_angle_info'] + next_infos[:merge_idx]
                road_sections[i+1]['steering_angle_info'] = next_infos[merge_idx:]

        new_sections.append(section)
    # ステアリング情報が空になったストレートを除外
    return [s for s in new_sections if s['type'] != 'straight' or len(s['steering_angle_info']) > 0]

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

# コーナーレベルを計算する
def generate_corner_level(max_steering_angle: int) -> Literal['none', 'weak', 'medium', 'strong']:
    if max_steering_angle < WEEK_CORNER_ANGLE_MIN:
        return 'none'
    elif WEEK_CORNER_ANGLE_MIN <= max_steering_angle < MEDIUM_CORNER_ANGLE_MIN:
        return 'weak'
    elif MEDIUM_CORNER_ANGLE_MIN <= max_steering_angle < STRONG_CORNER_ANGLE_MIN:
        return 'medium'
    else:
        return 'strong'