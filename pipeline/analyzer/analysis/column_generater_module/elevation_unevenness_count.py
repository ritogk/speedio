from geopandas import GeoDataFrame
from pandas import Series
from scipy.signal import find_peaks
import numpy as np

INTERVAL = 100

def generate(gdf: GeoDataFrame) -> Series:
    def func(x):
        elevation_segment_list = x.elevation_segment_list
        min_elevation = min(elevation_segment_list)

        # 0スケールに変換
        elevations = [item - min_elevation for item in elevation_segment_list]
        elevations = np.array(elevations)

        # 凹凸を検出。
        # 凸は生データのpeakで凹は反転したデータのpeakとして検出する
        distance = 3
        prominence = 5
        peaks, _ = find_peaks(elevations, distance=distance, prominence=prominence)

        elevations_inverted = np.max(elevations) - elevations
        peaks_inverted, _ = find_peaks(elevations_inverted, distance=3, prominence=5)

        unevenness_count = len(peaks) + len(peaks_inverted)

        return unevenness_count

    results = gdf.apply(func, axis=1)

    return results