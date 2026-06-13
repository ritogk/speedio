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

        all_indices = np.concatenate([[0], peaks, peaks_inverted, [len(elevations) - 1]])
        all_indices = np.unique(all_indices)
        all_indices.sort()

        uphill = []
        downhill = []
        for i in range(len(all_indices) - 1):
            start_idx = int(all_indices[i])
            end_idx = int(all_indices[i + 1])
            start_coord = [segment_list[start_idx].y, segment_list[start_idx].x]
            end_coord = [segment_list[end_idx].y, segment_list[end_idx].x]
            section = {"start": start_coord, "end": end_coord}
            if elevations[end_idx] > elevations[start_idx]:
                uphill.append(section)
            else:
                downhill.append(section)

        return {"uphill": uphill, "downhill": downhill}

    return gdf.apply(func, axis=1)
