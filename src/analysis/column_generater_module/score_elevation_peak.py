from geopandas import GeoDataFrame
from pandas import Series
from ...core.convert_range import convert_range


def generate(gdf: GeoDataFrame) -> Series:
    def func(x):
        elevation_peak_count = x.elevation_peak_count
        # 1-6の範囲を(0.5-1)に変換する。
        if elevation_peak_count <= 0:
            return 0
        elif elevation_peak_count >= 6:
            return 1
        
        # 1-6の範囲を(0.5-1)に変換する。
        old_min, old_max = 1, 6
        new_min, new_max = 0.5, 1
        converted_value = convert_range(elevation_peak_count, old_min, old_max, new_min, new_max)
        return converted_value

    series = gdf.apply(func, axis=1)
    return series
