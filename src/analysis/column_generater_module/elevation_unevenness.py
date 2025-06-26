from geopandas import GeoDataFrame
from pandas import Series
from scipy.signal import find_peaks
import numpy as np
from .core.segmnet import generate_segment_list


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
        peaks, peaks_ = find_peaks(elevations, distance=distance, prominence=prominence)

        elevations_inverted = np.max(elevations) - elevations
        peaks_inverted, peaks_inverted_ = find_peaks(elevations_inverted, distance=3, prominence=5)

        INTERVAL = 50
        segment_list = generate_segment_list(x.geometry, INTERVAL, x.length)

        # peaksとpeaks_invertedを結合
        peaks_all = np.concatenate([peaks, peaks_inverted])

        result = []
        result.append({
            'point': [segment_list[0].y, segment_list[0].x],
            'prominence': elevations[0]
        })
        for i in range(len(peaks_all)):
            result.append({
                'point': [segment_list[peaks_all[i]].y, segment_list[peaks_all[i]].x],
                'prominence': elevations[peaks_all[i]] # ここでエラー。んデックスのはんいが
            })
        result.append({
            'point': [segment_list[len(segment_list)-1].y, segment_list[len(segment_list)-1].x],
            'prominence': elevations[len(elevations)-1]
        })

        return result

    results = gdf.apply(func, axis=1)

    return results