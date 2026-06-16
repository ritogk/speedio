from geopandas import GeoDataFrame
from pandas import Series
import numpy as np
from .core.segmnet import generate_segment_original_index_list
from .core.elevation_peaks import detect_peaks

INTERVAL = 50
MAX_WALK = 20


def generate(gdf: GeoDataFrame) -> Series:
    def func(x):
        peaks, peaks_inverted, elevations = detect_peaks(x.elevation_segment_list)
        segment_original_index_list = generate_segment_original_index_list(x.geometry, INTERVAL, x.length)

        all_indices = np.concatenate([[0], peaks, peaks_inverted, [len(elevations) - 1]])
        all_indices = np.unique(all_indices)
        all_indices.sort()

        peak_set = set(peaks.tolist())
        valley_set = set(peaks_inverted.tolist())
        coords = list(x.geometry.coords)
        elevation_smooth = x.elevation_smooth
        n_pts = len(coords)

        original_indices = []
        for seg_idx in all_indices:
            orig_idx = segment_original_index_list[int(seg_idx)]
            if int(seg_idx) in peak_set:
                orig_idx = _walk_to_extremum(elevation_smooth, orig_idx, seek_max=True, n_pts=n_pts)
            elif int(seg_idx) in valley_set:
                orig_idx = _walk_to_extremum(elevation_smooth, orig_idx, seek_max=False, n_pts=n_pts)
            original_indices.append(orig_idx)

        original_indices = sorted(set(original_indices))

        uphill = []
        downhill = []
        for i in range(len(original_indices) - 1):
            start_idx = original_indices[i]
            end_idx = original_indices[i + 1]
            start_coord = [coords[start_idx][1], coords[start_idx][0]]
            end_coord = [coords[end_idx][1], coords[end_idx][0]]
            section = {"start": start_coord, "end": end_coord}
            if elevation_smooth[end_idx] > elevation_smooth[start_idx]:
                uphill.append(section)
            else:
                downhill.append(section)

        return {"uphill": uphill, "downhill": downhill}

    return gdf.apply(func, axis=1)


def _walk_to_extremum(elevation_smooth, idx, seek_max, n_pts):
    def walk(direction):
        pos = idx
        while True:
            next_pos = pos + direction
            if next_pos < 0 or next_pos >= n_pts:
                break
            if abs(next_pos - idx) > MAX_WALK:
                break
            if seek_max and elevation_smooth[next_pos] < elevation_smooth[pos]:
                break
            if not seek_max and elevation_smooth[next_pos] > elevation_smooth[pos]:
                break
            pos = next_pos
        return pos

    fwd = walk(+1)
    bwd = walk(-1)
    if seek_max:
        return fwd if elevation_smooth[fwd] >= elevation_smooth[bwd] else bwd
    return fwd if elevation_smooth[fwd] <= elevation_smooth[bwd] else bwd
