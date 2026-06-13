from geopandas import GeoDataFrame
from pandas import Series
from .core.elevation_peaks import detect_peaks


def generate(gdf: GeoDataFrame) -> Series:
    def func(x):
        peaks, peaks_inverted, _ = detect_peaks(x.elevation_segment_list)
        return len(peaks) + len(peaks_inverted)

    return gdf.apply(func, axis=1)