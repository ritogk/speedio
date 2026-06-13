from geopandas import GeoDataFrame
from pandas import Series
import numpy as np
from .core.segmnet import generate_segment_list
from .core.elevation_peaks import detect_peaks

INTERVAL = 50


def generate(gdf: GeoDataFrame) -> Series:
    def func(x):
        peaks, peaks_inverted, elevations = detect_peaks(x.elevation_segment_list)
        segment_list = generate_segment_list(x.geometry, INTERVAL, x.length)

        peaks_all = np.concatenate([peaks, peaks_inverted])

        result = []
        result.append({
            'point': [segment_list[0].y, segment_list[0].x],
            'prominence': elevations[0]
        })
        for i in range(len(peaks_all)):
            result.append({
                'point': [segment_list[peaks_all[i]].y, segment_list[peaks_all[i]].x],
                'prominence': elevations[peaks_all[i]]
            })
        result.append({
            'point': [segment_list[len(segment_list)-1].y, segment_list[len(segment_list)-1].x],
            'prominence': elevations[len(elevations)-1]
        })

        return result

    return gdf.apply(func, axis=1)