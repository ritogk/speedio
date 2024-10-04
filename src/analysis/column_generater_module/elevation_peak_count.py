from geopandas import GeoDataFrame
from pandas import Series
from scipy.signal import find_peaks
import numpy as np

INTERVAL = 100

def generate(gdf: GeoDataFrame) -> Series:
    def func(x):
        elevation_data = x.elevation_segment_list
        min_elevation = min(elevation_data)

        # 0スケールに変換
        elevation_data = [item - min_elevation for item in elevation_data]
        # print(elevation_data)
        elevation_data = np.array(elevation_data)

        # ピーク（山）の検出
        peaks, _ = find_peaks(elevation_data, distance=3, prominence=6)
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