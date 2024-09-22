from geopandas import GeoDataFrame
from pandas import Series
from .elevation_u_shape import SectionType, SectionTypeLevel
from geopy.distance import geodesic

import numpy as np
from scipy.signal import find_peaks, savgol_filter
import matplotlib.pyplot as plt
from shapely.geometry import LineString, Point

def generate(gdf: GeoDataFrame) -> tuple[Series, Series, Series, Series, Series]:
    def func(x):

        # 仮の標高データ

        def interpolate_point_index_list(line: LineString, interval: int, length:int) -> list[list[Point, Point]]:
            point_indexs = [{"index": 0, "distance": 0}]
            distance = 0
            old_point = line.coords[0]
            for index, point in enumerate(line.coords):
                # x, y = point
                if index + 1 >= len(line.coords):
                    if distance != 0:
                        point_indexs.append({"index": len(line.coords) - 1, "distance": distance})
                    continue
                next_point = line.coords[index + 1]
                distance += geodesic((point[1], point[0]), (next_point[1], next_point[0])).meters
                if distance >= interval:
                    # print(old_point)
                    # print(next_point)
                    # print(distance)
                    point_indexs.append({"index": index + 1, "distance": distance})
                    distance = 0
                    old_point = next_point

            # print(point_indexs)
            return point_indexs

        segment_list = interpolate_point_index_list(x.geometry, 100, x.length)
        # elevation_dataからsegment_listのindexの値を抽出
        elevation_data = []
        for segment in segment_list:
            # print(segment['index'])
            elevation_data.append(x.elevation_smooth[segment['index']])
        min_elevation = min(elevation_data)

        # 0スケールに変換
        elevation_data = [item - min_elevation for item in elevation_data]
        print(elevation_data)
        elevation_data = np.array(elevation_data)
        

        # # 平滑化を調整（ウィンドウサイズを少し小さく）
        # smoothed_data = savgol_filter(elevation_data, window_length=11, polyorder=2)

        # しきい値と距離の調整
        height_threshold = 5  # しきい値を低くして凹みを検出
        distance_threshold = 10  # ピーク間の距離を狭めて検出精度を上げる

        # ピーク（山）の検出
        # ★★ find_peaks関数の意味を理解する所から
        peaks, _ = find_peaks(elevation_data, distance=3, prominence=4.5)
        print("ピークのインデックス")
        print(peaks)
        print(_["prominences"])
        print("調査対象")
        print(_)

        # 大きなコブと凹みの数
        num_large_peaks = len(peaks)

        # 結果を表示
        print(f"大きいコブの数: {num_large_peaks}")

        # # グラフ表示
        # plt.plot(elevation_smooth, label="Smoothed Elevation")
        # plt.plot(peaks, elevation_smooth[peaks], "x", label="Large Peaks", color="red")
        # plt.legend()
        # plt.show()


        elevation_group = x.elevation_group
        
        up_section_distance = 0
        up_section_level = 0
        score_up_section = 0
        up_group_list = [item for item in elevation_group if (item['section_type'] == SectionType.UP.value)]
        if not len(up_group_list) == 0:
            up_section_distance = sum(item['distance'] for item in up_group_list)
            up_height_and_distance_ratio = sum(item['height'] for item in up_group_list) / up_section_distance
            # 0.015から0.1までを距離を1から2のスケールに変換
            if up_height_and_distance_ratio < 0.015:
                temp = 0.8
            elif up_height_and_distance_ratio > 0.1:
                temp = 2
            else:
                temp = 1 + (up_height_and_distance_ratio - 0.015) * (2 - 1) / (0.1 - 0.015)
            
            # ★1をこえたら1にすべきか？
            score_up_section = (up_section_distance / x.length) * temp
            score_up_section = 1.0 if score_up_section > 1.0 else score_up_section

        # print(up_section_distance, up_section_level, score_up_section)
        down_section_distance = 0
        down_section_level = 0
        score_down_section = 0
        down_group_list = [item for item in elevation_group if (item['section_type'] == SectionType.DOWN.value)]
        if not len(down_group_list) == 0:
            down_section_distance = sum(item['distance'] for item in down_group_list)
            down_height_and_distance_ratio = sum(item['height'] for item in down_group_list) / down_section_distance
            print(down_height_and_distance_ratio)
            # score_down_section = (down_section_distance / x.length) * down_section_level) / ((down_section_distance / x.length) * SectionTypeLevel.HIGHT.value)
            # 0.015から0.1までを距離を1から2のスケールに変換
            if down_height_and_distance_ratio < 0.015:
                temp = 0.8
            elif down_height_and_distance_ratio > 0.1:
                temp = 2
            else:
                temp = 1 + (down_height_and_distance_ratio - 0.015) * (2 - 1) / (0.1 - 0.015)

            # 「高さと距離の割合」と「距離とlength」の割合からスコアを算出
            # 一旦計算して、結果から調整する。
            score_down_section = (down_section_distance / x.length) * temp
            score_down_section = 1.0 if score_down_section > 1.0 else score_down_section

        # print(down_section_distance, down_section_level, score_down_section)
        flat_section_distance = 0
        flat_section_level = 0
        score_flat_section = 0
        flat_group_list = [item for item in elevation_group if (item['section_type'] == SectionType.FLAT.value)]
        if not len(flat_group_list) == 0:
            # flat_section_distance = sum(item['distance'] for item in flat_group_list)
            # flat_section_level = sum(item['section_type_level'] for item in flat_group_list) / len(flat_group_list)
            # score_flat_section = ((flat_section_distance / x.length) * flat_section_level) / ((flat_section_distance / x.length) * SectionTypeLevel.HIGHT.value)
            score_flat_section = 0
            # score_flat_section = 1.0 if score_flat_section > 1.0 else score_flat_section
        
        # if score_up_section == 0 or score_down_section == 0 or score_flat_section == 0:
        if score_up_section == 0 or score_down_section == 0:
            score_deviation = 0
        else:
            min_score = min([score_up_section, score_down_section])
            max_score = max([score_up_section, score_down_section])
            score_deviation = min_score / max_score
        
        # ★ここの調整が肝な気がする・・・・・
        # height_and_distance_ratioが0.05を超えてる状態が連続していたら複雑な道と判断する
        # ここの計算をどうするかを考える所からはじめる。距離とアップダウンを考慮すうりょうな計算にする必要がある。
        elevation_up_down_group = [item for item in elevation_group if (item['section_type'] == SectionType.UP.value or item['section_type'] == SectionType.DOWN.value)]
        score_complexity = 0
        cnt = 0
        for item in elevation_up_down_group:
            if item['height_and_distance_ratio'] > 0.05:
                cnt += 1
        score_complexity = cnt / len(elevation_up_down_group)
        
        # score_complexity = len(elevation_group) / len(x.elevation_section)

        return score_up_section, score_down_section, score_flat_section, score_deviation, score_complexity, num_large_peaks

    results = gdf.apply(func, axis=1, result_type='expand')
    score_up_section = results[0]
    score_down_section = results[1]
    score_flat_section = results[2]
    score_deviation_section = results[3]
    score_complexity = results[4]
    num_large_peaks = results[5]
    return score_up_section, score_down_section, score_flat_section, score_deviation_section, score_complexity, num_large_peaks
