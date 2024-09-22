from geopandas import GeoDataFrame
from pandas import Series
from shapely.geometry import LineString, Point
from geopy.distance import geodesic
from scipy.signal import find_peaks
import numpy as np

INTERVAL = 100

def generate(gdf: GeoDataFrame) -> Series:
    def func(x):
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

        # ピーク（山）の検出
        # ★★ find_peaks関数の意味を理解する所から
        peaks, _ = find_peaks(elevation_data, distance=3, prominence=4.5)
        # print("ピークのインデックス")
        # print(peaks)
        # print(_["prominences"])
        # print("調査対象")
        # print(_)

        # 大きなコブと凹みの数
        peak_count = len(peaks)
        return peak_count

    results = gdf.apply(func, axis=1)

    return results


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